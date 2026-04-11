<script lang="ts">
  import { page } from '$app/state'
  import { type FeedType, type ContentSource, SOURCES } from '@hackernews/core'
  import StoryCard from '../components/StoryCard.svelte'
  import StoryCardSkeleton from '../components/StoryCardSkeleton.svelte'
  import { getKeyboardState } from '$lib/keyboard.svelte'
  import { getFeedState, loadFeed, loadMore } from '$lib/feed.svelte'

  const kb = getKeyboardState()
  const feed = getFeedState()

  let source: ContentSource = $derived(
    (new URLSearchParams(page.url.search).get('source') as ContentSource) ?? 'hackernews'
  )

  let feedId: string = $derived(
    new URLSearchParams(page.url.search).get('feed') ?? SOURCES.find(s => s.id === source)?.feeds[0]?.id ?? 'top'
  )

  $effect(() => {
    loadFeed(source, feedId)
  })

  $effect(() => {
    kb.storyIds = feed.items.map((s) => s.id)
  })
</script>

<svelte:window
  onscroll={() => {
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 500
    if (nearBottom && !feed.loading && !feed.loadingMore) {
      loadMore()
    }
  }}
/>

<div class="feed">
  {#if feed.loading}
    {#each Array(10) as _}
      <StoryCardSkeleton />
    {/each}
  {:else}
    {#each feed.items as item, i}
      <StoryCard {item} index={i} selected={i === kb.selectedIndex} />
    {/each}
    {#if feed.loadingMore}
      {#each Array(5) as _}
        <StoryCardSkeleton />
      {/each}
    {/if}
  {/if}
</div>

<style>
  .feed {
    display: flex;
    flex-direction: column;
  }
</style>
