# Renderer State & Live Terminals

## Zustand holds metadata only

`store/sessionStore.ts` (Zustand + `subscribeWithSelector`) holds **serializable
session metadata only**. Live `Terminal` objects never enter React state.

## Live xterm objects live in TerminalRegistry

`terminal/TerminalRegistry.ts` is a non-React singleton owning each `LiveTerminal`
(term, addons, container, disposers). This keeps high-churn, DOM-bound, mutable
objects out of the render tree so output floods don't re-render React.

- Non-React modules read a snapshot via `useSessionStore.getState()` (no subscribe).
- Every terminal listener pushes a disposer; `dispose(id)` runs them all (try/catch each).

## No-op set() guards

Every store action returns the **same state reference** when nothing changed, to
skip re-renders.

```ts
setStatus: (id, status) => set((s) => {
  const ex = s.sessions[id]
  if (!ex || ex.status === status) return s   // bail: no change
  return { sessions: { ...s.sessions, [id]: { ...ex, status } } }
})
```

- Throttle high-frequency updates (e.g. `markActivity` coalesces to ~250ms).

## Sticky attention

The "needs you" flag is set by real signals (hook event file → `PTY_ATTENTION`, or
terminal bell) and cleared **only** on tab focus or keystroke — never by output.
Never flag the currently-active tab.
