import type {
  ForgeExport,
  Harness,
  HarnessSpec,
  HarnessStatus,
  Settings,
  SettingsKey,
} from '@shared/schema'

async function request<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init)

  if (!response.ok) {
    let message = 'Request failed.'

    try {
      const data = (await response.json()) as { error?: string }
      message = data.error || message
    } catch {
      message = (await response.text()) || message
    }

    throw new Error(message)
  }

  return (await response.json()) as T
}

export function fetchSettings() {
  return request<Settings>('/api/settings')
}

export function patchSetting(key: SettingsKey, value: string) {
  return request<Settings>('/api/settings', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ key, value }),
  })
}

export function fetchHarnesses() {
  return request<Harness[]>('/api/harness')
}

export function createHarness(payload?: {
  name?: string
  spec?: HarnessSpec
  status?: HarnessStatus
  importData?: ForgeExport
}) {
  return request<Harness>('/api/harness', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  })
}

export function patchHarness(
  id: string,
  payload: Partial<{
    name: string
    spec: HarnessSpec
    status: HarnessStatus
  }>,
) {
  return request<Harness>(`/api/harness/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export async function deleteHarnessById(id: string) {
  await request<{ ok: true }>(`/api/harness/${id}`, {
    method: 'DELETE',
  })
}

export function fetchHarnessExport(id: string) {
  return request<ForgeExport>(`/api/harness/${id}/export`)
}

