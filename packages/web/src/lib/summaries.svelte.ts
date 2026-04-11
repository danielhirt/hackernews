import { browser } from '$app/environment'

const STORAGE_KEY = 'hn-summaries'
const EXPANDED_KEY = 'hn-summaries-expanded'
const MAX_ENTRIES = 100

let entries = $state<Map<string, string>>(new Map())
let expandedState = $state<Map<string, boolean>>(new Map())
let loaded = false

function ensureLoaded() {
  if (loaded || !browser) return
  loaded = true
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as [number | string, string][]
      entries = new Map(parsed.map(([id, text]) => [
        typeof id === 'number' ? `hn:${id}` : String(id),
        text,
      ]))
    } catch {
      // ignore corrupt data
    }
  }
  const rawExp = localStorage.getItem(EXPANDED_KEY)
  if (rawExp) {
    try {
      const parsed = JSON.parse(rawExp) as [number | string, boolean][]
      expandedState = new Map(parsed.map(([id, val]) => [
        typeof id === 'number' ? `hn:${id}` : String(id),
        val,
      ]))
    } catch {
      // ignore corrupt data
    }
  }
}

function persist() {
  if (!browser) return
  const arr = [...entries.entries()]
  const trimmed = arr.slice(-MAX_ENTRIES)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  // Only keep expanded state for entries that still have summaries
  const validIds = new Set(trimmed.map(([id]) => id))
  const expArr = [...expandedState.entries()].filter(([id]) => validIds.has(id))
  localStorage.setItem(EXPANDED_KEY, JSON.stringify(expArr))
}

export function getSummary(id: string): string | undefined {
  ensureLoaded()
  return entries.get(id)
}

export function saveSummary(id: string, text: string): void {
  ensureLoaded()
  // delete and re-add to move to end (LRU)
  entries.delete(id)
  entries = new Map([...entries, [id, text]])
  persist()
}

export function clearSummary(id: string): void {
  ensureLoaded()
  entries.delete(id)
  expandedState.delete(id)
  entries = new Map(entries)
  expandedState = new Map(expandedState)
  persist()
}

export function isExpanded(id: string): boolean {
  ensureLoaded()
  return expandedState.get(id) ?? false
}

export function setExpanded(id: string, expanded: boolean): void {
  ensureLoaded()
  expandedState = new Map([...expandedState, [id, expanded]])
  persist()
}
