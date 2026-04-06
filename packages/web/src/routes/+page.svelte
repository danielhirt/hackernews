<script lang="ts">
  import { page } from '$app/state'
  import { HnClient, FeedManager, FEED_ENDPOINTS, type FeedType, type Story } from '@hackernews/core'
  import StoryCard from '../components/StoryCard.svelte'
  import StoryCardSkeleton from '../components/StoryCardSkeleton.svelte'

  const client = new HnClient()
  const feedManager = new FeedManager(client)

  let stories: Story[] = $state([])
  let loading = $state(true)
  let currentPage = $state(0)
  let loadingMore = $state(false)
  let selectedIndex = $state(0)

  let feedType: FeedType = $derived(
    (new URLSearchParams(page.url.search).get('feed') as FeedType) ?? 'top'
  )

  let endpoint = $derived(FEED_ENDPOINTS[feedType])

  $effect(() => {
    // Reset when feed changes
    stories = []
    currentPage = 0
    selectedIndex = 0
    loading = true
    loadFeed(endpoint, 0)
  })

  async function loadFeed(ep: string, pg: number) {
    const result = await feedManager.fetchPage(ep, pg)
    if (pg === 0) {
      stories = result
    } else {
      stories = [...stories, ...result]
    }
    loading = false
    loadingMore = false
  }

  async function loadMore() {
    if (loadingMore) return
    loadingMore = true
    currentPage += 1
    await loadFeed(endpoint, currentPage)
  }
</script>

<svelte:window
  onscroll={() => {
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 500
    if (nearBottom && !loading && !loadingMore) {
      loadMore()
    }
  }}
/>

<div class="feed">
  {#if loading}
    {#each Array(10) as _}
      <StoryCardSkeleton />
    {/each}
  {:else}
    {#each stories as story, i}
      <StoryCard {story} index={i} selected={i === selectedIndex} />
    {/each}
    {#if loadingMore}
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
