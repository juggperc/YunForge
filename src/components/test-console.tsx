import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { DefaultChatTransport } from 'ai'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { FlaskConical, Play, Send } from 'lucide-react'
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
  disabled,
}: {
  harness: Harness
  messages: UIMessage[]
  onMessagesChange: (messages: UIMessage[]) => void
  onCompile: () => Promise<void>
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

  return (
    <section className="flex h-full min-h-0 flex-col bg-zinc-950/95">
      <div className="border-b border-border/70 px-5 py-5 pr-14">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="size-4 text-emerald-300" />
              <h2 className="text-sm text-zinc-50">Live Test Console</h2>
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              Run the compiled assistant here and inspect inline tool traces
              without docking a permanent side panel.
            </div>
          </div>
          <Badge variant="outline" className="border-border/60 uppercase">
            {harness.status}
          </Badge>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
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

      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-5 py-6">
          {messages.length ? (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                compact
                toolNames={toolNames}
                assistantLabel="Assistant"
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-black/20 p-5 text-sm text-muted-foreground">
              Compile the current harness, then run sample prompts here to inspect
              tool calls, traces, and model responses.
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border/70 bg-zinc-950/88 px-5 py-5">
        <form
          className="mx-auto w-full max-w-4xl space-y-3"
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
            className="min-h-28 rounded-[28px] border-border/80 bg-card/70 px-5 py-4 text-[15px] leading-7 shadow-none"
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
              className="rounded-2xl px-4"
            >
              <Send className="size-4" />
              Send
            </Button>
          </div>
        </form>
      </div>
    </section>
  )
}
