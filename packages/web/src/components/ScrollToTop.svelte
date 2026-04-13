<script lang="ts">
  import { SCROLL_TO_TOP_THRESHOLD } from '$lib/pagination'
  import { getFeedState } from '$lib/feed.svelte'

  const feed = getFeedState()
  let visible = $state(false)
  let showLoading = $state(false)
  let hideTimer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    if (feed.loadingMore) {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
      showLoading = true
    } else if (showLoading) {
      hideTimer = setTimeout(() => { showLoading = false; hideTimer = null }, 600)
    }
  })

  function onScroll() {
    visible = window.scrollY > SCROLL_TO_TOP_THRESHOLD
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
</script>

<svelte:window onscroll={onScroll} />

<div class="scroll-controls">
  {#if showLoading}
    <span class="loading-pill" aria-label="Loading more items">
      <span class="spinner"></span>
      Loading
    </span>
  {/if}
  {#if visible}
    <button class="scroll-to-top" onclick={scrollToTop} aria-label="Scroll to top">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 12V4" />
        <path d="M4 7l4-4 4 4" />
      </svg>
      Top
    </button>
  {/if}
</div>

<style>
  .scroll-controls {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    z-index: 100;
  }

  .scroll-to-top {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-bg);
    background: var(--color-text);
    border: none;
    border-radius: 20px;
    cursor: pointer;
    opacity: 0.9;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: opacity 0.15s;
  }

  .scroll-to-top:hover {
    opacity: 1;
  }

  .loading-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--color-bg);
    background: var(--color-text);
    border-radius: 20px;
    opacity: 0.9;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top-color: var(--color-bg);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
