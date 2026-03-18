import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { DefaultChatTransport } from 'ai'
import { useChat, type UIMessage } from '@ai-sdk/react'
import { AnimatePresence, motion } from 'framer-motion'
import { Send } from 'lucide-react'
import { toast } from 'sonner'

import type { Harness } from '@shared/schema'

import { ChatMessage } from '@/components/chat-message'
import { Button } from '@/components/ui/button'
import { MagneticFrame } from '@/components/ui/magnetic-frame'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ShimmerText } from '@/components/ui/shimmer-text'
import { Textarea } from '@/components/ui/textarea'

const starterPrompts = [
  'Build me a research copilot for policy memos with citation-focused answers.',
  'Create an assistant that monitors live Polymarket odds and explains the moves.',
  'I need a support copilot for onboarding docs, FAQs, and internal SOPs.',
  'Make a crypto research assistant with tool skills for live market and news lookups.',
]

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
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-6 py-8">
          {messages.length ? (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-1">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <AnimatePresence>
                {status === 'streaming' ? (
                  <ShimmerText
                    key="builder-shimmer"
                    label="forging the next spec pass"
                    className="px-4 py-5"
                  />
                ) : null}
              </AnimatePresence>
              <div ref={bottomRef} />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                className="w-full max-w-4xl space-y-6 text-center"
              >
                <div className="space-y-3">
                  <div className="text-sm text-blue-300">Builder Chat</div>
                  <div className="font-heading text-3xl text-zinc-50 md:text-4xl">
                    What assistant do you want to forge?
                  </div>
                  <div className="mx-auto max-w-2xl text-sm text-muted-foreground">
                    Describe the goal, audience, guardrails, and live tools you
                    need. Harness management, spec review, and testing are tucked
                    into side panels so the builder stays visible.
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {starterPrompts.map((prompt, index) => (
                    <motion.div
                      key={prompt}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        type: 'spring',
                        stiffness: 120,
                        damping: 18,
                        delay: index * 0.06,
                      }}
                    >
                      <MagneticFrame>
                        <Button
                          type="button"
                          variant="outline"
                          className="surface-soft h-auto w-full justify-start whitespace-normal rounded-2xl border-border/70 px-4 py-4 text-left leading-6"
                          onClick={() => setInput(prompt)}
                        >
                          {prompt}
                        </Button>
                      </MagneticFrame>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border/70 bg-zinc-950/88 px-6 py-5">
        <form
          className="mx-auto w-full max-w-4xl space-y-3"
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
                : `Describe what ${harness.name} should do, who it serves, and what skills it needs...`
            }
            disabled={disabled || status === 'streaming'}
            className="min-h-32 rounded-[28px] border-border/80 bg-card/70 px-5 py-4 text-[15px] leading-7 shadow-none"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {error
                ? error.message
                : 'Harness status switches back to draft whenever the spec changes.'}
            </div>
            <MagneticFrame disabled={disabled || status === 'streaming' || !input.trim()}>
              <Button
                type="submit"
                disabled={disabled || status === 'streaming' || !input.trim()}
                className="rounded-2xl px-4"
              >
                <Send className="size-4" />
                Send
              </Button>
            </MagneticFrame>
          </div>
        </form>
      </div>
    </section>
  )
}
