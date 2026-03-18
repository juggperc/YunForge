import { useState } from 'react'
import { Download, Link2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import type { ForgeExport } from '@shared/schema'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { parseForgeExportFromFile, parseForgeExportFromLink } from '@/lib/forge'

export function ImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (payload: ForgeExport) => Promise<void>
}) {
  const [shareLink, setShareLink] = useState('')
  const [busy, setBusy] = useState(false)

  async function importPayload(payload: ForgeExport) {
    setBusy(true)

    try {
      await onImport(payload)
      toast.success('Agent imported into SQLite')
      setShareLink('')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border border-border/70 bg-zinc-950/95 p-0">
        <DialogHeader className="border-b border-border/70 p-4">
          <DialogTitle>Import Agent</DialogTitle>
          <DialogDescription>
            Load a portable <code>.forge.json</code> file or paste a YunForge share link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-4">
          <div className="rounded-xl border border-dashed border-border/70 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <Upload className="size-3.5" />
              Import From File
            </div>
            <Input
              type="file"
              accept=".forge.json,application/json"
              className="cursor-pointer bg-black/20"
              disabled={busy}
              onChange={async (event) => {
                const file = event.target.files?.[0]

                if (!file) {
                  return
                }

                try {
                  const payload = await parseForgeExportFromFile(file)
                  await importPayload(payload)
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : 'Import failed.',
                  )
                }
                event.target.value = ''
              }}
            />
          </div>
          <div className="rounded-xl border border-border/70 bg-black/20 p-4">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <Link2 className="size-3.5" />
              Import From Link
            </div>
            <Input
              value={shareLink}
              onChange={(event) => setShareLink(event.target.value)}
              placeholder="data:application/json;base64,..."
              className="bg-black/20"
              disabled={busy}
            />
          </div>
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
            onClick={async () => {
              try {
                const payload = parseForgeExportFromLink(shareLink)
                await importPayload(payload)
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : 'Import failed.',
                )
              }
            }}
            disabled={busy || !shareLink.trim()}
          >
            <Download className="size-4" />
            Import Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
