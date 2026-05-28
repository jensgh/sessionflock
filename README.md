<p align="center">
  <img src="assets/logo.png" alt="Sessionflock" width="440" />
</p>

<p align="center">
  <b>A desktop workspace for running many terminal AI-agent sessions at once —
  each in its own embedded terminal tab.</b><br/>
  Agent-agnostic by design, with <b>Claude Code</b> supported out of the box.
</p>

## Why

If you run several terminal agents in parallel, it's hard to track which session is
which, jump back into the right one, and run several at once without their changes
colliding. Sessionflock gives each session its own tab, tells you when one needs you,
and can isolate each in its own git worktree.

## Features

- **Multi-terminal workspace** — sessions as tabs down the left; click to focus and
  interact with the agent in a real embedded terminal (xterm.js + node-pty). Each tab
  shows the **agent's icon**.
- **New session** in a configurable default folder — or via the **▾** in any folder.
- **Agent selection** — a setting picks which agent new sessions launch.
- **Git worktree isolation** *(optional)* — **Always / Never / Ask each time**; when the
  folder is a git repo, run each session in a fresh worktree on its own branch so
  parallel sessions don't collide.
- **Auto-name from intent** — unnamed tabs are titled from your first prompt
  automatically (or set a name yourself when starting). Toggle in Settings.
- **"Needs you" indicator** — a tab dot when a backgrounded session is waiting for you,
  driven by real signals (the agent's lifecycle hooks / terminal bell), not a timer.
  **Green** = finished its turn, **amber** = waiting for your input.
- **Desktop notifications** — when a backgrounded session needs you or finishes while
  the app isn't focused; click to jump to it. Toggle in Settings.
- **Per-session usage** — each tab shows its context-window fill; a top-bar meter shows
  your **Claude plan usage** (5-hour + 7-day windows) plus the active session's model
  and context.
- **Session panels** *(right-edge tabs)* — see, per session, the **markdown files it
  read**, the **MCP servers it used**, and the **skills it ran**.
- **Search across sessions** — `Ctrl/Cmd+Shift+F` to search session names and terminal
  output; click a result to jump.
- **Clickable links** — URLs in the terminal open in your default browser.
- **Copy / paste** — `Ctrl+Shift+C` / `Cmd+C` and `Ctrl+Shift+V` / `Cmd+V`, plus a
  right-click menu. (Hold **Shift** while dragging to select when the agent captures
  the mouse.)
- **Auto tab naming** from the running program, with manual rename.
- **Session persistence** — your open tabs reopen on restart (fresh agent processes).
- **Close with confirmation.**
- **Auto-update** — installed apps update themselves from GitHub Releases
  (Linux/Windows; macOS pending code-signing).
- **Light / dark / system theme.**

Planned: browsing and resuming an agent's existing sessions, and full Windows feature
parity (see [the roadmap](agent-os/product/roadmap.md)).

## Install

Download the installer for your OS from the [Releases](../../releases) page:

- **Linux:** `.AppImage` (mark executable and run) or `.deb`.
- **Windows:** `.exe` (NSIS installer). **Beta** — the core workspace works, but the
  hook-driven features (precise done/ask dot, per-session token stats, plan-usage meter,
  auto-name) are not yet available on Windows. Unsigned, so SmartScreen may warn on first
  run (**More info → Run anyway**).
- **macOS:** `.dmg`. The build is currently **unsigned and not notarized**, so after
  copying the app to `/Applications`, macOS quarantines it and reports it as
  *"damaged and can't be opened"*. The app is fine — clear the quarantine flag once
  from Terminal:

  ```bash
  xattr -cr /Applications/Sessionflock.app
  ```

  Then open it normally. (Right-click → Open is **not** enough for the "damaged"
  message, particularly on Apple Silicon.)

  This is a workaround until the macOS build is properly code-signed and notarized.

You'll also need the agent's CLI installed and on your PATH — for Claude Code, the
`claude` binary (Sessionflock auto-detects it; you can also set its path in Settings).

## Development

Prerequisites: **Node.js 20+** and the `claude` CLI.

```bash
npm install        # installs deps and rebuilds node-pty for Electron
npm run dev        # launch with hot reload
```

Useful env flags:

- `SFLOCK_DEBUG=1` — log agent hook events to the dev console.
- `SFLOCK_DISABLE_GPU=1` — software rendering for headless/container environments.

Other scripts:

```bash
npm run typecheck  # main + renderer
npm run build      # electron-vite production build
npm run package    # build + package installers via electron-builder
```

## Architecture

- **Electron** main process — window, IPC, and the PTY manager (owns every node-pty).
- **React + xterm.js** renderer — the workspace UI and terminals (terminal objects
  live outside React state).
- **Agent adapters** (`src/main/agents/`) — each agent implements how to locate its
  binary, build its launch args/env, and surface "needs you" signals. Claude Code
  ships as an adapter.
- Config/UI state in local JSON (Electron `userData`).

## License

[MIT](LICENSE) © 2026 Jens Heidarsson
