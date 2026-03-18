import { serve } from '@hono/node-server'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'

import {
  buildForgeExport,
  ForgeExportSchema,
  HarnessSpecSchema,
  HarnessStatusSchema,
  hydrateForgeExport,
  SettingsKeySchema,
} from '../shared/schema.ts'

import {
  createHarness,
  deleteHarness,
  ensureHarnessExists,
  getHarness,
  getSettings,
  listHarnesses,
  saveSetting,
  updateHarness,
} from './db'
import {
  createAssistantResponse,
  createBuilderResponse,
} from './ai'

const app = new Hono()

app.use('/api/*', cors())

app.get('/api/health', (context) => {
  return context.json({
    ok: true,
  })
})

app.get('/api/settings', (context) => {
  return context.json(getSettings())
})

app.patch(
  '/api/settings',
  zValidator(
    'json',
    z.object({
      key: SettingsKeySchema,
      value: z.string(),
    }),
  ),
  (context) => {
    const { key, value } = context.req.valid('json')
    return context.json(saveSetting(key, value))
  },
)

app.get('/api/harness', (context) => {
  const harnesses = listHarnesses()

  if (!harnesses.length) {
    const created = ensureHarnessExists()
    return context.json(created ? [created] : [])
  }

  return context.json(harnesses)
})

app.get('/api/harness/:id', (context) => {
  const harness = getHarness(context.req.param('id'))

  if (!harness) {
    return context.json({ error: 'Harness not found.' }, 404)
  }

  return context.json(harness)
})

app.post(
  '/api/harness',
  zValidator(
    'json',
    z
      .object({
        name: z.string().optional(),
        spec: HarnessSpecSchema.optional(),
        status: HarnessStatusSchema.optional(),
        importData: ForgeExportSchema.optional(),
      })
      .optional(),
  ),
  (context) => {
    const payload = context.req.valid('json')

    const created = payload?.importData
      ? createHarness({
          name: payload.importData.name,
          spec: hydrateForgeExport(payload.importData),
          status: 'draft',
        })
      : createHarness(payload)

    return context.json(created, 201)
  },
)

app.patch(
  '/api/harness/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().optional(),
      spec: HarnessSpecSchema.optional(),
      status: HarnessStatusSchema.optional(),
    }),
  ),
  (context) => {
    const harness = updateHarness(context.req.param('id'), context.req.valid('json'))

    if (!harness) {
      return context.json({ error: 'Harness not found.' }, 404)
    }

    return context.json(harness)
  },
)

app.delete('/api/harness/:id', (context) => {
  const deleted = deleteHarness(context.req.param('id'))

  if (!deleted) {
    return context.json({ error: 'Harness not found.' }, 404)
  }

  return context.json({ ok: true })
})

app.get('/api/harness/:id/export', (context) => {
  const harness = getHarness(context.req.param('id'))

  if (!harness) {
    return context.json({ error: 'Harness not found.' }, 404)
  }

  return context.json(buildForgeExport(harness))
})

const chatRequestSchema = z.object({
  id: z.string().optional(),
  harnessId: z.string().optional(),
  messages: z.array(z.any()).default([]),
  trigger: z.enum(['submit-message', 'regenerate-message']).optional(),
  messageId: z.string().optional(),
})

app.post(
  '/api/builder',
  zValidator('json', chatRequestSchema.extend({ harnessId: z.string() })),
  async (context) => {
    const payload = context.req.valid('json')
    const harness = getHarness(payload.harnessId)

    if (!harness) {
      return context.json({ error: 'Harness not found.' }, 404)
    }

    const settings = getSettings()

    try {
      return await createBuilderResponse({
        harness,
        messages: payload.messages,
        settings,
        onSpecReady: async (nextSpec, nextName) => {
          updateHarness(harness.id, {
            name: nextName,
            spec: nextSpec,
            status: 'draft',
          })
        },
      })
    } catch (error) {
      return context.json(
        {
          error: error instanceof Error ? error.message : 'Builder failed.',
        },
        400,
      )
    }
  },
)

app.post(
  '/api/assistant/:harnessId',
  zValidator('json', chatRequestSchema),
  async (context) => {
    const harness = getHarness(context.req.param('harnessId'))

    if (!harness) {
      return context.json({ error: 'Harness not found.' }, 404)
    }

    if (harness.status !== 'compiled') {
      return context.json(
        { error: 'Compile the harness before using the test console.' },
        409,
      )
    }

    const settings = getSettings()

    try {
      return await createAssistantResponse({
        harness,
        messages: context.req.valid('json').messages,
        settings,
      })
    } catch (error) {
      return context.json(
        {
          error: error instanceof Error ? error.message : 'Assistant failed.',
        },
        400,
      )
    }
  },
)

serve(
  {
    fetch: app.fetch,
    port: 3001,
  },
  (info) => {
    console.log(`YunForge API listening on http://localhost:${info.port}`)
  },
)
