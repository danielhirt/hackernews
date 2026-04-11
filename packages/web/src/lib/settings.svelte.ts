import { browser } from '$app/environment'

const STORAGE_KEY = 'hn-settings'

export type ModelOption = 'haiku' | 'sonnet' | 'opus'

export interface Settings {
  model: ModelOption
  accentColor: string
}

const DEFAULT_SETTINGS: Settings = {
  model: 'sonnet',
  accentColor: '#ff6600',
}

let settings = $state<Settings>({ ...DEFAULT_SETTINGS })
let loaded = false

function ensureLoaded() {
  if (loaded || !browser) return
  loaded = true
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<Settings>
      settings = { ...DEFAULT_SETTINGS, ...parsed }
    } catch {
      // ignore corrupt data
    }
  }
  applyAccentColor()
}

function persist() {
  if (!browser) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function getSettings() {
  ensureLoaded()
  return {
    get value() { return settings },
  }
}

export function updateSettings(partial: Partial<Settings>): void {
  ensureLoaded()
  settings = { ...settings, ...partial }
  persist()
  if (partial.accentColor) {
    applyAccentColor(partial.accentColor)
  }
}

export function applyAccentColor(color?: string): void {
  if (!browser) return
  const c = color ?? settings.accentColor
  document.documentElement.style.setProperty('--color-accent', c)
}
