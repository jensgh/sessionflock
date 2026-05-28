# Product Mission

## Problem

Developers increasingly run terminal-based AI coding agents, and often several at
once. But there's no good way to organize, resume, and switch between those
sessions: it's hard to track which is
which, to jump back into the right one, and—especially—to run several agent
instances in parallel without their changes colliding in the same working tree.

## Target Users

Individual power users of terminal AI agents: developers who run many agent
sessions and want them organized around their own workflow (not a team/
collaboration tool at this stage).

## Solution

**Sessionflock** — a cross-platform desktop GUI that manages many terminal
AI-agent sessions, each in its own embedded terminal tab. It is **agent-agnostic**:
agents are added as adapters, and **Claude Code** is supported out of the box. A
setting selects which agent new sessions launch.

- Each session lives in its own embedded terminal, shown as a tab down the left.
  Click a tab to bring that session into focus and interact with the agent.
- A "New session" button spins up a new tab/terminal; an arrow on that button
  lets you launch ad-hoc in a different folder, while a configurable default home
  folder covers the common case.
- When the target folder is a git repository, sessions can be configured to
  always start in a fresh git worktree with no changes—so multiple agent
  instances can run simultaneously on independent changes.
- A tab indicator shows when a backgrounded session is waiting for you, so you
  always know which terminal needs attention.

The differentiator is being a **terminal-native, agent-agnostic** workspace:
bring any CLI agent, run many in parallel with per-session worktree isolation,
and get a unified attention indicator across all of them.
