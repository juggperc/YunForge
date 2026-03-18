import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { UIMessage } from 'ai'

import type { ForgeExport, Harness, SkillSpec } from '@shared/schema'

import { BuilderPanel } from '@/components/builder-panel'
import { ImportDialog } from '@/components/import-dialog'
import { SettingsSheet } from '@/components/settings-sheet'
import { Sidebar } from '@/components/sidebar'
import { SkillEditorDialog } from '@/components/skill-editor-dialog'
import { TestConsole } from '@/components/test-console'
import { Toaster } from '@/components/ui/sonner'
import { useSettings } from '@/context/settings-context'
import {
  createHarness,
  deleteHarnessById,
  fetchHarnesses,
  fetchHarnessExport,
  patchHarness,
} from '@/lib/api'
import { downloadHarness, encodeHarnessShareLink } from '@/lib/forge'

function LoadingScreen() {
  return (
    <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/80 px-4 py-3 shadow-panel">
        <Loader2 className="size-4 animate-spin text-blue-300" />
        <span>Loading local workspace…</span>
      </div>
    </div>
  )
}

function AppShell() {
  const { settings, ready } = useSettings()
  const [harnesses, setHarnesses] = useState<Harness[]>([])
  const [selectedHarnessId, setSelectedHarnessId] = useState<string | null>(null)
  const [builderMessages, setBuilderMessages] = useState<Record<string, UIMessage[]>>({})
  const [assistantMessages, setAssistantMessages] = useState<Record<string, UIMessage[]>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [editingSkill, setEditingSkill] = useState<{
    harnessId: string
    skillName: string
  } | null>(null)
  const didBootstrap = useRef(false)

  const selectedHarness =
    harnesses.find((harness) => harness.id === selectedHarnessId) ?? null
  const editingHarness =
    harnesses.find((harness) => harness.id === editingSkill?.harnessId) ?? null
  const editingSkillValue =
    editingHarness?.spec.tools.find((skill) => skill.name === editingSkill?.skillName) ??
    null

  async function refreshHarnesses(preferredId?: string | null) {
    const nextHarnesses = await fetchHarnesses()

    startTransition(() => {
      setHarnesses(nextHarnesses)

      if (preferredId && nextHarnesses.some((item) => item.id === preferredId)) {
        setSelectedHarnessId(preferredId)
        return
      }

      if (
        selectedHarnessId &&
        nextHarnesses.some((item) => item.id === selectedHarnessId)
      ) {
        return
      }

      setSelectedHarnessId(nextHarnesses[0]?.id ?? null)
    })
  }

  const bootstrapHarnesses = useEffectEvent(() => {
    refreshHarnesses().catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to load harnesses.')
    })
  })

  useEffect(() => {
    if (!ready || didBootstrap.current) {
      return
    }

    didBootstrap.current = true
    bootstrapHarnesses()
  }, [ready])

  async function handleCreateHarness() {
    const created = await createHarness()
    setHarnesses((current) => [created, ...current.filter((item) => item.id !== created.id)])
    setSelectedHarnessId(created.id)
    setBuilderMessages((current) => ({
      ...current,
      [created.id]: [],
    }))
    setAssistantMessages((current) => ({
      ...current,
      [created.id]: [],
    }))
  }

  async function handleDeleteHarness(harness: Harness) {
    await deleteHarnessById(harness.id)
    setBuilderMessages((current) => {
      const next = { ...current }
      delete next[harness.id]
      return next
    })
    setAssistantMessages((current) => {
      const next = { ...current }
      delete next[harness.id]
      return next
    })
    await refreshHarnesses()
  }

  async function handleImportAgent(payload: ForgeExport) {
    const created = await createHarness({
      importData: payload,
    })

    setHarnesses((current) => [created, ...current.filter((item) => item.id !== created.id)])
    setSelectedHarnessId(created.id)
  }

  async function handleExportHarness(harness: Harness) {
    const payload = await fetchHarnessExport(harness.id)
    downloadHarness({
      ...harness,
      spec: {
        ...harness.spec,
        tools: payload.tools,
      },
    })
  }

  async function handleCopyShareLink(harness: Harness) {
    const payload = await fetchHarnessExport(harness.id)
    const link = encodeHarnessShareLink({
      ...harness,
      spec: {
        ...harness.spec,
        tools: payload.tools,
      },
    })

    await navigator.clipboard.writeText(link)
  }

  async function handleCompileHarness() {
    if (!selectedHarness) {
      return
    }

    const updated = await patchHarness(selectedHarness.id, {
      status: 'compiled',
    })

    setHarnesses((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    )
    toast.success('Harness compiled for local testing')
  }

  async function handleDeleteSkill(harness: Harness, skill: SkillSpec) {
    const nextTools = harness.spec.tools.filter((item) => item.name !== skill.name)
    const updated = await patchHarness(harness.id, {
      spec: {
        ...harness.spec,
        tools: nextTools,
      },
      status: 'draft',
    })

    setHarnesses((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    )
    toast.success(`Deleted ${skill.name}`)
  }

  async function handleSaveSkillCode(nextCode: string) {
    if (!editingHarness || !editingSkillValue) {
      return
    }

    const updated = await patchHarness(editingHarness.id, {
      spec: {
        ...editingHarness.spec,
        tools: editingHarness.spec.tools.map((skill) =>
          skill.name === editingSkillValue.name ? { ...skill, code: nextCode } : skill,
        ),
      },
      status: 'draft',
    })

    setHarnesses((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    )
  }

  if (!ready) {
    return <LoadingScreen />
  }

  if (!selectedHarness) {
    return <LoadingScreen />
  }

  return (
    <>
      <div
        className="grid h-full min-h-0 bg-background"
        style={{
          gridTemplateColumns: rightCollapsed
            ? '260px minmax(0,1fr) 56px'
            : '260px minmax(0,1fr) 420px',
        }}
      >
        <Sidebar
          harnesses={harnesses}
          selectedHarnessId={selectedHarnessId}
          onSelectHarness={setSelectedHarnessId}
          onNewHarness={handleCreateHarness}
          onDeleteHarness={handleDeleteHarness}
          onExportHarness={handleExportHarness}
          onCopyShareLink={handleCopyShareLink}
          onOpenImport={() => setImportOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onEditSkill={(harness, skill) =>
            setEditingSkill({ harnessId: harness.id, skillName: skill.name })
          }
          onDeleteSkill={handleDeleteSkill}
        />
        <main className="min-h-0 overflow-hidden bg-zinc-950/30">
          <BuilderPanel
            key={selectedHarness.id}
            harness={selectedHarness}
            messages={builderMessages[selectedHarness.id] ?? []}
            onMessagesChange={(messages) =>
              setBuilderMessages((current) => ({
                ...current,
                [selectedHarness.id]: messages,
              }))
            }
            onHarnessRefresh={() => refreshHarnesses(selectedHarness.id)}
            disabled={!settings.openrouterKey.trim()}
          />
        </main>
        <TestConsole
          key={selectedHarness.id}
          harness={selectedHarness}
          messages={assistantMessages[selectedHarness.id] ?? []}
          onMessagesChange={(messages) =>
            setAssistantMessages((current) => ({
              ...current,
              [selectedHarness.id]: messages,
            }))
          }
          onCompile={handleCompileHarness}
          collapsed={rightCollapsed}
          onToggleCollapsed={() => setRightCollapsed((current) => !current)}
          disabled={!settings.openrouterKey.trim() || !settings.e2bKey.trim()}
        />
      </div>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={handleImportAgent}
      />
      <SkillEditorDialog
        harness={editingHarness}
        skill={editingSkillValue}
        open={Boolean(editingSkill)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSkill(null)
          }
        }}
        onSave={handleSaveSkillCode}
      />
      <Toaster position="top-right" richColors />
    </>
  )
}

export default function App() {
  return <AppShell />
}
