import { browser } from '$app/environment'

const STORAGE_KEY = 'omnifeed-summaries'
const EXPANDED_KEY = 'omnifeed-summaries-expanded'
const OP_EXPANDED_KEY = 'omnifeed-op-expanded'
const TEXT_OPEN_KEY = 'omnifeed-text-open'
const MAX_ENTRIES = 100

let entries = $state<Map<string, string>>(new Map())
let expandedState = $state<Map<string, boolean>>(new Map())
let opExpandedState = $state<Map<string, boolean>>(new Map())
let textOpenState = $state<Map<string, boolean>>(new Map())
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
  const rawOp = localStorage.getItem(OP_EXPANDED_KEY)
  if (rawOp) {
    try {
      opExpandedState = new Map(JSON.parse(rawOp) as [string, boolean][])
    } catch {
      // ignore corrupt data
    }
  }
  const rawTextOpen = localStorage.getItem(TEXT_OPEN_KEY)
  if (rawTextOpen) {
    try {
      textOpenState = new Map(JSON.parse(rawTextOpen) as [string, boolean][])
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

function persistOp() {
  if (!browser) return
  // Cap to MAX_ENTRIES most recent
  const arr = [...opExpandedState.entries()].slice(-MAX_ENTRIES)
  localStorage.setItem(OP_EXPANDED_KEY, JSON.stringify(arr))
}

function persistTextOpen() {
  if (!browser) return
  const arr = [...textOpenState.entries()].slice(-MAX_ENTRIES)
  localStorage.setItem(TEXT_OPEN_KEY, JSON.stringify(arr))
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

export function isOpExpanded(id: string): boolean {
  ensureLoaded()
  return opExpandedState.get(id) ?? true
}

export function setOpExpanded(id: string, expanded: boolean): void {
  ensureLoaded()
  opExpandedState = new Map([...opExpandedState, [id, expanded]])
  persistOp()
}

export function isTextOpen(id: string): boolean {
  ensureLoaded()
  return textOpenState.get(id) ?? false
}

export function setTextOpen(id: string, open: boolean): void {
  ensureLoaded()
  if (open) {
    textOpenState = new Map([...textOpenState, [id, open]])
  } else {
    textOpenState.delete(id)
    textOpenState = new Map(textOpenState)
  }
  persistTextOpen()
}
