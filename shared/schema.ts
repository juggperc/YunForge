import { z } from 'zod'

export const DEFAULT_MODEL = 'deepseek/deepseek-chat'
export const DEFAULT_MEMORY_POLICY =
  'Keep the conversation session-local. Persist only the harness configuration and generated skills.'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
)

export const JsonObjectSchema = z.record(z.string(), JsonValueSchema)

export const SkillSpecSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().default(''),
  code: z.string().trim().default(''),
  inputSchema: JsonObjectSchema.default({
    type: 'object',
    properties: {},
    additionalProperties: false,
  }),
  outputSchema: JsonObjectSchema.default({
    type: 'object',
    properties: {},
    additionalProperties: true,
  }),
})

export const HarnessSpecSchema = z.object({
  goal: z.string().trim().default(''),
  audience: z.string().trim().default(''),
  model: z.string().trim().default(DEFAULT_MODEL),
  systemPrompt: z.string().trim().default(''),
  memoryPolicy: z.string().trim().default(DEFAULT_MEMORY_POLICY),
  tools: z.array(SkillSpecSchema).default([]),
})

export const PortableHarnessSpecSchema = HarnessSpecSchema.omit({
  tools: true,
})

export const HarnessStatusSchema = z.enum(['draft', 'compiled'])

export const HarnessSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  spec: HarnessSpecSchema,
  status: HarnessStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const SettingsSchema = z.object({
  openrouterKey: z.string().default(''),
  e2bKey: z.string().default(''),
  defaultModel: z.string().default(DEFAULT_MODEL),
})

export const SettingsKeySchema = z.enum([
  'openrouter_key',
  'e2b_key',
  'default_model',
])

export const ForgeExportSchema = z.object({
  forgeVersion: z.literal('1.0'),
  name: z.string().trim().min(1),
  exportedAt: z.string(),
  spec: PortableHarnessSpecSchema,
  tools: z.array(SkillSpecSchema),
})

export type JsonObject = z.infer<typeof JsonObjectSchema>
export type SkillSpec = z.infer<typeof SkillSpecSchema>
export type HarnessSpec = z.infer<typeof HarnessSpecSchema>
export type PortableHarnessSpec = z.infer<typeof PortableHarnessSpecSchema>
export type HarnessStatus = z.infer<typeof HarnessStatusSchema>
export type Harness = z.infer<typeof HarnessSchema>
export type Settings = z.infer<typeof SettingsSchema>
export type SettingsKey = z.infer<typeof SettingsKeySchema>
export type ForgeExport = z.infer<typeof ForgeExportSchema>

export function createEmptyHarnessSpec(model = DEFAULT_MODEL): HarnessSpec {
  return HarnessSpecSchema.parse({
    model,
  })
}

export function deriveHarnessName(goal: string, fallback = 'Untitled Harness') {
  const trimmed = goal.trim()

  if (!trimmed) {
    return fallback
  }

  const compact = trimmed
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!compact) {
    return fallback
  }

  const words = compact.split(' ').slice(0, 4)
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function buildForgeExport(harness: Harness): ForgeExport {
  return ForgeExportSchema.parse({
    forgeVersion: '1.0',
    name: harness.name,
    exportedAt: new Date().toISOString(),
    spec: {
      goal: harness.spec.goal,
      audience: harness.spec.audience,
      model: harness.spec.model,
      systemPrompt: harness.spec.systemPrompt,
      memoryPolicy: harness.spec.memoryPolicy,
    },
    tools: harness.spec.tools,
  })
}

export function hydrateForgeExport(payload: ForgeExport): HarnessSpec {
  return HarnessSpecSchema.parse({
    ...payload.spec,
    tools: payload.tools,
  })
}
