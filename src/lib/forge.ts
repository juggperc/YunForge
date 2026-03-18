import {
  buildForgeExport,
  ForgeExportSchema,
  type Harness,
} from '@shared/schema'

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export function createExportPayload(harness: Harness) {
  return buildForgeExport(harness)
}

export function downloadHarness(harness: Harness) {
  const payload = createExportPayload(harness)
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = `${harness.name.replace(/\s+/g, '-')}.forge.json`
  anchor.click()

  URL.revokeObjectURL(url)
}

export function encodeHarnessShareLink(harness: Harness) {
  const json = JSON.stringify(createExportPayload(harness))
  const bytes = new TextEncoder().encode(json)
  return `data:application/json;base64,${bytesToBase64(bytes)}`
}

export function parseForgeExportFromLink(value: string) {
  const trimmed = value.trim()

  if (!trimmed.startsWith('data:application/json;base64,')) {
    throw new Error('Share link must be a data URL produced by YunForge.')
  }

  const encoded = trimmed.slice('data:application/json;base64,'.length)
  const bytes = base64ToBytes(encoded)
  const json = new TextDecoder().decode(bytes)

  return ForgeExportSchema.parse(JSON.parse(json))
}

export async function parseForgeExportFromFile(file: File) {
  const text = await file.text()
  return ForgeExportSchema.parse(JSON.parse(text))
}
