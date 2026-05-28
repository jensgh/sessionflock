import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { SessionId } from '@shared/ipc-types'
import { DEFAULT_AGENT_ID } from '@shared/agents'

export type SessionStatus = 'starting' | 'running' | 'exited'

/**
 * Whether a backgrounded tab is waiting for the user. We deliberately do NOT try
 * to split "finished" vs "asked a question": both are the same Claude turn-end
 * event and can't be told apart from hooks. A single "needs you" state is set by
 * the Stop/Notification hooks, the terminal bell, or the idle fallback — whichever
 * fires first — and cleared when the user focuses the tab or types into it.
 */
export type AttentionKind = 'none' | 'needs'

/**
 * Serializable session METADATA only. Live xterm `Terminal` objects never live
 * here — they are kept in the non-React `TerminalRegistry` singleton. Keeping
 * these objects out of React state is what lets us update high-frequency fields
 * (activity timestamps, needsInput) without re-rendering the whole tree.
 */
export interface SessionMeta {
  id: SessionId
  cwd: string
  /** Displayed name. Mirrors the manual name, or the auto title from the pty. */
  name: string
  /** Last auto title reported by the terminal (`onTitleChange`). */
  autoName: string
  /** Once the user renames a tab, auto titles no longer overwrite `name`. */
  isManualName: boolean
  /** Agent this session runs (drives the tab icon). */
  agentId: string
  order: number
  status: SessionStatus
  attention: AttentionKind
  lastActivityAt: number
  /** Current context-window occupancy in tokens (0 until first stats arrive). */
  contextTokens: number
  /** Model context-window size in tokens (0 = unknown). */
  contextWindow: number
  /** Cumulative output tokens generated this session. */
  totalOutputTokens: number
}

export interface AddSessionInput {
  id: SessionId
  cwd: string
  name: string
  isManualName?: boolean
  /** Agent this session runs; defaults to the built-in default agent. */
  agentId?: string
  /** Explicit order; defaults to appending at the end. */
  order?: number
  status?: SessionStatus
}

interface SessionStoreState {
  sessions: Record<SessionId, SessionMeta>
  order: SessionId[]
  activeId: SessionId | null

  addSession: (input: AddSessionInput) => void
  removeSession: (id: SessionId) => void
  setActive: (id: SessionId | null) => void
  renameSession: (id: SessionId, name: string) => void
  setAutoName: (id: SessionId, title: string) => void
  setStatus: (id: SessionId, status: SessionStatus) => void
  markActivity: (id: SessionId) => void
  setAttention: (id: SessionId, kind: AttentionKind) => void
  setStats: (
    id: SessionId,
    stats: { contextTokens: number; contextWindow: number; totalOutputTokens: number }
  ) => void
  reorder: (order: SessionId[]) => void
}

export const useSessionStore = create<SessionStoreState>()(
  subscribeWithSelector((set) => ({
    sessions: {},
    order: [],
    activeId: null,

    addSession: (input) =>
      set((state) => {
        if (state.sessions[input.id]) return state
        const order =
          typeof input.order === 'number' ? input.order : state.order.length
        const meta: SessionMeta = {
          id: input.id,
          cwd: input.cwd,
          name: input.name,
          autoName: input.name,
          isManualName: input.isManualName ?? false,
          agentId: input.agentId ?? DEFAULT_AGENT_ID,
          order,
          status: input.status ?? 'starting',
          attention: 'none',
          lastActivityAt: Date.now(),
          contextTokens: 0,
          contextWindow: 0,
          totalOutputTokens: 0
        }
        return {
          sessions: { ...state.sessions, [input.id]: meta },
          order: [...state.order, input.id],
          // First session becomes active automatically.
          activeId: state.activeId ?? input.id
        }
      }),

    removeSession: (id) =>
      set((state) => {
        if (!state.sessions[id]) return state
        const { [id]: _removed, ...rest } = state.sessions
        const order = state.order.filter((sid) => sid !== id)
        let activeId = state.activeId
        if (activeId === id) {
          // Pick the neighbour: prefer the tab that took this one's slot,
          // otherwise the previous tab, otherwise nothing.
          const removedIdx = state.order.indexOf(id)
          activeId = order[removedIdx] ?? order[removedIdx - 1] ?? null
        }
        return { sessions: rest, order, activeId }
      }),

    setActive: (id) =>
      set((state) => {
        if (id === null) return { activeId: null }
        const existing = state.sessions[id]
        if (!existing) return state
        // Becoming active clears any attention indicator for that tab.
        const sessions =
          existing.attention !== 'none'
            ? { ...state.sessions, [id]: { ...existing, attention: 'none' as const } }
            : state.sessions
        return { activeId: id, sessions }
      }),

    renameSession: (id, name) =>
      set((state) => {
        const existing = state.sessions[id]
        if (!existing) return state
        const trimmed = name.trim()
        if (trimmed.length === 0) return state
        return {
          sessions: {
            ...state.sessions,
            [id]: { ...existing, name: trimmed, isManualName: true }
          }
        }
      }),

    setAutoName: (id, title) =>
      set((state) => {
        const existing = state.sessions[id]
        if (!existing) return state
        const trimmed = title.trim()
        if (trimmed.length === 0) return state
        // Always record the latest auto title; only surface it as the displayed
        // name when the user hasn't manually renamed the tab.
        const name = existing.isManualName ? existing.name : trimmed
        if (existing.autoName === trimmed && existing.name === name) return state
        return {
          sessions: {
            ...state.sessions,
            [id]: { ...existing, autoName: trimmed, name }
          }
        }
      }),

    setStatus: (id, status) =>
      set((state) => {
        const existing = state.sessions[id]
        if (!existing || existing.status === status) return state
        return {
          sessions: { ...state.sessions, [id]: { ...existing, status } }
        }
      }),

    markActivity: (id) =>
      set((state) => {
        const existing = state.sessions[id]
        if (!existing) return state
        const now = Date.now()
        // Throttle store churn during output floods — lastActivityAt only needs
        // coarse resolution. NOTE: output activity does NOT clear needsInput.
        // The attention flag is sticky: it is set by the terminal bell (or the
        // idle fallback) and cleared only when the user focuses the tab or types
        // into it — so output rendered right after a bell can't wipe the flag.
        if (now - existing.lastActivityAt < 250) return state
        return {
          sessions: {
            ...state.sessions,
            [id]: { ...existing, lastActivityAt: now }
          }
        }
      }),

    setAttention: (id, kind) =>
      set((state) => {
        const existing = state.sessions[id]
        if (!existing || existing.attention === kind) return state
        return {
          sessions: {
            ...state.sessions,
            [id]: { ...existing, attention: kind }
          }
        }
      }),

    setStats: (id, stats) =>
      set((state) => {
        const existing = state.sessions[id]
        if (!existing) return state
        if (
          existing.contextTokens === stats.contextTokens &&
          existing.contextWindow === stats.contextWindow &&
          existing.totalOutputTokens === stats.totalOutputTokens
        ) {
          return state // no change — skip the re-render
        }
        return {
          sessions: { ...state.sessions, [id]: { ...existing, ...stats } }
        }
      }),

    reorder: (nextOrder) =>
      set((state) => {
        // Re-stamp the order index on each session so persistence stays in sync.
        const sessions = { ...state.sessions }
        nextOrder.forEach((sid, idx) => {
          const existing = sessions[sid]
          if (existing) sessions[sid] = { ...existing, order: idx }
        })
        return { order: nextOrder, sessions }
      })
  }))
)

// Convenience accessor for non-React modules (e.g. the terminal registry &
// idle timers) that need a current snapshot via `useSessionStore.getState()`
// without subscribing.
export const sessionStore = useSessionStore
