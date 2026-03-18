import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import { DEFAULT_MODEL, type Settings, type SettingsKey } from '@shared/schema'

import { fetchSettings, patchSetting } from '@/lib/api'

type SettingsContextValue = {
  settings: Settings
  ready: boolean
  saveSetting: (key: SettingsKey, value: string) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

const defaultSettings: Settings = {
  openrouterKey: '',
  e2bKey: '',
  defaultModel: DEFAULT_MODEL,
  mcpServersJson: '[]',
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetchSettings()
      .then((value) => {
        if (!cancelled) {
          setSettings(value)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function saveSettingValue(key: SettingsKey, value: string) {
    const previous = settings

    setSettings((current) => ({
      ...current,
      openrouterKey:
        key === 'openrouter_key' ? value : current.openrouterKey,
      e2bKey: key === 'e2b_key' ? value : current.e2bKey,
      defaultModel: key === 'default_model' ? value : current.defaultModel,
      mcpServersJson:
        key === 'mcp_servers_json' ? value : current.mcpServersJson,
    }))

    try {
      const updated = await patchSetting(key, value)
      setSettings(updated)
    } catch (error) {
      setSettings(previous)
      throw error
    }
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        ready,
        saveSetting: saveSettingValue,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)

  if (!context) {
    throw new Error('useSettings must be used inside SettingsProvider.')
  }

  return context
}
