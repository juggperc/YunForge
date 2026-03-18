import { MoreHorizontal, PackagePlus, Settings2, Share2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import type { Harness, SkillSpec } from '@shared/schema'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { formatTimestamp } from '@/lib/chat'
import { cn } from '@/lib/utils'

function SkillRow({
  skill,
  status,
  onEdit,
  onDelete,
}: {
  skill: SkillSpec
  status: 'active' | 'draft'
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-black/20 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm text-zinc-100">{skill.name}</div>
        <div className="truncate text-xs text-muted-foreground">
          {skill.description || 'Generated skill'}
        </div>
      </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-border/60 text-[10px] uppercase">
            {status}
          </Badge>
          <Button variant="ghost" size="xs" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="ghost" size="xs" onClick={onDelete}>
            Del
          </Button>
        </div>
    </div>
  )
}

export function Sidebar({
  harnesses,
  selectedHarnessId,
  onSelectHarness,
  onNewHarness,
  onDeleteHarness,
  onExportHarness,
  onCopyShareLink,
  onOpenImport,
  onOpenSettings,
  onEditSkill,
  onDeleteSkill,
}: {
  harnesses: Harness[]
  selectedHarnessId: string | null
  onSelectHarness: (id: string) => void
  onNewHarness: () => Promise<void>
  onDeleteHarness: (harness: Harness) => Promise<void>
  onExportHarness: (harness: Harness) => Promise<void>
  onCopyShareLink: (harness: Harness) => Promise<void>
  onOpenImport: () => void
  onOpenSettings: () => void
  onEditSkill: (harness: Harness, skill: SkillSpec) => void
  onDeleteSkill: (harness: Harness, skill: SkillSpec) => Promise<void>
}) {
  return (
    <aside className="flex h-full min-h-0 w-[260px] flex-col border-r border-border/70 bg-zinc-950/90">
      <div className="space-y-3 border-b border-border/70 px-4 py-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-blue-300">
            YunForge
          </div>
          <div className="mt-1 text-lg font-semibold text-zinc-50">
            Local Assistant Builder
          </div>
        </div>
        <div className="grid gap-2">
          <Button variant="outline" className="justify-start" onClick={onOpenImport}>
            <Upload className="size-4" />
            Import Agent
          </Button>
          <Button className="justify-start" onClick={onNewHarness}>
            <PackagePlus className="size-4" />
            New Harness
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {harnesses.map((harness) => {
            const selected = harness.id === selectedHarnessId

            return (
              <Collapsible key={harness.id} open={selected}>
                <div
                  className={cn(
                    'rounded-xl border transition-colors',
                    selected
                      ? 'border-blue-400/30 bg-blue-500/10'
                      : 'border-border/60 bg-black/20 hover:bg-card/70',
                  )}
                >
                  <div className="flex items-start gap-2 px-3 py-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelectHarness(harness.id)}
                    >
                      <div className="truncate text-sm font-medium text-zinc-100">
                        {harness.name}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {harness.spec.goal || 'No goal yet'}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-border/60 text-[10px] uppercase"
                        >
                          {harness.status}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {formatTimestamp(harness.updatedAt)}
                        </span>
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-black/20 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-44">
                        <DropdownMenuItem onClick={() => onExportHarness(harness)}>
                          Export Agent
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            await onCopyShareLink(harness)
                            toast.success('Share link copied to clipboard')
                          }}
                        >
                          <Share2 className="size-4" />
                          Copy Share Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDeleteHarness(harness)}
                        >
                          <Trash2 className="size-4" />
                          Delete Harness
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CollapsibleContent>
                    <Separator className="bg-border/60" />
                    <div className="space-y-2 p-3">
                      {harness.spec.tools.length ? (
                        harness.spec.tools.map((skill) => (
                          <SkillRow
                            key={`${harness.id}-${skill.name}`}
                            skill={skill}
                            status={harness.status === 'compiled' ? 'active' : 'draft'}
                            onEdit={() => onEditSkill(harness, skill)}
                            onDelete={() => onDeleteSkill(harness, skill)}
                          />
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
                          Generated skills will appear here.
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )
          })}
        </div>
      </ScrollArea>
      <div className="border-t border-border/70 p-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onOpenSettings}
        >
          <Settings2 className="size-4" />
          Settings
        </Button>
      </div>
    </aside>
  )
}
