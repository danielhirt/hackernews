import { browser } from '$app/environment'

const STORAGE_KEY = 'hn-read'
const MAX_ENTRIES = 2000

let readIds = $state<Set<string>>(new Set())
let loaded = false

function ensureLoaded() {
  if (loaded || !browser) return
  loaded = true
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as (number | string)[]
    readIds = new Set(parsed.map(id =>
      typeof id === 'number' ? `hn:${id}` : String(id)
    ))
  } catch {
    // ignore corrupt data
  }
}

function persist() {
  if (!browser) return
  const trimmed = [...readIds].slice(-MAX_ENTRIES)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

export function isRead(id: string): boolean {
  ensureLoaded()
  return readIds.has(id)
}

export function markRead(id: string): void {
  ensureLoaded()
  if (readIds.has(id)) return
  readIds = new Set([...readIds, id])
  persist()
}
