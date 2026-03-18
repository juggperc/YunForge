import type { UIMessage } from 'ai'
import {
  ChevronDown,
  TerminalSquare,
  UserRound,
  WandSparkles,
} from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  getMessageText,
  getReasoningText,
  getToolParts,
  type ToolMessagePart,
} from '@/lib/chat'

function stringifyPart(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function humanizeToolName(value: string) {
  return value
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function ToolTraceCard({
  part,
  toolNames,
}: {
  part: ToolMessagePart
  toolNames: Record<string, string>
}) {
  const toolKey =
    part.type === 'dynamic-tool' ? part.toolName : part.type.replace(/^tool-/, '')
  const displayName = toolNames[toolKey] || humanizeToolName(toolKey)

  return (
    <Collapsible
      className="rounded-lg border border-border/70 bg-black/20"
      defaultOpen={part.state === 'output-error'}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TerminalSquare className="size-3.5 text-blue-300" />
            <span className="truncate font-medium text-foreground">
              {displayName}
            </span>
            <Badge variant="outline" className="border-border/60 capitalize">
              {part.state.replace(/-/g, ' ')}
            </Badge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {part.state === 'output-error'
              ? 'Tool execution failed.'
              : 'Tool trace'}
          </div>
        </div>
        <ChevronDown className="size-4 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t border-border/60 px-3 py-3">
        {'input' in part && part.input !== undefined ? (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Input
            </div>
            <pre className="overflow-x-auto rounded-md bg-black/30 p-2 text-[11px] leading-5 text-zinc-200">
              {stringifyPart(part.input)}
            </pre>
          </div>
        ) : null}
        {'output' in part && part.output !== undefined ? (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Output
            </div>
            <pre className="overflow-x-auto rounded-md bg-black/30 p-2 text-[11px] leading-5 text-zinc-200">
              {stringifyPart(part.output)}
            </pre>
          </div>
        ) : null}
        {'errorText' in part && part.errorText ? (
          <div className="space-y-1">
            <div className="text-xs font-medium text-muted-foreground">
              Error
            </div>
            <pre className="overflow-x-auto rounded-md bg-red-500/10 p-2 text-[11px] leading-5 text-red-200">
              {part.errorText}
            </pre>
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ChatMessage({
  message,
  toolNames = {},
  compact = false,
  assistantLabel = 'Builder',
}: {
  message: UIMessage
  toolNames?: Record<string, string>
  compact?: boolean
  assistantLabel?: string
}) {
  const isUser = message.role === 'user'
  const text = getMessageText(message)
  const reasoning = getReasoningText(message)
  const toolParts = getToolParts(message)

  return (
    <div
      className={cn(
        'flex gap-3 px-4 py-3',
        compact ? 'py-2' : 'py-3',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser ? (
        <Avatar className="mt-1 border border-border/80 bg-zinc-900">
          <AvatarFallback className="bg-zinc-900 text-zinc-100">
            <WandSparkles className="size-4" />
          </AvatarFallback>
        </Avatar>
      ) : null}
      <div
        className={cn(
          'max-w-[92%] space-y-3',
          compact ? 'max-w-full' : '',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        <div
          className={cn(
            'rounded-[26px] border px-4 py-3 shadow-panel',
            isUser
              ? 'border-blue-400/30 bg-blue-500/10 text-zinc-50'
              : 'border-border/80 bg-card text-card-foreground',
          )}
        >
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {isUser ? (
              <>
                <UserRound className="size-3.5" />
                You
              </>
            ) : (
              <>
                <WandSparkles className="size-3.5" />
                {assistantLabel}
              </>
            )}
          </div>
          {text ? (
            <div className="whitespace-pre-wrap text-[16px] leading-7">{text}</div>
          ) : null}
          {reasoning ? (
            <div className="mt-3 rounded-lg border border-border/60 bg-black/10 p-2 text-xs text-muted-foreground">
              {reasoning}
            </div>
          ) : null}
        </div>
        {toolParts.length ? (
          <div className="space-y-2">
            {toolParts.map((part, index) => (
              <ToolTraceCard
                key={`${message.id}-${part.type}-${index}`}
                part={part}
                toolNames={toolNames}
              />
            ))}
          </div>
        ) : null}
      </div>
      {isUser ? (
        <Avatar className="mt-1 border border-border/80 bg-zinc-900">
          <AvatarFallback className="bg-zinc-900 text-zinc-100">U</AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  )
}
