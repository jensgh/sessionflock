# Product Roadmap

## Phase 1: MVP

A working multi-terminal desktop app for managing terminal AI-agent sessions on
Linux (Ubuntu) and macOS.

- **Multi-terminal workspace UI** — sessions listed as tabs down the left side;
  clicking a tab focuses that session so you can interact with the agent in its
  embedded terminal; the agent sets the tab name, which the user can change.
- **Embedded terminal per session** — each session runs in its own real terminal
  (xterm.js + node-pty) hosting an agent process.
- **Agent selection** — a setting picks which terminal agent new sessions launch;
  agent-agnostic architecture, with Claude Code supported via an adapter.
- **New session button** — creates a new tab/terminal in the configured default
  folder.
- **Ad-hoc folder launch** — an arrow/dropdown on the New session button to start
  a session in a different folder, overriding the default for that session.
- **Configurable default home folder** for new sessions.
- **Git worktree isolation** — when the target folder is a git repo, optionally
  always create a fresh worktree starting with no changes, so multiple agent
  instances can run in parallel on independent changes. Can be put on as default with a checkbox
- **"Needs input" indicator** — a tab icon/color signals when a session's
  terminal is waiting for user input.
- **Cross-platform: Linux (Ubuntu) and macOS.**
- **Ability to close a session tab, X in the corner and ask are you sure.**
- **Build app so its a single file to install** — Setup build steps to build for each operating system
  could be a github action, maybe releases in github?
- **Create a readme file for github** Make sure the correct licences are there for open source project
- **Auto-update** — installed apps check GitHub Releases and update themselves
  (electron-updater). Works for Linux/Windows; macOS auto-update requires
  code-signing (deferred — mac users get an "update available" prompt until then).
- **Light and Dark mode, default follow system**

## Phase 2: Post-Launch

- ✅ **be able to click links in the chat** — URLs in the terminal are clickable and
  open in the default browser (spec `2026-05-28-1849-tab-ux-links-agent-icon`).
- ✅ **Worktree mode: Always / Never / Ask** — replace the on/off worktree toggle
  with a three-way choice; "Ask" prompts on each new session whether to run it in
  a fresh worktree (and, if so, names the branch).
- **Auto-name sessions from intent** — instead of asking, derive the window + git
  branch name from the user's first prompt(s) to the agent (a "Find out" action
  triggers it). If the first prompt links to a task tracker (e.g. an Asana URL)
  reachable via an MCP server, read the task and name the session/branch from it.
- ✅ **Show agent usage stats** — current-session usage in the top bar (agent logo +
  context %), click to expand model + used/window tokens + fill bar, plus the
  claude.ai **plan usage** (5-hour + 7-day rate-limit windows) fetched from the OAuth
  usage endpoint (spec `2026-05-28-1926-topbar-usage-stats`).
- ✅ **Per-session token usage & context window** — under each session in the tab rail,
  show how many tokens that session has used and its context-window size/fill.
  (spec `2026-05-28-1849`; read from Claude transcripts. The top-bar usage stat from
  "Show agent usage stats" is still pending.)
- **Windows support** — extend PTY and git-worktree handling to Windows
  (node-pty's ConPTY backend).
- ✅ **Search across sessions** — full-text search over session titles and contents.
  (Ctrl/Cmd+Shift+F overlay; searches titles + terminal scrollback; click to activate.)
- ✅ **Desktop notifications (candidate)** — OS-level notifications when a session
  needs input or finishes, complementing the in-app tab indicator.
  (Fires only when the app window is unfocused; toggle in Settings; click focuses session.)
- **Show Md files** — Show MD files this session has in use, 
  user can choose if he wants to show the list or not on the right side of the screen.
- ✅ **Different colors of action needed in dot notification** — Green when the task is
  finished, amber when it's waiting for an answer (blue for a generic bell/idle hint).
  The precise `ask`/`done` hook signal now drives the tab-dot color.
- ✅ **Agent icon in the tab** — Show the icon of the agent in the tab
  (spec `2026-05-28-1849-tab-ux-links-agent-icon`; agent persisted per-session).


## Phase 3: Post-Launch
- **Session management** — list/browse the agent's existing sessions (Claude:
  `~/.claude`), preview them, and resume (`claude --resume`). Moved out of the MVP
  as too large.