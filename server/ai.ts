import {
  convertToModelMessages,
  generateObject,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import {
  DEFAULT_MEMORY_POLICY,
  DEFAULT_MODEL,
  deriveHarnessName,
  HarnessSpecSchema,
  type Harness,
  type HarnessSpec,
  type JsonObject,
  type Settings,
  type SkillSpec,
} from '../shared/schema.ts'

import { executeSkillInSandbox } from './e2b'

function sanitizeCode(code: string) {
  return code
    .trim()
    .replace(/^```(?:js|javascript)?\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^export\s+default\s+/i, '')
    .trim()
}

function normalizeToolSchema(schema: JsonObject | undefined, fallbackName: string) {
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
  const model = parsed.model.trim() || currentSpec.model || defaultModel || DEFAULT_MODEL
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

function builderSystemPrompt(harness: Harness) {
  return [
    'You are YunForge, a local harness builder for chat-first AI assistants.',
    'Your job is to guide the user toward a concrete, deployable assistant specification.',
    'Speak conversationally and explain what you are changing or what is still missing.',
    'Prefer short, practical answers. Ask at most one follow-up question when a blocker exists.',
    'When the user requests capabilities that need live data, APIs, or sandboxed computation, assume they want a generated skill.',
    'Do not emit raw JSON unless the user explicitly asks for it.',
    '',
    `Current harness name: ${harness.name}`,
    `Current goal: ${harness.spec.goal || '(unset)'}`,
    `Current audience: ${harness.spec.audience || '(unset)'}`,
    `Current model: ${harness.spec.model || '(unset)'}`,
    `Current memory policy: ${harness.spec.memoryPolicy || '(unset)'}`,
    `Current tools: ${harness.spec.tools.map((tool) => tool.name).join(', ') || '(none)'}`,
  ].join('\n')
}

function specCompilerSystemPrompt(currentSpec: HarnessSpec) {
  return [
    'You convert YunForge builder conversations into the full canonical HarnessSpec JSON object.',
    'Preserve existing information unless the conversation clearly replaces it.',
    'Fill missing fields with sensible defaults when the user intent is clear.',
    'The `tools` array must contain only active skills that materially help the harness goal.',
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

function assistantSystemPrompt(harness: Harness) {
  return [
    harness.spec.systemPrompt.trim(),
    '',
    `Goal: ${harness.spec.goal || 'Handle the user request accurately.'}`,
    `Audience: ${harness.spec.audience || 'General users.'}`,
    `Memory policy: ${harness.spec.memoryPolicy || DEFAULT_MEMORY_POLICY}`,
    'You are operating inside YunForge.',
    'Use tools when they materially improve accuracy or can complete the task faster.',
    'When a tool fails, explain the failure plainly and continue if a useful answer is still possible.',
    'Do not fabricate tool results.',
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
  const modelId = input.harness.spec.model || input.settings.defaultModel || DEFAULT_MODEL
  const modelMessages = await convertToModelMessages(input.messages)

  const result = streamText({
    model: openrouter(modelId),
    system: builderSystemPrompt(input.harness),
    messages: modelMessages,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: input.messages,
    onFinish: async ({ messages }) => {
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
    },
    onError: (error) =>
      error instanceof Error ? error.message : 'Builder request failed.',
  })
}

function toToolKey(name: string, index: number) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || `skill_${index + 1}`
}

export async function createAssistantResponse(input: {
  harness: Harness
  messages: UIMessage[]
  settings: Settings
}) {
  const openrouter = getOpenRouter(input.settings)

  if (!input.harness.spec.tools.length) {
    const result = streamText({
      model: openrouter(input.harness.spec.model || input.settings.defaultModel),
      system: assistantSystemPrompt(input.harness),
      messages: await convertToModelMessages(input.messages),
    })

    return result.toUIMessageStreamResponse({
      originalMessages: input.messages,
      onError: (error) =>
        error instanceof Error ? error.message : 'Assistant request failed.',
    })
  }

  const tools = Object.fromEntries(
    input.harness.spec.tools.map((skill, index) => {
      const key = toToolKey(skill.name, index)

      return [
        key,
        tool({
          description: skill.description || `Generated YunForge tool: ${skill.name}`,
          inputSchema: jsonSchema(
            normalizeToolSchema(skill.inputSchema, key) as Record<string, unknown>,
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
  )

  const result = streamText({
    model: openrouter(input.harness.spec.model || input.settings.defaultModel),
    system: assistantSystemPrompt(input.harness),
    messages: await convertToModelMessages(input.messages),
    tools,
    stopWhen: stepCountIs(6),
  })

  return result.toUIMessageStreamResponse({
    originalMessages: input.messages,
    onError: (error) =>
      error instanceof Error ? error.message : 'Assistant request failed.',
  })
}
