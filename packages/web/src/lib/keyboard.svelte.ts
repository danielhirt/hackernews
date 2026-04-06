import { goto } from '$app/navigation'
import type { FeedType } from '@hackernews/core'

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
  storyIds: number[]
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
    set storyIds(v: number[]) { state.storyIds = v },
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
      const storyLink = card?.querySelector('.title a') as HTMLAnchorElement
      if (storyLink) {
        window.open(storyLink.href, '_blank')
      }
      break
    }
    case 'c':
      e.preventDefault()
      if (state.storyIds[state.selectedIndex]) {
        goto(`/item/${state.storyIds[state.selectedIndex]}`)
      }
      break
    case 's':
      e.preventDefault()
      const saveBtn = document.querySelector(
        `[data-index="${state.selectedIndex}"] .save-btn`
      ) as HTMLButtonElement
      saveBtn?.click()
      break
  }
}

function scrollToSelected() {
  const el = document.querySelector(`[data-index="${state.selectedIndex}"]`)
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
