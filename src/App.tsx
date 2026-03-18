import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Bot,
  FileCode2,
  Loader2,
  PackagePlus,
  Play,
  Settings2,
  Sparkles,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { UIMessage } from 'ai'

import {
  resolveModelSelection,
  type ForgeExport,
  type Harness,
  type SkillSpec,
} from '@shared/schema'

import { BuilderPanel } from '@/components/builder-panel'
import { HarnessSummaryCard } from '@/components/harness-summary-card'
import { ImportDialog } from '@/components/import-dialog'
import { SettingsSheet } from '@/components/settings-sheet'
import { Sidebar } from '@/components/sidebar'
import { SkillEditorDialog } from '@/components/skill-editor-dialog'
import { TestConsole } from '@/components/test-console'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { MagneticFrame } from '@/components/ui/magnetic-frame'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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

function RailAction({
  icon: Icon,
  label,
  onClick,
  active = false,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void | Promise<void>
  active?: boolean
}) {
  return (
    <MagneticFrame>
      <Button
        variant={active ? 'secondary' : 'ghost'}
        className="h-auto w-full flex-col gap-2 rounded-2xl px-0 py-3 text-[11px]"
        onClick={onClick}
      >
        <Icon className="size-4" />
        <span>{label}</span>
      </Button>
    </MagneticFrame>
  )
}

function HarnessSpecPanel({
  harness,
  defaultModel,
  onOpenLibrary,
}: {
  harness: Harness
  defaultModel: string
  onOpenLibrary: () => void
}) {
  const [summaryOpen, setSummaryOpen] = useState(true)

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950/95">
      <SheetHeader className="border-b border-border/70 pr-14">
        <div className="flex items-center gap-2">
          <FileCode2 className="size-4 text-blue-300" />
          <SheetTitle>Harness Spec</SheetTitle>
        </div>
        <SheetDescription>
          Review the live spec snapshot and generated skills without shrinking the
          builder canvas.
        </SheetDescription>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          <HarnessSummaryCard
            harness={harness}
            defaultModel={defaultModel}
            open={summaryOpen}
            onOpenChange={setSummaryOpen}
          />
          <Card size="sm" className="border border-border/70 bg-black/20 shadow-none">
            <CardHeader className="border-b border-border/60">
              <CardTitle>Generated Skills</CardTitle>
              <CardDescription>
                Edit or delete skills from the harness library panel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 pb-4">
              {harness.spec.tools.length ? (
                harness.spec.tools.map((skill) => (
                  <div
                    key={`${harness.id}-${skill.name}`}
                    className="rounded-xl border border-border/70 bg-card/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-zinc-50">{skill.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {skill.description || 'Generated skill'}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-border/70 bg-black/20 capitalize"
                      >
                        {harness.status === 'compiled' ? 'active' : 'draft'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border/70 bg-black/20 px-3 py-4 text-xs text-muted-foreground">
                  Generated skills will appear here after the builder creates them.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
      <div className="border-t border-border/70 p-4">
        <Button variant="outline" className="w-full" onClick={onOpenLibrary}>
          <Bot className="size-4" />
          Open Harness Library
        </Button>
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
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [specOpen, setSpecOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<{
    harnessId: string
    skillName: string
  } | null>(null)
  const didBootstrap = useRef(false)
  const previousDefaultModelRef = useRef(settings.defaultModel)

  const selectedHarness =
    harnesses.find((harness) => harness.id === selectedHarnessId) ?? null
  const selectedHarnessModel = selectedHarness
    ? resolveModelSelection(selectedHarness.spec.model, settings.defaultModel)
    : settings.defaultModel
  const editingHarness =
    harnesses.find((harness) => harness.id === editingSkill?.harnessId) ?? null
  const editingSkillValue =
    editingHarness?.spec.tools.find((skill) => skill.name === editingSkill?.skillName) ??
    null
  const assistantDisabledReason = !settings.openrouterKey.trim()
    ? 'Add your OpenRouter API key before testing.'
    : selectedHarness?.spec.tools.length && !settings.e2bKey.trim()
      ? 'This harness has generated JavaScript skills. Add your E2B API key before testing.'
      : null

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

  useEffect(() => {
    if (!ready) {
      return
    }

    const previousModel = previousDefaultModelRef.current
    const nextModel = settings.defaultModel.trim()

    if (!nextModel || previousModel === nextModel) {
      previousDefaultModelRef.current = nextModel || previousModel
      return
    }

    setHarnesses((current) =>
      current.map((harness) => {
        const currentModel = harness.spec.model.trim()

        if (currentModel && currentModel !== previousModel) {
          return harness
        }

        return {
          ...harness,
          spec: {
            ...harness.spec,
            model: nextModel,
          },
        }
      }),
    )

    previousDefaultModelRef.current = nextModel
  }, [ready, settings.defaultModel])

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

  async function handleOpenTestConsole() {
    if (!selectedHarness) {
      return
    }

    if (selectedHarness.status !== 'compiled') {
      await handleCompileHarness()
    }

    setTestOpen(true)
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
      <div className="flex h-full min-h-0 bg-background">
        <aside className="flex h-full w-[88px] flex-col justify-between border-r border-border/70 bg-zinc-950/92 px-3 py-4">
          <div className="space-y-4">
            <div className="surface-soft rounded-[26px] border border-border/70 px-3 py-4 text-center">
              <div className="font-heading text-sm text-blue-300">YF</div>
              <div className="mt-2 text-xs text-zinc-50">Forge</div>
            </div>
            <div className="space-y-2">
              <RailAction
                icon={Bot}
                label="Agents"
                active={libraryOpen}
                onClick={() => setLibraryOpen(true)}
              />
              <RailAction
                icon={PackagePlus}
                label="New"
                onClick={() => {
                  handleCreateHarness().catch((error) => {
                    toast.error(
                      error instanceof Error ? error.message : 'Failed to create harness.',
                    )
                  })
                }}
              />
              <RailAction
                icon={Upload}
                label="Import"
                onClick={() => setImportOpen(true)}
              />
            </div>
          </div>
          <div className="space-y-3">
            <motion.div
              layout
              className="surface-soft rounded-[28px] border border-border/70 px-2 py-2.5 text-center"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-[18px] border border-border/70 bg-black/25 font-heading text-sm text-zinc-50">
                {selectedHarness.name
                  .split(/\s+/g)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? '')
                  .join('')}
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="inline-flex size-1.5 rounded-full bg-emerald-300" />
                active
              </div>
            </motion.div>
            <RailAction
              icon={Settings2}
              label="Settings"
              active={settingsOpen}
              onClick={() => setSettingsOpen(true)}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden bg-zinc-950/30">
          <div className="flex h-full min-h-0 flex-col">
            <header className="border-b border-border/70 bg-background/92 px-4 py-4">
              <motion.div
                layout
                className="surface-panel mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-[28px] border border-border/70 px-5 py-4"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-blue-300">
                    <Sparkles className="size-3.5" />
                    Builder workspace
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="font-heading truncate text-2xl text-zinc-50 md:text-[2rem]">
                      {selectedHarness.name}
                    </h1>
                    <Badge variant="outline" className="border-border/70 capitalize">
                      {selectedHarness.status}
                    </Badge>
                  </div>
                  <div className="max-w-4xl truncate text-sm text-muted-foreground">
                    {selectedHarness.spec.goal
                      ? selectedHarness.spec.goal
                      : 'Describe the assistant you want to build. Spec review, harness management, and testing stay tucked into side panels.'}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/70 bg-black/15 px-2.5 py-1 text-zinc-100">
                      model {selectedHarnessModel}
                    </span>
                    <span className="rounded-full border border-border/70 bg-black/15 px-2.5 py-1 text-zinc-100">
                      {selectedHarness.spec.tools.length} tools
                    </span>
                    {selectedHarness.spec.audience ? (
                      <span className="max-w-[24rem] truncate rounded-full border border-border/70 bg-black/15 px-2.5 py-1">
                        {selectedHarness.spec.audience}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <MagneticFrame>
                    <Button variant="outline" onClick={() => setSpecOpen(true)}>
                      <FileCode2 className="size-4" />
                      Spec
                    </Button>
                  </MagneticFrame>
                  <MagneticFrame disabled={Boolean(assistantDisabledReason)}>
                    <Button
                      onClick={() => {
                        handleOpenTestConsole().catch((error) => {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : 'Failed to open test console.',
                          )
                        })
                      }}
                      disabled={Boolean(assistantDisabledReason)}
                    >
                      <Play className="size-4" />
                      {selectedHarness.status === 'compiled'
                        ? 'Open Test Console'
                        : 'Compile & Test'}
                    </Button>
                  </MagneticFrame>
                </div>
              </motion.div>
            </header>

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
          </div>
        </main>
      </div>

      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent
          side="left"
          className="w-[380px] border-r border-border/70 bg-zinc-950/95 p-0 sm:max-w-[380px]"
        >
          <Sidebar
            harnesses={harnesses}
            selectedHarnessId={selectedHarnessId}
            onSelectHarness={(id) => {
              setSelectedHarnessId(id)
              setLibraryOpen(false)
            }}
            onNewHarness={async () => {
              await handleCreateHarness()
              setLibraryOpen(false)
            }}
            onDeleteHarness={handleDeleteHarness}
            onExportHarness={handleExportHarness}
            onCopyShareLink={handleCopyShareLink}
            onOpenImport={() => {
              setLibraryOpen(false)
              setImportOpen(true)
            }}
            onOpenSettings={() => {
              setLibraryOpen(false)
              setSettingsOpen(true)
            }}
            onEditSkill={(harness, skill) =>
              setEditingSkill({ harnessId: harness.id, skillName: skill.name })
            }
            onDeleteSkill={handleDeleteSkill}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={specOpen} onOpenChange={setSpecOpen}>
        <SheetContent
          side="right"
          className="w-[440px] border-l border-border/70 bg-zinc-950/95 p-0 sm:max-w-[440px]"
        >
          <HarnessSpecPanel
            harness={selectedHarness}
            defaultModel={settings.defaultModel}
            onOpenLibrary={() => {
              setSpecOpen(false)
              setLibraryOpen(true)
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={testOpen} onOpenChange={setTestOpen}>
        <SheetContent
          side="right"
          className="w-[min(720px,calc(100vw-88px))] border-l border-border/70 bg-zinc-950/95 p-0 sm:max-w-none"
        >
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
            disabledReason={assistantDisabledReason}
          />
        </SheetContent>
      </Sheet>

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
