import type { ITheme } from '@xterm/xterm'
import type { ThemeSetting } from '@shared/ipc-types'

export type ResolvedTheme = 'light' | 'dark'

const darkMediaQuery = '(prefers-color-scheme: dark)'

/** Collapse the `system` setting down to a concrete light/dark value. */
export function resolveTheme(setting: ThemeSetting): ResolvedTheme {
  if (setting === 'system') {
    return window.matchMedia(darkMediaQuery).matches ? 'dark' : 'light'
  }
  return setting
}

/** Apply the resolved theme to the document root via `data-theme`. */
export function applyDocumentTheme(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', resolved)
}

/**
 * Subscribe to OS theme changes. Only meaningful while the setting is `system`;
 * callers should re-subscribe when the setting changes. Returns an unsubscribe.
 */
export function watchSystemTheme(cb: (resolved: ResolvedTheme) => void): () => void {
  const mql = window.matchMedia(darkMediaQuery)
  const listener = (e: MediaQueryListEvent): void => cb(e.matches ? 'dark' : 'light')
  mql.addEventListener('change', listener)
  return () => mql.removeEventListener('change', listener)
}

/** xterm color palette for each resolved theme. Kept in sync with styles.css. */
export function xtermTheme(resolved: ResolvedTheme): ITheme {
  if (resolved === 'dark') {
    return {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      cursorAccent: '#1e1e1e',
      selectionBackground: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff'
    }
  }
  return {
    // Warm-paper light theme — kept in sync with styles.css light tokens.
    background: '#f3efe7',
    foreground: '#33302a',
    cursor: '#33302a',
    cursorAccent: '#f3efe7',
    selectionBackground: '#cfe0f2',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5'
  }
}
