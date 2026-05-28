# IPC & Process Model

The main process owns **all PTYs and on-disk state**; the renderer owns **xterm
instances and UI**. The preload is a **thin marshaling layer — no business logic**.

## Single source of truth

All channels, payload types, and the renderer API live in `src/shared/ipc-types.ts`,
imported by main, preload, and renderer. Never hardcode a channel string.

```ts
export const IPC = { PTY_CREATE: 'pty:create', PTY_DATA: 'pty:data', ... } as const
```

- Add a channel: extend `IPC`, add its payload type, add a method to `RendererApi`,
  wire it in `preload/index.ts` and `main/ipc/registerIpc.ts`.
- The renderer reaches main only through `window.api` (the `RendererApi` contract).
  It never imports `node-pty`, `electron`, or `node:*` modules.

## invoke vs send

- **`invoke`/`handle`** — request/response (create, kill, settings, dialogs, sessions, clipboard read).
- **`on`/`send`** — high-frequency one-way only (keystrokes `PTY_WRITE`, `PTY_RESIZE`, `CLIPBOARD_WRITE`).
- **`webContents.send`** — main→renderer push (`PTY_DATA`, `PTY_EXIT`, `PTY_ATTENTION`).

## Multiplexing

One channel per event kind, keyed by `SessionId` in the payload — not one
listener per session (avoids listener leaks). `onPty*` subscribers return an
unsubscribe function; always call it on cleanup.
