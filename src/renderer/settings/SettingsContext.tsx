import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type ThemeSetting
} from '@shared/ipc-types'
import {
  applyDocumentTheme,
  resolveTheme,
  watchSystemTheme,
  type ResolvedTheme
} from '../theme'
import { TerminalRegistry } from '../terminal/TerminalRegistry'

interface SettingsContextValue {
  /** Null until the initial getSettings() resolves. */
  settings: AppSettings | null
  resolvedTheme: ResolvedTheme
  /** Persist a patch via the main process and update local + applied state. */
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

/**
 * Loads settings once, applies the theme to the document + xterm, and keeps the
 * resolved theme in sync with the OS when the setting is `system` (Task 15).
 */
export function SettingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(DEFAULT_SETTINGS.theme)
  )
  const systemWatcherRef = useRef<(() => void) | null>(null)

  const applyTheme = useCallback((setting: ThemeSetting) => {
    const resolved = resolveTheme(setting)
    setResolvedTheme(resolved)
    applyDocumentTheme(resolved)
    TerminalRegistry.setTheme(resolved)

    // Only follow the OS while the user has chosen `system`.
    systemWatcherRef.current?.()
    systemWatcherRef.current = null
    if (setting === 'system') {
      systemWatcherRef.current = watchSystemTheme((next) => {
        setResolvedTheme(next)
        applyDocumentTheme(next)
        TerminalRegistry.setTheme(next)
      })
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void window.api.getSettings().then((loaded) => {
      if (cancelled) return
      setSettings(loaded)
      applyTheme(loaded.theme)
    })
    return () => {
      cancelled = true
      systemWatcherRef.current?.()
      systemWatcherRef.current = null
    }
  }, [applyTheme])

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = await window.api.setSettings(patch)
      setSettings(next)
      applyTheme(next.theme)
    },
    [applyTheme]
  )

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, resolvedTheme, updateSettings }),
    [settings, resolvedTheme, updateSettings]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider')
  return ctx
}
