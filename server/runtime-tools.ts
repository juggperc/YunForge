import { jsonSchema, tool, type ToolSet } from 'ai'
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp'
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio'
import { z } from 'zod'

import {
  parseMcpServersJson,
  type Harness,
  type JsonObject,
  type McpServerConfig,
  type Settings,
} from '../shared/schema.ts'

import { executeSkillInSandbox } from './e2b'
import { searchWebWithChunks } from './web-search'

function serializeError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function normalizeToolSchema(schema: JsonObject | undefined, fallbackName: string) {
  const base = schema && Object.keys(schema).length > 0 ? schema : undefined

  return (
    base ?? {
      type: 'object',
      title: fallbackName,
      properties: {},
      additionalProperties: false,
    }
  )
}

export function toToolKey(name: string, index: number) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || `tool_${index + 1}`
}

function createWebSearchTool() {
  return tool({
    description:
      'Searches the live web, fetches top pages, chunks their readable content, and returns the most relevant excerpts with source URLs.',
    inputSchema: z.object({
      query: z.string().min(2).describe('The web search query to investigate.'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(6)
        .default(4)
        .describe('How many source pages to inspect.'),
      maxChunks: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(6)
        .describe('How many ranked text chunks to return.'),
      chunkSize: z
        .number()
        .int()
        .min(400)
        .max(1800)
        .default(1000)
        .describe('Approximate character size for each extracted chunk.'),
    }),
    execute: async ({ query, maxResults, maxChunks, chunkSize }) => {
      return searchWebWithChunks({
        query,
        maxResults,
        maxChunks,
        chunkSize,
      })
    },
  })
}

function createSkillTools(input: { harness: Harness; settings: Settings }) {
  return Object.fromEntries(
    input.harness.spec.tools.map((skill, index) => {
      const key = toToolKey(skill.name, index)

      return [
        key,
        tool({
          description: skill.description || `Generated YunForge tool: ${skill.name}`,
          inputSchema: jsonSchema(
            normalizeToolSchema(skill.inputSchema, `${key}Input`) as Record<
              string,
              unknown
            >,
          ),
          execute: async (toolInput) => {
            return executeSkillInSandbox({
              skill,
              input: toolInput,
              harness: input.harness,
              settings: input.settings,
            })
          },
        }),
      ]
    }),
  ) as ToolSet
}

async function createMcpClientFromConfig(config: McpServerConfig) {
  if (config.transport.type === 'stdio') {
    return createMCPClient({
      name: `yunforge-${toToolKey(config.name, 0)}`,
      transport: new Experimental_StdioMCPTransport({
        command: config.transport.command,
        args: config.transport.args,
        env: config.transport.env,
        cwd: config.transport.cwd,
        stderr: process.stderr,
      }),
    })
  }

  return createMCPClient({
    name: `yunforge-${toToolKey(config.name, 0)}`,
    transport: {
      type: config.transport.type,
      url: config.transport.url,
      headers: config.transport.headers,
    },
  })
}

async function loadMcpTools(settings: Settings) {
  const clients: MCPClient[] = []
  const warnings: string[] = []
  const toolEntries: Array<[string, ToolSet[string]]> = []
  let configs: McpServerConfig[] = []

  try {
    configs = parseMcpServersJson(settings.mcpServersJson)
  } catch (error) {
    warnings.push(
      `MCP settings are invalid JSON: ${serializeError(error)}`,
    )
  }

  for (const [serverIndex, config] of configs.entries()) {
    try {
      const client = await createMcpClientFromConfig(config)
      const clientTools = (await client.tools()) as ToolSet
      clients.push(client)

      let localCount = 0

      for (const [toolName, toolValue] of Object.entries(clientTools)) {
        const key = toToolKey(`${config.name}_${toolName}`, serverIndex + localCount)
        toolEntries.push([key, toolValue])
        localCount += 1
      }

      if (!localCount) {
        warnings.push(`MCP server "${config.name}" connected but exposed no tools.`)
      }
    } catch (error) {
      warnings.push(
        `MCP server "${config.name}" is unavailable: ${serializeError(error)}`,
      )
    }
  }

  return {
    tools: Object.fromEntries(toolEntries) as ToolSet,
    warnings,
    close: async () => {
      await Promise.allSettled(clients.map((client) => client.close()))
    },
  }
}

export async function createRuntimeTools(input: {
  harness: Harness
  settings: Settings
  includeGeneratedSkills: boolean
}) {
  const cleanupTasks: Array<() => Promise<void>> = []
  const warnings: string[] = []
  const toolEntries: Array<[string, ToolSet[string]]> = [['web_search', createWebSearchTool()]]

  const mcp = await loadMcpTools(input.settings)
  warnings.push(...mcp.warnings)
  cleanupTasks.push(mcp.close)
  toolEntries.push(
    ...(Object.entries(mcp.tools) as Array<[string, ToolSet[string]]>),
  )

  if (input.includeGeneratedSkills) {
    toolEntries.push(
      ...(Object.entries(
        createSkillTools({
          harness: input.harness,
          settings: input.settings,
        }),
      ) as Array<[string, ToolSet[string]]>),
    )
  }

  return {
    tools: Object.fromEntries(toolEntries) as ToolSet,
    warnings,
    close: async () => {
      await Promise.allSettled(cleanupTasks.map((task) => task()))
    },
  }
}
