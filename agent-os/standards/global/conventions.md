# Global Conventions

## Comments explain *why*

Every non-trivial file opens with a docblock stating its role and process boundary.
Inline comments capture tribal decisions and tradeoffs, not what the code already
says. Document deliberate non-obvious choices (e.g. "output does NOT clear the
attention flag", "don't write to the tty — hooks have no controlling terminal").

## Naming

- **Env vars:** prefix app-owned vars with `SFLOCK_` (e.g. `SFLOCK_EVENT_FILE`,
  `SFLOCK_DEBUG`).
- **Debug:** gate diagnostics behind `process.env.SFLOCK_DEBUG === '1'`.
- **IDs:** the renderer mints `SessionId`s; main maps them to processes.

## TypeScript style

- No semicolons; single quotes; 2-space indent (matches existing files).
- Annotate exported function return types explicitly.
- Path aliases: `@shared/*` for cross-process types. Main imports use `.js`
  extensions (ESM output).
- Prefer discriminated unions (`{ ok: true } | { ok: false }`) over throwing across
  layers.

## Backpressure

Coalesce high-frequency streams before crossing a boundary — buffer PTY output in
main and flush on a short timer; cap a single payload and split oversized bursts.
