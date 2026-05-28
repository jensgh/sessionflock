// Fetches the user's claude.ai subscription usage (the 5-hour and 7-day
// rate-limit windows) from the OAuth usage endpoint — the same source Claude
// Code's own status line uses.
//
// The access token is read from the local Claude credentials file and used ONLY
// as the Authorization header to Anthropic's API. It is never logged, persisted,
// or sent anywhere else. Result is cached for 5 minutes to avoid hammering the API.

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AccountUsage } from '@shared/ipc-types'

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const CACHE_MS = 5 * 60 * 1000

let cache: { at: number; value: AccountUsage | null } | undefined

/** Read the claude.ai OAuth access token from the local credentials file. */
function readAccessToken(): string | null {
  try {
    const path = join(homedir(), '.claude', '.credentials.json')
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as {
      claudeAiOauth?: { accessToken?: unknown }
    }
    const token = parsed.claudeAiOauth?.accessToken
    return typeof token === 'string' && token.length > 0 ? token : null
  } catch {
    return null // no file / not an OAuth (claude.ai) login / unreadable
  }
}

function clampPct(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** Current subscription usage, or null if it can't be determined. Cached 5 min. */
export async function getAccountUsage(): Promise<AccountUsage | null> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_MS) return cache.value

  const token = readAccessToken()
  if (!token) {
    cache = { at: now, value: null }
    return null
  }

  try {
    const res = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20'
      }
    })
    if (!res.ok) {
      cache = { at: now, value: null }
      return null
    }
    const data = (await res.json()) as {
      five_hour?: { utilization?: number }
      seven_day?: { utilization?: number }
    }
    const value: AccountUsage = {
      fiveHourPct: clampPct(data.five_hour?.utilization),
      sevenDayPct: clampPct(data.seven_day?.utilization)
    }
    cache = { at: now, value }
    return value
  } catch {
    cache = { at: now, value: null }
    return null
  }
}
