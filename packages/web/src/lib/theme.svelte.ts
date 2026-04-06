import { browser } from '$app/environment'

const STORAGE_KEY = 'hn-theme'
type Theme = 'dark' | 'light'

let theme = $state<Theme>('dark')
let loaded = false

function ensureLoaded() {
  if (loaded || !browser) return
  loaded = true
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') {
    theme = stored
  }
  apply()
}

function apply() {
  if (!browser) return
  document.documentElement.setAttribute('data-theme', theme)
}

export function getTheme() {
  ensureLoaded()
  return {
    get value() { return theme },
  }
}

export function toggleTheme() {
  ensureLoaded()
  theme = theme === 'dark' ? 'light' : 'dark'
  apply()
  localStorage.setItem(STORAGE_KEY, theme)
}
