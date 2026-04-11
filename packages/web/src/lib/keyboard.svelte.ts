import { goto } from '$app/navigation'
import { SOURCES, SOURCE_ID, SOURCE_PREFIX } from '@hackernews/core'
import { refreshFeed, getFeedState } from '$lib/feed.svelte'

interface KeyboardState {
  selectedIndex: number
  storyIds: string[]
  enabled: boolean
}

let state: KeyboardState = $state({
  selectedIndex: 0,
  storyIds: [],
  enabled: true,
})

export function getKeyboardState() {
  return {
    get selectedIndex() { return state.selectedIndex },
    set selectedIndex(v: number) { state.selectedIndex = v },
    get storyIds() { return state.storyIds },
    set storyIds(v: string[]) { state.storyIds = v },
  }
}

export function setEnabled(enabled: boolean) {
  state.enabled = enabled
}

export function handleKeydown(e: KeyboardEvent) {
  if (!state.enabled) return
  const target = e.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

  const key = e.key

  // Number keys switch feeds within current source
  const feedIndex = Number(key) - 1
  const feed = getFeedState()
  const sourceConfig = SOURCES.find(s => s.id === feed.source) ?? SOURCES[0]
  if (feedIndex >= 0 && feedIndex < sourceConfig.feeds.length) {
    e.preventDefault()
    goto(`/?source=${feed.source}&feed=${sourceConfig.feeds[feedIndex].id}`)
    return
  }

  switch (key) {
    case 'j':
      e.preventDefault()
      state.selectedIndex = Math.min(state.selectedIndex + 1, state.storyIds.length - 1)
      scrollToSelected()
      break
    case 'k':
      e.preventDefault()
      state.selectedIndex = Math.max(state.selectedIndex - 1, 0)
      scrollToSelected()
      break
    case 'o': {
      e.preventDefault()
      const card = document.querySelector(`[data-index="${state.selectedIndex}"]`) as HTMLAnchorElement
      if (card?.href) {
        const href = card.getAttribute('href')!
        if (href.startsWith('http')) {
          window.open(href, '_blank', 'noopener')
        } else {
          goto(href)
        }
      }
      break
    }
    case 'c': {
      e.preventDefault()
      const id = state.storyIds[state.selectedIndex]
      if (id?.startsWith(SOURCE_PREFIX.hackernews) || id?.startsWith(SOURCE_PREFIX.lobsters) || id?.startsWith(SOURCE_PREFIX.devto)) {
        goto(`/item/${id}`)
      }
      break
    }
    case 's':
      e.preventDefault()
      const saveBtn = document.querySelector(
        `[data-index="${state.selectedIndex}"] .save-btn`
      ) as HTMLButtonElement
      saveBtn?.click()
      break
    case 'r':
      e.preventDefault()
      refreshFeed()
      break
    case '/':
      if (feed.source === SOURCE_ID.HN) {
        e.preventDefault()
        goto('/search')
      }
      break
  }
}

function scrollToSelected() {
  const el = document.querySelector(`[data-index="${state.selectedIndex}"]`)
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
