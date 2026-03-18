import type { UIMessage } from 'ai'

export type ToolMessagePart = Extract<
  UIMessage['parts'][number],
  { type: 'dynamic-tool' } | { type: `tool-${string}` }
>

export function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')
    .trim()
}

export function getReasoningText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === 'reasoning')
    .map((part) => part.text)
    .join('')
    .trim()
}

export function getToolParts(message: UIMessage) {
  return message.parts.filter(
    (part): part is ToolMessagePart =>
      part.type === 'dynamic-tool' || part.type.startsWith('tool-'),
  )
}

export function formatTimestamp(value: string) {
  const date = new Date(value)
  const now = Date.now()
  const diffMinutes = Math.round((now - date.getTime()) / 60000)

  if (diffMinutes < 1) {
    return 'just now'
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }

  const diffHours = Math.round(diffMinutes / 60)

  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  return date.toLocaleDateString()
}
