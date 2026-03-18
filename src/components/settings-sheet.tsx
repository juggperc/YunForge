import { useEffect, useState } from 'react'
import { KeyRound, ServerCog, Settings2 } from 'lucide-react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useSettings } from '@/context/settings-context'

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { settings, saveSetting } = useSettings()
  const [openrouterKey, setOpenrouterKey] = useState(settings.openrouterKey)
  const [e2bKey, setE2bKey] = useState(settings.e2bKey)
  const [defaultModel, setDefaultModel] = useState(settings.defaultModel)

  useEffect(() => {
    setOpenrouterKey(settings.openrouterKey)
    setE2bKey(settings.e2bKey)
    setDefaultModel(settings.defaultModel)
  }, [settings])

  async function persist(key: Parameters<typeof saveSetting>[0], value: string) {
    try {
      await saveSetting(key, value)
      toast.success('Saved locally to forge.db')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save setting.')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="border-l border-border/70 bg-zinc-950/95 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/70">
          <div className="flex items-center gap-2">
            <Settings2 className="size-4 text-blue-300" />
            <SheetTitle>Local Settings</SheetTitle>
          </div>
          <SheetDescription>
            Keys are stored locally in <code>forge.db</code> and used by the Hono API.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <KeyRound className="size-3.5" />
              OpenRouter API Key
            </div>
            <Input
              type="password"
              value={openrouterKey}
              onChange={(event) => setOpenrouterKey(event.target.value)}
              onBlur={() => persist('openrouter_key', openrouterKey)}
              placeholder="sk-or-v1-..."
              className="bg-black/20"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <KeyRound className="size-3.5" />
              E2B API Key
            </div>
            <Input
              type="password"
              value={e2bKey}
              onChange={(event) => setE2bKey(event.target.value)}
              onBlur={() => persist('e2b_key', e2bKey)}
              placeholder="e2b_..."
              className="bg-black/20"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <ServerCog className="size-3.5" />
              Default Model
            </div>
            <Input
              value={defaultModel}
              onChange={(event) => setDefaultModel(event.target.value)}
              onBlur={() => persist('default_model', defaultModel)}
              placeholder="deepseek/deepseek-chat"
              className="bg-black/20"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

