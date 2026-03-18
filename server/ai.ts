import {
  convertToModelMessages,
  generateObject,
  stepCountIs,
  streamText,
  type UIMessage,
} from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import {
  DEFAULT_MEMORY_POLICY,
  DEFAULT_MODEL,
  deriveHarnessName,
  HarnessSpecSchema,
  resolveModelSelection,
  type Harness,
  type HarnessSpec,
  type Settings,
  type SkillSpec,
} from '../shared/schema.ts'

import {
  createRuntimeTools,
  normalizeToolSchema,
} from './runtime-tools'

function sanitizeCode(code: string) {
  return code
    .trim()
    .replace(/^```(?:js|javascript)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^export\s+default\s+/i, '')
    .trim()
}

function normalizeSkill(skill: SkillSpec) {
  const name = skill.name.trim().replace(/\s+/g, ' ')

  return {
    ...skill,
    name,
    description: skill.description.trim(),
    code: sanitizeCode(skill.code),
    inputSchema: normalizeToolSchema(skill.inputSchema, `${name}Input`),
    outputSchema: normalizeToolSchema(skill.outputSchema, `${name}Output`),
  }
}

export function normalizeHarnessSpec(
  rawSpec: unknown,
  currentSpec: HarnessSpec,
  defaultModel: string,
) {
  const parsed = HarnessSpecSchema.parse(rawSpec)
  const tools = Array.from(
    new Map(
      parsed.tools
        .map(normalizeSkill)
        .map((skill) => [skill.name.toLowerCase(), skill]),
    ).values(),
  )

  const goal = parsed.goal.trim()
  const audience = parsed.audience.trim()
  const model = parsed.model.trim() ||
    resolveModelSelection(currentSpec.model, defaultModel) ||
    defaultModel ||
    DEFAULT_MODEL
  const systemPrompt =
    parsed.systemPrompt.trim() ||
    currentSpec.systemPrompt.trim() ||
    `You are a helpful assistant built for ${goal || 'a specific task'}.`
  const memoryPolicy =
    parsed.memoryPolicy.trim() ||
    currentSpec.memoryPolicy.trim() ||
    DEFAULT_MEMORY_POLICY

  return HarnessSpecSchema.parse({
    goal,
    audience,
    model,
    systemPrompt,
    memoryPolicy,
    tools,
  })
}

export function resolveHarnessName(currentName: string, spec: HarnessSpec) {
  const genericNames = new Set(['untitled harness', 'new harness'])

  if (genericNames.has(currentName.toLowerCase().trim())) {
    return deriveHarnessName(spec.goal, currentName)
  }

  return currentName
}

function getOpenRouter(settings: Settings) {
  if (!settings.openrouterKey.trim()) {
    throw new Error('OpenRouter API key is not configured.')
  }

  return createOpenRouter({
    apiKey: settings.openrouterKey,
  })
}

function builderSystemPrompt(
  harness: Harness,
  warnings: string[],
  defaultModel: string,
) {
  const effectiveModel = resolveModelSelection(harness.spec.model, defaultModel)

  return [
    'You are YunForge, a local harness builder for chat-first AI assistants.',
    'Your job is to guide the user toward a concrete, deployable assistant specification.',
    'Speak conversationally and explain what you are changing or what is still missing.',
    'Prefer short, practical answers. Ask at most one follow-up question when a blocker exists.',
    'When the user requests capabilities that need live data, APIs, or sandboxed computation, assume they want a generated skill.',
    'Built-in runtime tools are available during the builder chat:',
    '- `web_search`: searches the live web, fetches source pages, chunks them, and returns ranked excerpts.',
    '- Configured MCP tools: user-supplied external tools from the local settings sheet.',
    'Use runtime tools when you need current docs, live facts, or external system context.',
    'Only generate a persisted skill when the finished assistant should keep that capability at runtime.',
    'Do not emit raw JSON unless the user explicitly asks for it.',
    '',
    `Current harness name: ${harness.name}`,
    `Current goal: ${harness.spec.goal || '(unset)'}`,
    `Current audience: ${harness.spec.audience || '(unset)'}`,
    `Current model: ${effectiveModel || '(unset)'}`,
    `Current memory policy: ${harness.spec.memoryPolicy || '(unset)'}`,
    `Current tools: ${harness.spec.tools.map((tool) => tool.name).join(', ') || '(none)'}`,
    warnings.length
      ? `Runtime warnings: ${warnings.join(' | ')}`
      : 'Runtime warnings: (none)',
  ].join('\n')
}

function specCompilerSystemPrompt(currentSpec: HarnessSpec) {
  return [
    'You convert YunForge builder conversations into the full canonical HarnessSpec JSON object.',
    'Preserve existing information unless the conversation clearly replaces it.',
    'Fill missing fields with sensible defaults when the user intent is clear.',
    'The `tools` array must contain only active skills that materially help the harness goal.',
    'Built-in runtime tools such as `web_search` and configured MCP tools are already available automatically at runtime.',
    'Do not create a persisted skill just to perform one-off research or to mirror an MCP tool that is already configured.',
    'Each tool `code` field must be a complete async JavaScript function string.',
    'Use the signature `async function skillName(input, context) { ... }`.',
    'The function must be self-contained, must not import modules, and must return JSON-serializable output.',
    'Use built-in `fetch` when HTTP requests are needed.',
    'Do not reference secret environment variables. The function receives runtime context instead.',
    'Generate `inputSchema` and `outputSchema` as JSON Schema objects.',
    '',
    'Current stored spec:',
    JSON.stringify(currentSpec, null, 2),
  ].join('\n')
}

function assistantSystemPrompt(harness: Harness, warnings: string[]) {
  return [
    harness.spec.systemPrompt.trim(),
    '',
    `Goal: ${harness.spec.goal || 'Handle the user request accurately.'}`,
    `Audience: ${harness.spec.audience || 'General users.'}`,
    `Memory policy: ${harness.spec.memoryPolicy || DEFAULT_MEMORY_POLICY}`,
    'You are operating inside YunForge.',
    'Use tools when they materially improve accuracy or can complete the task faster.',
    'A built-in `web_search` tool is available for current web information and returns chunked source excerpts with URLs.',
    'Configured MCP tools may also be available from the user settings.',
    'When using web search, cite the source URLs you relied on.',
    'When a tool fails, explain the failure plainly and continue if a useful answer is still possible.',
    'Do not fabricate tool results.',
    warnings.length
      ? `Runtime warnings: ${warnings.join(' | ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function createBuilderResponse(input: {
  harness: Harness
  messages: UIMessage[]
  settings: Settings
  onSpecReady: (nextSpec: HarnessSpec, nextName: string) => Promise<void>
}) {
  const openrouter = getOpenRouter(input.settings)
  const modelId = resolveModelSelection(
    input.harness.spec.model,
    input.settings.defaultModel,
  )
  const modelMessages = await convertToModelMessages(input.messages)
  const runtimeTools = await createRuntimeTools({
    harness: input.harness,
    settings: input.settings,
    includeGeneratedSkills: false,
  })

  const result = streamText({
    model: openrouter(modelId),
    system: builderSystemPrompt(
      input.harness,
      runtimeTools.warnings,
      input.settings.defaultModel,
    ),
    messages: modelMessages,
    tools: runtimeTools.tools,
    stopWhen: stepCountIs(8),
  })

  return result.toUIMessageStreamResponse({
    originalMessages: input.messages,
    onFinish: async ({ messages }) => {
      try {
        const compiled = await generateObject({
          model: openrouter(modelId),
          system: specCompilerSystemPrompt(input.harness.spec),
          messages: await convertToModelMessages(messages),
          schema: HarnessSpecSchema,
          schemaName: 'HarnessSpec',
          schemaDescription:
            'The complete assistant harness spec including generated skills.',
        })

        const nextSpec = normalizeHarnessSpec(
          compiled.object,
          input.harness.spec,
          input.settings.defaultModel,
        )
        const nextName = resolveHarnessName(input.harness.name, nextSpec)
        await input.onSpecReady(nextSpec, nextName)
      } finally {
        await runtimeTools.close()
      }
    },
    onError: (error) => {
      void runtimeTools.close()
      return error instanceof Error ? error.message : 'Builder request failed.'
    },
  })
}

export async function createAssistantResponse(input: {
  harness: Harness
  messages: UIMessage[]
  settings: Settings
}) {
  const openrouter = getOpenRouter(input.settings)
  const modelId = resolveModelSelection(
    input.harness.spec.model,
    input.settings.defaultModel,
  )
  const runtimeTools = await createRuntimeTools({
    harness: input.harness,
    settings: input.settings,
    includeGeneratedSkills: true,
  })

  const result = streamText({
    model: openrouter(modelId),
    system: assistantSystemPrompt(input.harness, runtimeTools.warnings),
    messages: await convertToModelMessages(input.messages),
    tools: runtimeTools.tools,
    stopWhen: stepCountIs(6),
  })

  return result.toUIMessageStreamResponse({
    originalMessages: input.messages,
    onFinish: async () => {
      await runtimeTools.close()
    },
    onError: (error) => {
      void runtimeTools.close()
      return error instanceof Error ? error.message : 'Assistant request failed.'
    },
  })
}
