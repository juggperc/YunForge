import { useEffect, useState } from 'react'
import { Code2 } from 'lucide-react'
import { toast } from 'sonner'

import type { Harness, SkillSpec } from '@shared/schema'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

export function SkillEditorDialog({
  harness,
  skill,
  open,
  onOpenChange,
  onSave,
}: {
  harness: Harness | null
  skill: SkillSpec | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (nextCode: string) => Promise<void>
}) {
  const [code, setCode] = useState(skill?.code ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCode(skill?.code ?? '')
  }, [skill])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl border border-border/70 bg-zinc-950/95 p-0">
        <DialogHeader className="border-b border-border/70 p-4">
          <div className="flex items-center gap-2">
            <Code2 className="size-4 text-blue-300" />
            <DialogTitle>Edit Skill Code</DialogTitle>
          </div>
          <DialogDescription>
            {skill?.name || 'Generated skill'} on {harness?.name || 'selected harness'}.
          </DialogDescription>
        </DialogHeader>
        <div className="p-4">
          <Textarea
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="min-h-[420px] bg-black/20 font-mono text-[12px] leading-6"
            spellCheck={false}
          />
        </div>
        <DialogFooter className="border-t border-border/70 bg-zinc-950/90">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            disabled={busy || !skill}
            onClick={async () => {
              setBusy(true)

              try {
                await onSave(code)
                toast.success('Skill code saved to SQLite')
                onOpenChange(false)
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Save failed.')
              } finally {
                setBusy(false)
              }
            }}
          >
            Save Code
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

