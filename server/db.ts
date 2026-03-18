import path from 'node:path'

import Database from 'better-sqlite3'

import {
  createEmptyHarnessSpec,
  DEFAULT_MODEL,
  deriveHarnessName,
  HarnessSchema,
  HarnessSpecSchema,
  type Harness,
  type HarnessSpec,
  type HarnessStatus,
  type Settings,
  type SettingsKey,
  SettingsSchema,
} from '../shared/schema.ts'

const databasePath = path.resolve(process.cwd(), 'forge.db')
const database = new Database(databasePath)

database.pragma('journal_mode = WAL')
database.pragma('foreign_keys = ON')

database.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS harnesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    spec TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)

type HarnessRow = {
  id: string
  name: string
  spec: string
  status: string
  created_at: string
  updated_at: string
}

const listHarnessesStatement = database.prepare(`
  SELECT id, name, spec, status, created_at, updated_at
  FROM harnesses
  ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
`)

const getHarnessStatement = database.prepare(`
  SELECT id, name, spec, status, created_at, updated_at
  FROM harnesses
  WHERE id = ?
`)

const insertHarnessStatement = database.prepare(`
  INSERT INTO harnesses (id, name, spec, status, created_at, updated_at)
  VALUES (@id, @name, @spec, @status, @created_at, @updated_at)
`)

const updateHarnessStatement = database.prepare(`
  UPDATE harnesses
  SET name = @name,
      spec = @spec,
      status = @status,
      updated_at = @updated_at
  WHERE id = @id
`)

const deleteHarnessStatement = database.prepare(`
  DELETE FROM harnesses
  WHERE id = ?
`)

const listHarnessNamesStatement = database.prepare(`
  SELECT id, name FROM harnesses
`)

const listSettingsStatement = database.prepare(`
  SELECT key, value
  FROM settings
`)

const upsertSettingStatement = database.prepare(`
  INSERT INTO settings (key, value)
  VALUES (@key, @value)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`)

function serializeSpec(spec: HarnessSpec) {
  return JSON.stringify(HarnessSpecSchema.parse(spec))
}

function parseHarness(row: HarnessRow): Harness {
  return HarnessSchema.parse({
    id: row.id,
    name: row.name,
    spec: JSON.parse(row.spec),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

function nowIso() {
  return new Date().toISOString()
}

export function getSettings(): Settings {
  const rows = listSettingsStatement.all() as Array<{ key: string; value: string }>

  const mapped = rows.reduce<Record<string, string>>((accumulator, row) => {
    accumulator[row.key] = row.value
    return accumulator
  }, {})

  return SettingsSchema.parse({
    openrouterKey: mapped.openrouter_key ?? '',
    e2bKey: mapped.e2b_key ?? '',
    defaultModel: mapped.default_model ?? DEFAULT_MODEL,
  })
}

export function saveSetting(key: SettingsKey, value: string) {
  upsertSettingStatement.run({
    key,
    value,
  })

  return getSettings()
}

export function listHarnesses() {
  return (listHarnessesStatement.all() as HarnessRow[]).map(parseHarness)
}

export function getHarness(id: string) {
  const row = getHarnessStatement.get(id) as HarnessRow | undefined
  return row ? parseHarness(row) : null
}

function uniqueHarnessName(requestedName: string, excludeId?: string) {
  const existing = listHarnessNamesStatement.all() as Array<{
    id: string
    name: string
  }>
  const names = new Set(
    existing
      .filter((row) => row.id !== excludeId)
      .map((row) => row.name.toLowerCase()),
  )

  const baseName = requestedName.trim() || 'Untitled Harness'

  if (!names.has(baseName.toLowerCase())) {
    return baseName
  }

  let suffix = 2
  while (names.has(`${baseName} ${suffix}`.toLowerCase())) {
    suffix += 1
  }

  return `${baseName} ${suffix}`
}

export function createHarness(input?: {
  name?: string
  spec?: HarnessSpec
  status?: HarnessStatus
}) {
  const settings = getSettings()
  const timestamp = nowIso()
  const spec = HarnessSpecSchema.parse(
    input?.spec ?? createEmptyHarnessSpec(settings.defaultModel),
  )
  const name = uniqueHarnessName(
    input?.name?.trim() || deriveHarnessName(spec.goal),
  )

  const record = {
    id: crypto.randomUUID(),
    name,
    spec: serializeSpec(spec),
    status: input?.status ?? 'draft',
    created_at: timestamp,
    updated_at: timestamp,
  }

  insertHarnessStatement.run(record)
  return getHarness(record.id)
}

export function updateHarness(
  id: string,
  patch: Partial<{
    name: string
    spec: HarnessSpec
    status: HarnessStatus
  }>,
) {
  const current = getHarness(id)

  if (!current) {
    return null
  }

  const nextSpec = patch.spec
    ? HarnessSpecSchema.parse(patch.spec)
    : current.spec
  const nextName = uniqueHarnessName(
    patch.name?.trim() || current.name,
    current.id,
  )

  updateHarnessStatement.run({
    id,
    name: nextName,
    spec: serializeSpec(nextSpec),
    status: patch.status ?? current.status,
    updated_at: nowIso(),
  })

  return getHarness(id)
}

export function deleteHarness(id: string) {
  return deleteHarnessStatement.run(id).changes > 0
}

export function ensureHarnessExists() {
  const first = database
    .prepare('SELECT id FROM harnesses ORDER BY datetime(created_at) ASC LIMIT 1')
    .get() as { id: string } | undefined

  if (first) {
    return getHarness(first.id)
  }

  return createHarness()
}

export { databasePath }
