import { ChevronDown, Cpu, FileCode2, LockKeyhole, Sparkles } from 'lucide-react'

import type { Harness } from '@shared/schema'

import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function HarnessSummaryCard({
  harness,
  open,
  onOpenChange,
}: {
  harness: Harness
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card size="sm" className="border border-border/70 bg-black/20 shadow-none">
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Live HarnessSpec</CardTitle>
              <div className="mt-1 text-xs text-muted-foreground">
                Updates after each builder turn
              </div>
            </div>
            <CollapsibleTrigger className="inline-flex items-center gap-2 rounded-md border border-border/70 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40">
              {open ? 'Hide' : 'Show'}
              <ChevronDown className="size-3.5" />
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="grid gap-3 pb-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-card/60 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Sparkles className="size-3.5" />
                  Goal
                </div>
                <div className="text-sm text-zinc-100">
                  {harness.spec.goal || 'Waiting for a brief.'}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-card/60 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Cpu className="size-3.5" />
                  Audience
                </div>
                <div className="text-sm text-zinc-100">
                  {harness.spec.audience || 'Not pinned yet.'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-border/70 bg-card/60">
                Model: {harness.spec.model || 'unset'}
              </Badge>
              <Badge variant="outline" className="border-border/70 bg-card/60">
                Tools: {harness.spec.tools.length}
              </Badge>
              <Badge
                variant="outline"
                className="border-border/70 bg-card/60 capitalize"
              >
                Status: {harness.status}
              </Badge>
            </div>
            <div className="rounded-lg border border-border/70 bg-card/60 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <LockKeyhole className="size-3.5" />
                Memory Policy
              </div>
              <div className="text-sm text-zinc-100">
                {harness.spec.memoryPolicy || 'Session-local by default.'}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-card/60 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <FileCode2 className="size-3.5" />
                System Prompt
              </div>
              <div className="max-h-32 overflow-auto whitespace-pre-wrap text-sm text-zinc-100">
                {harness.spec.systemPrompt || 'System prompt will appear here.'}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
