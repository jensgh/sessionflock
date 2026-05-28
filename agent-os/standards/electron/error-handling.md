# Error Handling (main process)

## Errors as values across the IPC boundary

Operations the renderer invokes return a **discriminated result**, never throw
across IPC. The renderer branches on `ok`.

```ts
type PtyCreateResponse = { ok: true; pid: number } | { ok: false; message: string }
```

- Build a user-facing `message`; the renderer surfaces it directly.
- An adapter may `throw` internally (e.g. `resolveLaunch`); the caller catches it
  and converts to the `{ ok: false, message }` shape.

## Non-fatal try/catch

Wrap best-effort side effects (fs watchers, event-file writes, pty resize/kill on a
dying process, WebGL init) in try/catch and **continue** — comment *why* it's safe.

```ts
try { session.pty.resize(cols, rows) } catch { /* resize on a dying pty is harmless */ }
```

- Guard transient states explicitly (e.g. ignore a `0x0` resize before layout settles).
- Degrade, don't crash: a missing event file just means attention falls back to the
  terminal bell.
