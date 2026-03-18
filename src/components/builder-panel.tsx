import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { DefaultChatTransport } from 'ai'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { Bot, Send } from 'lucide-react'
import { toast } from 'sonner'

import type { Harness } from '@shared/schema'

import { ChatMessage } from '@/components/chat-message'
import { HarnessSummaryCard } from '@/components/harness-summary-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

export function BuilderPanel({
  harness,
  messages: initialMessages,
  onMessagesChange,
  onHarnessRefresh,
  disabled,
}: {
  harness: Harness
  messages: UIMessage[]
  onMessagesChange: (messages: UIMessage[]) => void
  onHarnessRefresh: () => Promise<void>
  disabled: boolean
}) {
  const [input, setInput] = useState('')
  const [summaryOpen, setSummaryOpen] = useState(true)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const transport = new DefaultChatTransport({
    api: '/api/builder',
    body: {
      harnessId: harness.id,
    },
  })

  const { messages, sendMessage, status, error } = useChat({
    id: `builder-${harness.id}`,
    messages: initialMessages,
    transport,
    onError: (value) => toast.error(value.message),
    onFinish: async ({ messages: nextMessages }) => {
      onMessagesChange(nextMessages)
      await onHarnessRefresh()
    },
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
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-blue-300" />
            <h2 className="text-sm font-semibold text-zinc-50">Builder Chat</h2>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Describe the assistant. Each turn patches the stored harness spec.
          </div>
        </div>
        <Badge variant="outline" className="border-border/60 uppercase">
          {status}
        </Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1 bg-zinc-950/35">
        <div className="flex min-h-full flex-col py-2">
          {messages.length ? (
            messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))
          ) : (
            <div className="m-4 rounded-2xl border border-dashed border-border/60 bg-black/20 p-4 text-sm text-muted-foreground">
              Start with a brief like "Build me a research copilot for policy memos"
              or "Add a skill that fetches live Polymarket odds."
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

            if (!input.trim() || disabled) {
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
              disabled
                ? 'Add your OpenRouter key in Settings to use the builder.'
                : 'Describe the assistant, audience, guardrails, or required skills...'
            }
            disabled={disabled || status === 'streaming'}
            className="min-h-24 bg-black/20 text-[16px] leading-7"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {error ? error.message : 'Harness status switches back to draft when the spec changes.'}
            </div>
            <Button disabled={disabled || status === 'streaming' || !input.trim()}>
              <Send className="size-4" />
              Send
            </Button>
          </div>
        </form>
        <HarnessSummaryCard
          harness={harness}
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
        />
      </div>
    </section>
  )
}
