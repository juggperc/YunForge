import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { DefaultChatTransport } from 'ai'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { ChevronLeft, FlaskConical, Play, Send } from 'lucide-react'
import { toast } from 'sonner'

import type { Harness } from '@shared/schema'

import { ChatMessage } from '@/components/chat-message'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

export function TestConsole({
  harness,
  messages: initialMessages,
  onMessagesChange,
  onCompile,
  collapsed,
  onToggleCollapsed,
  disabled,
}: {
  harness: Harness
  messages: UIMessage[]
  onMessagesChange: (messages: UIMessage[]) => void
  onCompile: () => Promise<void>
  collapsed: boolean
  onToggleCollapsed: () => void
  disabled: boolean
}) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const toolNames = Object.fromEntries(
    harness.spec.tools.map((skill, index) => [
      skill.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || `skill_${index + 1}`,
      skill.name,
    ]),
  )

  const { messages, sendMessage, status } = useChat({
    id: `assistant-${harness.id}`,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: `/api/assistant/${harness.id}`,
    }),
    onError: (value) => toast.error(value.message),
  })

  const syncMessages = useEffectEvent((nextMessages: UIMessage[]) => {
    onMessagesChange(nextMessages)
  })

  useEffect(() => {
    syncMessages(messages)
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (collapsed) {
    return (
      <aside className="flex h-full w-14 flex-col items-center border-l border-border/70 bg-zinc-950/90 py-4">
        <Button variant="ghost" size="icon-sm" onClick={onToggleCollapsed}>
          <ChevronLeft className="size-4 rotate-180" />
        </Button>
        <div className="mt-4 -rotate-90 whitespace-nowrap text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Test Console
        </div>
      </aside>
    )
  }

  return (
    <aside className="flex h-full min-h-0 w-[420px] flex-col border-l border-border/70 bg-zinc-950/90">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-emerald-300" />
            <h2 className="text-sm font-semibold text-zinc-50">Live Test Console</h2>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Chat with the compiled assistant and inspect inline tool traces.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-border/60 uppercase">
            {harness.status}
          </Badge>
          <Button variant="ghost" size="icon-sm" onClick={onToggleCollapsed}>
            <ChevronLeft className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="text-xs text-muted-foreground">
          {disabled
            ? 'Add both API keys before testing.'
            : harness.status === 'compiled'
              ? 'Compiled and ready.'
              : 'Compile after builder changes to refresh the assistant.'}
        </div>
        <Button
          variant={harness.status === 'compiled' ? 'secondary' : 'default'}
          onClick={onCompile}
          disabled={disabled}
        >
          <Play className="size-4" />
          Compile & Test
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 bg-zinc-950/35">
        <div className="flex min-h-full flex-col py-2">
          {messages.length ? (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                compact
                toolNames={toolNames}
              />
            ))
          ) : (
            <div className="m-4 rounded-2xl border border-dashed border-border/60 bg-black/20 p-4 text-sm text-muted-foreground">
              Compile the current harness, then run sample prompts here to inspect
              tool calls and responses.
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="space-y-3 border-t border-border/70 bg-zinc-950/85 px-4 py-4">
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault()

            if (!input.trim() || harness.status !== 'compiled' || disabled) {
              return
            }

            const value = input
            setInput('')
            await sendMessage({ text: value })
          }}
        >
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              harness.status === 'compiled'
                ? 'Run a test conversation against the compiled harness...'
                : 'Compile the harness to enable testing.'
            }
            disabled={disabled || harness.status !== 'compiled' || status === 'streaming'}
            className="min-h-24 bg-black/20 text-[16px] leading-7"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              Tool traces appear inline under assistant messages.
            </div>
            <Button
              type="submit"
              disabled={
                disabled ||
                harness.status !== 'compiled' ||
                status === 'streaming' ||
                !input.trim()
              }
            >
              <Send className="size-4" />
              Send
            </Button>
          </div>
        </form>
      </div>
    </aside>
  )
}
