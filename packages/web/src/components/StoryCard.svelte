<script lang="ts">
  import type { FeedItem } from '@omnifeed/core'
  import { SOURCES, SOURCE_ID } from '@omnifeed/core'
  import { timeAgo, domainFrom } from '$lib/time'
  import SaveButton from './SaveButton.svelte'
  import { isRead, markRead } from '$lib/read-history.svelte'
  import { getSummary, saveSummary, clearSummary, isExpanded, setExpanded, isOpExpanded, setOpExpanded, isTextOpen, setTextOpen } from '$lib/summaries.svelte'
  import { getSettings } from '$lib/settings.svelte'
  import { goto } from '$app/navigation'
  import { untrack } from 'svelte'
  import { marked } from 'marked'
  import { sanitizeHtml } from '$lib/sanitize'

  let { item, index, selected = false, showSourceBadge = false }: { item: FeedItem; index: number; selected?: boolean; showSourceBadge?: boolean } = $props()

  let domain = $derived(domainFrom(item.url))
  let read = $derived(isRead(item.id))
  let hasDetailPage = $derived(item.source === SOURCE_ID.HN || item.source === SOURCE_ID.LOBSTERS || item.source === SOURCE_ID.DEVTO)
  let detailHref = $derived(hasDetailPage ? `/item/${item.id}` : item.sourceUrl)
  let isHn = $derived(item.source === SOURCE_ID.HN)
  let textOpen = $state(false)
  let opExpanded = $state(true)
  let textExpanded = $state(false)

  $effect(() => {
    textOpen = untrack(() => isTextOpen(item.id))
  })

  $effect(() => {
    if (item.text) {
      opExpanded = isOpExpanded(item.id)
    }
  })

  const appSettings = getSettings()

  let summaryText = $state('')
  let summaryLoading = $state(false)
  let summaryError = $state('')
  let summaryExpanded = $state(false)
  let summaryFull = $state(false)

  let hasSummary = $derived(!!summaryText || summaryLoading || !!summaryError)

  $effect(() => {
    const cached = getSummary(item.id)
    if (cached) {
      summaryText = cached
      summaryExpanded = isExpanded(item.id)
    } else {
      summaryText = ''
      summaryError = ''
      summaryExpanded = false
      summaryFull = false
    }
  })

  function triggerSummary(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    textOpen = true
    setTextOpen(item.id, true)
    if (summaryText && !summaryLoading) {
      summaryExpanded = true
      setExpanded(item.id, true)
      return
    }
    fetchSummary()
  }

  async function fetchSummary() {
    summaryText = ''
    summaryError = ''
    summaryLoading = true

    try {
      const body: Record<string, unknown> = { model: appSettings.value.model }
      if (isHn) {
        body.storyId = item.originalId
      } else {
        body.title = item.title
        body.url = item.url
        body.text = item.text
      }

      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const text = await res.text()
      if (!res.ok) {
        summaryError = text
        summaryExpanded = true
      } else {
        summaryText = text
        summaryExpanded = true
        saveSummary(item.id, text)
        setExpanded(item.id, true)
      }
    } catch {
      summaryError = 'Failed to generate summary.'
      summaryExpanded = true
    }
    summaryLoading = false
  }

  let summaryCopied = $state(false)
  let opCopied = $state(false)

  async function copySummary() {
    if (!summaryText) return
    await navigator.clipboard.writeText(summaryText)
    summaryCopied = true
    setTimeout(() => summaryCopied = false, 1500)
  }

  function stripHtml(html: string): string {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent ?? ''
  }

  async function copyOpText() {
    if (!item.text) return
    await navigator.clipboard.writeText(stripHtml(item.text))
    opCopied = true
    setTimeout(() => opCopied = false, 1500)
  }

  function dismissSummary() {
    clearSummary(item.id)
    summaryText = ''
    summaryError = ''
    summaryExpanded = false
    summaryFull = false
    summaryLoading = false
  }
</script>

<div class="story-wrapper">
  <div
    role="link"
    tabindex="0"
    class="story-card"
    class:selected
    class:read
    data-index={index}
    data-href={detailHref}
    onclick={() => {
      markRead(item.id)
      if (!hasDetailPage) {
        window.open(detailHref, '_blank', 'noopener')
      } else {
        goto(detailHref)
      }
    }}
    onkeydown={(e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        markRead(item.id)
        if (!hasDetailPage) {
          window.open(detailHref, '_blank', 'noopener')
        } else {
          goto(detailHref)
        }
      }
    }}
  >
    <div class="story-main">
      <div class="title-row">
        <span class="rank">{index + 1}.</span>
        <span class="title">
          {item.title}
          {#if item.tags?.length}
            {#each item.tags.slice(0, 3) as tag}
              <a
                class="tag-pill"
                href="/?source={item.source}&tag={tag}"
                onclick={(e: MouseEvent) => e.stopPropagation()}
              >{tag}</a>
            {/each}
          {/if}
          {#if item.url}
            <a
              class="domain"
              href={item.url}
              target="_blank"
              rel="noopener"
              onclick={(e: MouseEvent) => e.stopPropagation()}
            >({domain})</a>
          {/if}
        </span>
      </div>
      <div class="meta">
        {#if showSourceBadge}
          <span class="source-badge" style="background: {SOURCES.find(s => s.id === item.source)?.color ?? '#888'}">{SOURCES.find(s => s.id === item.source)?.shortName ?? item.source}</span>
          <span class="sep">|</span>
        {/if}
        <span class="score">{item.score}</span>
        <span class="sep">|</span>
        <button class="author" onclick={(e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          if (isHn) goto(`/user/${item.author}`)
          else if (item.source === SOURCE_ID.LOBSTERS) goto(`/user/${item.author}?source=lobsters`)
          else if (item.source === SOURCE_ID.DEVTO) goto(`/user/${item.author}?source=devto`)
        }}>
          {item.author}
        </button>
        <span class="sep">|</span>
        <span>{timeAgo(item.timestamp)}</span>
        {#if item.commentCount > 0}
          <span class="sep">|</span>
          <span>{item.commentCount}&nbsp;comments</span>
        {/if}
        <span class="sep">|</span>
        <a
          class="source-link"
          href={item.sourceUrl}
          target="_blank"
          rel="noopener"
          onclick={(e: MouseEvent) => e.stopPropagation()}
        >View on {SOURCES.find(s => s.id === item.source)?.shortName ?? item.source} ↗</a>
      </div>
    </div>
    <div class="card-actions">
      <button
        class="text-toggle"
        class:has-text={!!item.text}
        class:active={textOpen}
        title={item.text ? 'Show post text' : 'No post content'}
        onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); textOpen = !textOpen; setTextOpen(item.id, textOpen) }}
      >{textOpen ? '▾' : '▸'}</button>
      <button
        class="ai-toggle"
        class:active={hasSummary}
        title="AI summary"
        disabled={summaryLoading}
        onclick={triggerSummary}
      >✦</button>
      <SaveButton itemId={item.id} />
      {#if item.url}
        <a
          href={item.url}
          target="_blank"
          rel="noopener"
          class="open-link"
          title="Open link"
          onclick={(e: MouseEvent) => e.stopPropagation()}
        >↗</a>
      {/if}
    </div>
  </div>

  {#if textOpen}
    <div class="text-panel">
      {#if item.text}
        <div class="op-section">
          <div class="op-header" role="button" tabindex="0" onclick={() => { opExpanded = !opExpanded; setOpExpanded(item.id, opExpanded) }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { opExpanded = !opExpanded; setOpExpanded(item.id, opExpanded) } }}>
            <span class="summary-label-group">
              <span class="section-label">OP Comment</span>
              <span class="summary-toggle-icon">{opExpanded ? '▾' : '▸'}</span>
            </span>
            <div class="summary-actions">
              <button class="action-icon" onclick={copyOpText} title="Copy">
                {opCopied ? '✓' : '⧉'}
              </button>
            </div>
          </div>
          {#if opExpanded}
            <div class="text-content" class:expanded={textExpanded}>
              {@html sanitizeHtml(item.text)}
            </div>
            <div class="panel-actions">
              <button class="action-text" onclick={() => textExpanded = !textExpanded}>
                {textExpanded ? 'Show less' : 'Show more'}
              </button>
            </div>
          {/if}
        </div>
      {:else if !hasSummary}
        <div class="no-content">No post content.</div>
      {/if}

      {#if hasSummary}
        <div class="summary-section" class:has-divider={!!item.text}>
          <div class="summary-header" role="button" tabindex="0" onclick={() => { summaryExpanded = !summaryExpanded; setExpanded(item.id, summaryExpanded) }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { summaryExpanded = !summaryExpanded; setExpanded(item.id, summaryExpanded) } }}>
            <span class="summary-label-group">
              <span class="summary-label">AI Summary</span>
              {#if summaryLoading}
                <span class="summary-spinner">✦</span>
              {:else if summaryText}
                <span class="summary-toggle-icon">{summaryExpanded ? '▾' : '▸'}</span>
              {/if}
            </span>
            {#if summaryText && !summaryLoading}
              <div class="summary-actions">
                <button class="action-icon" onclick={copySummary} title="Copy">
                  {summaryCopied ? '✓' : '⧉'}
                </button>
                <button class="action-icon" onclick={fetchSummary} title="Regenerate">↻</button>
                <button class="action-icon action-danger" onclick={dismissSummary} title="Dismiss">✕</button>
              </div>
            {/if}
          </div>
          {#if summaryExpanded}
            {#if summaryError}
              <p class="summary-error">{summaryError}</p>
            {:else if summaryText}
              <div class="summary-content" class:full={summaryFull}>
                {@html sanitizeHtml(marked(summaryText) as string)}
              </div>
              <div class="panel-actions">
                <button class="action-text" onclick={() => summaryFull = !summaryFull}>
                  {summaryFull ? 'Show less' : 'Show more'}
                </button>
              </div>
            {/if}
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .story-wrapper {
    border-bottom: 1px solid var(--color-border);
  }

  .story-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
  }

  .story-card:hover {
    background: var(--color-surface-hover);
    color: inherit;
  }

  .story-card.selected {
    background: var(--color-surface-hover);
  }

  .story-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .title-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .rank {
    color: var(--color-text-faint);
    font-size: 0.85rem;
    min-width: 2.5ch;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .title {
    font-size: 1rem;
    line-height: 1.35;
  }

  .story-card.read .title {
    color: var(--color-text-faint);
  }

  .domain {
    font-size: 0.85rem;
    color: var(--color-text-faint);
    text-decoration: none;
  }

  .domain:hover {
    color: var(--color-accent);
  }

  .source-link {
    font-size: 0.8rem;
    color: var(--color-text-faint);
    text-decoration: none;
  }

  .source-link:hover {
    color: var(--color-accent);
  }

  .meta {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    padding-left: calc(2.5ch + 6px);
  }

  .sep {
    color: var(--color-text-faint);
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    min-width: 124px;
    line-height: 1;
  }

  .text-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 1.7rem;
    line-height: 0;
    margin-top: -4px;
    color: var(--color-text-faint);
    opacity: 0.4;
    transition: opacity 0.15s, color 0.15s;
  }

  .text-toggle.has-text {
    opacity: 0.7;
  }

  .text-toggle:hover,
  .text-toggle.active {
    color: var(--color-accent);
    opacity: 1;
  }

  .text-panel {
    padding: 8px 12px 10px calc(2.5ch + 12px);
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--color-text-muted);
    background: var(--color-surface-hover);
  }

  .text-content {
    max-height: 4.5em;
    overflow: hidden;
  }

  .text-content.expanded {
    max-height: 300px;
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .text-content.expanded::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .text-content.expanded::-webkit-scrollbar-track {
    background: transparent;
  }

  .text-content.expanded::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }

  .text-content.expanded::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-faint);
  }

  .text-content :global(a) {
    color: var(--color-link);
    text-decoration: underline;
  }

  .text-content :global(a:hover) {
    color: var(--color-accent);
  }

  .text-content :global(p) {
    margin-bottom: 0.5em;
  }

  .panel-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }

  .action-icon {
    font-size: 0.85rem;
    color: var(--color-text-faint);
    padding: 0 2px;
    line-height: 1;
  }

  .action-text {
    font-size: 0.7rem;
    color: var(--color-text-faint);
    padding: 0 2px;
  }

  .action-text:hover {
    color: var(--color-accent);
  }

  .action-icon:hover {
    color: var(--color-accent);
  }

  .action-icon.action-danger:hover {
    color: var(--color-danger);
  }

  .ai-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 0.9rem;
    color: var(--color-text-faint);
    opacity: 0.4;
    transition: opacity 0.15s, color 0.15s;
  }

  .ai-toggle:hover,
  .ai-toggle.active {
    color: var(--color-accent);
    opacity: 1;
  }

  .ai-toggle:not(.active):not(:disabled):hover {
    animation: spin 1.5s linear infinite;
  }

  .ai-toggle:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .op-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    cursor: pointer;
  }

  .section-label,
  .summary-label {
    font-size: 0.75rem;
    color: var(--color-text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-section {
    margin-top: 8px;
  }

  .summary-section.has-divider {
    padding-top: 8px;
    border-top: 1px solid var(--color-border);
  }

  .summary-content {
    max-height: 9em;
    overflow: hidden;
    margin-top: 4px;
  }

  .summary-content.full {
    max-height: 300px;
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .summary-content.full::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .summary-content.full::-webkit-scrollbar-track {
    background: transparent;
  }

  .summary-content.full::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }

  .summary-content.full::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-faint);
  }

  .summary-content :global(a) {
    color: var(--color-accent);
  }

  .summary-content :global(p) {
    margin-bottom: 0.5em;
  }

  .summary-content :global(li) {
    margin-left: 1.2em;
  }

  .summary-error {
    color: var(--color-danger);
    font-size: 0.85rem;
    margin-top: 4px;
  }

  .summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    text-align: left;
    cursor: pointer;
  }

  .summary-label-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .summary-toggle-icon {
    font-size: 1.1rem;
    color: var(--color-text-muted);
    line-height: 0;
    margin-top: -2px;
  }

  .summary-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .summary-label:hover {
    color: var(--color-text);
  }

  .summary-spinner {
    display: inline-block;
    font-size: 0.75rem;
    color: var(--color-accent);
    animation: spin 1.5s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .no-content {
    font-style: italic;
    color: var(--color-text-faint);
  }

  .open-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 0.9rem;
    color: var(--color-text-faint);
    text-decoration: none;
  }

  .open-link:hover {
    color: var(--color-accent);
  }

  .author {
    color: var(--color-text-muted);
    text-decoration: none;
  }

  .author:hover {
    color: var(--color-accent);
  }

  .score {
    color: var(--color-text-muted);
  }

  .source-badge {
    display: inline-block;
    font-size: 0.65rem;
    padding: 1px 5px;
    border-radius: 2px;
    color: #fff;
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    line-height: 1.4;
  }

  .tag-pill {
    display: inline-block;
    font-size: 0.7rem;
    padding: 1px 6px;
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    text-decoration: none;
    vertical-align: middle;
    margin-left: 4px;
    line-height: 1.4;
  }

  .tag-pill:hover {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }
</style>
