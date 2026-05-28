# Persistence (JSON in userData)

State is plain JSON files in Electron's `userData` dir (no DB): `settings.json`,
`sessions.json`.

## Atomic writes

Write to a temp file, then `rename` — a crash mid-write can't truncate the real file.

```ts
writeFileSync(target + '.tmp', JSON.stringify(data, null, 2))
renameSync(target + '.tmp', target)
```

A failed write keeps the in-memory cache updated and logs the error — the running
session still reflects the user's choice.

## Tolerant reads + versioned migration

- Missing or corrupt file → fall back to defaults (never throw on read).
- Every persisted shape carries `version: 1`. Coerce unknown/older JSON field-by-field
  in a `migrate()` function; map renamed/removed fields (e.g. old `gitWorktreeByDefault`
  boolean → `worktreeMode`).
- Reads are cached in-module; the cache is the source of truth after first load.
