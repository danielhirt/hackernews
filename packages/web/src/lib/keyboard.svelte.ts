import { goto } from '$app/navigation'
import type { FeedType } from '@hackernews/core'
import { refreshFeed } from '$lib/feed.svelte'

const feedKeys: Record<string, FeedType> = {
  '1': 'top',
  '2': 'new',
  '3': 'best',
  '4': 'ask',
  '5': 'show',
  '6': 'job',
}

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

  if (key in feedKeys) {
    e.preventDefault()
    goto(`/?feed=${feedKeys[key]}`)
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
        goto(card.getAttribute('href')!)
      }
      break
    }
    case 'c': {
      e.preventDefault()
      const id = state.storyIds[state.selectedIndex]
      if (id?.startsWith('hn:')) {
        goto(`/item/${id.slice(3)}`)
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
  }
}

function scrollToSelected() {
  const el = document.querySelector(`[data-index="${state.selectedIndex}"]`)
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
