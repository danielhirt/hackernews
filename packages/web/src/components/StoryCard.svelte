<script lang="ts">
  import type { FeedItem } from '@hackernews/core'
  import { SOURCES } from '@hackernews/core'
  import { timeAgo, domainFrom } from '$lib/time'
  import SaveButton from './SaveButton.svelte'
  import { isRead, markRead } from '$lib/read-history.svelte'
  import { getSummary, saveSummary, clearSummary, setExpanded } from '$lib/summaries.svelte'
  import { getSettings } from '$lib/settings.svelte'
  import { marked } from 'marked'

  let { item, index, selected = false }: { item: FeedItem; index: number; selected?: boolean } = $props()

  let domain = $derived(domainFrom(item.url))
  let read = $derived(isRead(item.id))
  let isHn = $derived(item.source === 'hackernews')
  let detailHref = $derived(isHn ? `/item/${item.originalId}` : item.sourceUrl)
  let textOpen = $state(false)
  let textExpanded = $state(false)

  const appSettings = getSettings()

  let summaryText = $state('')
  let summaryLoading = $state(false)
  let summaryError = $state('')
  let summaryExpanded = $state(false)

  let hasSummary = $derived(!!summaryText || summaryLoading || !!summaryError)

  $effect(() => {
    const cached = getSummary(item.id)
    if (cached) summaryText = cached
  })

  function triggerSummary(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    textOpen = true
    if (summaryText && !summaryLoading) return
    fetchSummary()
  }

  async function fetchSummary() {
    summaryText = ''
    summaryError = ''
    summaryLoading = true

    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId: item.originalId, model: appSettings.value.model }),
      })
      const text = await res.text()
      if (!res.ok) {
        summaryError = text
      } else {
        summaryText = text
        saveSummary(item.id, text)
        setExpanded(item.id, true)
      }
    } catch {
      summaryError = 'Failed to generate summary.'
    }
    summaryLoading = false
  }

  let summaryCopied = $state(false)

  async function copySummary() {
    if (!summaryText) return
    await navigator.clipboard.writeText(summaryText)
    summaryCopied = true
    setTimeout(() => summaryCopied = false, 1500)
  }

  function dismissSummary() {
    clearSummary(item.id)
    summaryText = ''
    summaryError = ''
    summaryExpanded = false
    summaryLoading = false
  }
</script>

<div class="story-wrapper">
  <a
    href={detailHref}
    class="story-card"
    class:selected
    class:read
    data-index={index}
    onclick={(e: MouseEvent) => {
      markRead(item.id)
      if (!isHn) {
        e.preventDefault()
        window.open(detailHref, '_blank', 'noopener')
      }
    }}
  >
    <div class="story-main">
      <div class="title-row">
        <span class="rank">{index + 1}.</span>
        <span class="title">
          {item.title}
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
        {#if item.source !== 'hackernews'}
          <span class="source-badge" style="background: {SOURCES.find(s => s.id === item.source)?.color ?? '#888'}">{SOURCES.find(s => s.id === item.source)?.shortName ?? item.source}</span>
          <span class="sep">|</span>
        {/if}
        <span class="score">{item.score}</span>
        <span class="sep">|</span>
        <button class="author" onclick={(e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          if (isHn) window.location.href = `/user/${item.author}`
        }}>
          {item.author}
        </button>
        <span class="sep">|</span>
        <span>{timeAgo(item.timestamp)}</span>
        {#if item.commentCount > 0}
          <span class="sep">|</span>
          <span>{item.commentCount}&nbsp;comments</span>
        {/if}
        {#if item.tags?.length}
          <span class="sep">|</span>
          <span class="tags">{item.tags.slice(0, 3).join(', ')}</span>
        {/if}
      </div>
    </div>
    <div class="card-actions">
      <button
        class="text-toggle"
        class:has-text={!!item.text}
        class:active={textOpen}
        title={item.text ? 'Show post text' : 'No post content'}
        style={!item.text && !isHn ? 'visibility: hidden' : ''}
        onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); textOpen = !textOpen; if (!textOpen) textExpanded = false }}
      >{textOpen ? '▾' : '▸'}</button>
      {#if isHn}
        <button
          class="ai-toggle"
          class:active={hasSummary}
          title="AI summary"
          disabled={summaryLoading}
          onclick={triggerSummary}
        >✦</button>
      {/if}
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
  </a>

  {#if textOpen}
    <div class="text-panel">
      {#if item.text}
        <span class="section-label">OP Comment</span>
        <div class="text-content" class:expanded={textExpanded}>
          {@html item.text}
        </div>
        <div class="panel-actions">
          <button class="expand-toggle" onclick={() => textExpanded = !textExpanded}>
            {textExpanded ? 'Show less' : 'Show more'}
          </button>
          <span class="sep">|</span>
          <button class="expand-toggle" onclick={() => { textOpen = false; textExpanded = false }}>
            Collapse
          </button>
        </div>
      {:else if !hasSummary}
        <div class="no-content">No post content.</div>
      {/if}

      {#if hasSummary}
        <div class="summary-section" class:has-divider={!!item.text}>
          <div class="summary-header">
            <span class="summary-label">AI Summary</span>
            {#if summaryLoading}
              <span class="summary-spinner">✦</span>
            {/if}
          </div>
          {#if summaryError}
            <p class="summary-error">{summaryError}</p>
          {:else if summaryText}
            <div class="summary-content" class:expanded={summaryExpanded}>
              {@html marked(summaryText)}
            </div>
          {/if}
          {#if summaryText && !summaryLoading}
            <div class="panel-actions">
              <button class="expand-toggle" onclick={() => summaryExpanded = !summaryExpanded}>
                {summaryExpanded ? 'Show less' : 'Show more'}
              </button>
              <span class="sep">|</span>
              <button class="expand-toggle" onclick={copySummary}>
                {summaryCopied ? 'Copied!' : 'Copy'}
              </button>
              <span class="sep">|</span>
              <button class="expand-toggle" onclick={fetchSummary}>Regenerate</button>
              <span class="sep">|</span>
              <button class="expand-toggle" onclick={dismissSummary}>Dismiss</button>
            </div>
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
    line-height: 1;
  }

  .text-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 1.1rem;
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
    gap: 6px;
    margin-top: 4px;
  }

  .panel-actions .sep {
    color: var(--color-text-faint);
    font-size: 0.75rem;
  }

  .expand-toggle {
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }

  .expand-toggle:hover {
    color: var(--color-accent);
  }

  .ai-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    font-size: 1.1rem;
    color: var(--color-text-faint);
    opacity: 0.4;
    transition: opacity 0.15s, color 0.15s;
  }

  .ai-toggle:hover,
  .ai-toggle.active {
    color: var(--color-accent);
    opacity: 1;
  }

  .ai-toggle:disabled {
    opacity: 0.3;
    cursor: default;
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

  .summary-content.expanded {
    max-height: 300px;
    overflow: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--color-border) transparent;
  }

  .summary-content.expanded::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  .summary-content.expanded::-webkit-scrollbar-track {
    background: transparent;
  }

  .summary-content.expanded::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }

  .summary-content.expanded::-webkit-scrollbar-thumb:hover {
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
    align-items: center;
    gap: 6px;
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
    font-size: 1.1rem;
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

  .tags {
    color: var(--color-text-faint);
    font-size: 0.75rem;
  }
</style>
