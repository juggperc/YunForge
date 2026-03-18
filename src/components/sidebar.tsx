import {
  MoreHorizontal,
  PackagePlus,
  Settings2,
  Share2,
  Trash2,
  Upload,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

import type { Harness, SkillSpec } from '@shared/schema'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MagneticFrame } from '@/components/ui/magnetic-frame'
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
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-black/20 px-3 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm text-zinc-100">{skill.name}</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">
          {skill.description || 'Generated skill'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-border/60 capitalize">
          {status}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-xs" className="rounded-lg border border-border/60" />
            }
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-36">
            <DropdownMenuItem onClick={onEdit}>Edit Skill</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              Delete Skill
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
    <div className="flex h-full min-h-0 flex-col bg-zinc-950/95">
      <div className="space-y-3 border-b border-border/70 px-4 py-5 pr-14">
        <div className="font-heading text-xl text-zinc-50">Harness Library</div>
        <div className="text-sm text-muted-foreground">
          Switch agents, manage generated skills, and export portable snapshots.
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
          {harnesses.map((harness) => {
            const selected = harness.id === selectedHarnessId

            return (
              <Collapsible key={harness.id} open={selected}>
                <motion.div
                  layout
                  className={cn(
                    'surface-soft rounded-[26px] border transition-colors',
                    selected
                      ? 'border-blue-400/30 bg-blue-500/10'
                      : 'border-border/60 bg-black/20 hover:bg-card/70',
                  )}
                >
                  <div className="flex items-start gap-3 px-3 py-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelectHarness(harness.id)}
                    >
                      <div className="truncate text-sm text-zinc-100">{harness.name}</div>
                      <div className="mt-1 max-h-8 overflow-hidden text-xs text-muted-foreground">
                        {harness.spec.goal || 'No goal yet'}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-border/60 capitalize">
                          {harness.status}
                        </Badge>
                        <Badge variant="outline" className="border-border/60">
                          {harness.spec.tools.length} tools
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {formatTimestamp(harness.updatedAt)}
                        </span>
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-lg border border-border/60 bg-black/20"
                          />
                        }
                      >
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
                        <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-xs text-muted-foreground">
                          Generated skills will appear here.
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </motion.div>
              </Collapsible>
            )
          })}
        </div>
      </ScrollArea>

      <div className="grid gap-2 border-t border-border/70 p-4">
        <MagneticFrame>
          <Button variant="outline" className="justify-start" onClick={onOpenImport}>
            <Upload className="size-4" />
            Import Agent
          </Button>
        </MagneticFrame>
        <MagneticFrame>
          <Button className="justify-start" onClick={onNewHarness}>
            <PackagePlus className="size-4" />
            New Harness
          </Button>
        </MagneticFrame>
        <MagneticFrame>
          <Button variant="ghost" className="justify-start" onClick={onOpenSettings}>
            <Settings2 className="size-4" />
            Settings
          </Button>
        </MagneticFrame>
      </div>
    </div>
  )
}
