<script lang="ts">
  import { page } from '$app/state'
  import { HnClient, type User, type Story, type Comment as HnComment, DEFAULT_COLLECTION_ID, storyToFeedItem } from '@hackernews/core'
  import { timeAgo } from '$lib/time'
  import { getCollections } from '$lib/collections.svelte'
  import { sortStories, sortComments, filterByPeriod, type SortBy, type FilterPeriod } from '$lib/sort-filter'
  import { PAGE_SIZE, paginateItems, hasMoreItems } from '$lib/pagination'
  import StoryCard from '../../../components/StoryCard.svelte'

  const client = new HnClient()
  const cols = getCollections()

  let user: User | null = $state(null)
  let loading = $state(true)
  let error = $state(false)

  type Tab = 'submissions' | 'comments' | 'favorites'
  let activeTab: Tab = $state('submissions')

  let submissions: Story[] = $state([])
  let comments: HnComment[] = $state([])
  let commentStoryIds = $state<Map<number, number>>(new Map())
  let favorites: Story[] = $state([])
  let tabLoading = $state(false)
  let loadedTabs = $state<Set<Tab>>(new Set())

  let sortBy: SortBy = $state('newest')
  let filterPeriod: FilterPeriod = $state('all')

  let submissionsPage = $state(1)
  let commentsPage = $state(1)
  let favoritesPage = $state(1)
  let loadingMore = $state(false)
  let submittedOffset = $state(0)
  let favoritesOffset = $state(0)

  let sortedSubmissions = $derived(sortStories(filterByPeriod(submissions, filterPeriod), sortBy))
  let sortedComments = $derived(sortComments(filterByPeriod(comments, filterPeriod), sortBy))
  let sortedFavorites = $derived(sortStories(filterByPeriod(favorites, filterPeriod), sortBy))

  let displayedSubmissions = $derived(paginateItems(sortedSubmissions, submissionsPage))
  let displayedComments = $derived(paginateItems(sortedComments, commentsPage))
  let displayedFavorites = $derived(paginateItems(sortedFavorites, favoritesPage))

  let hasMoreSubmissions = $derived(hasMoreItems(displayedSubmissions, sortedSubmissions, submittedOffset >= (user?.submitted?.length ?? 0)))
  let hasMoreComments = $derived(hasMoreItems(displayedComments, sortedComments, submittedOffset >= (user?.submitted?.length ?? 0)))
  let hasMoreFavorites = $derived(hasMoreItems(displayedFavorites, sortedFavorites, favoritesOffset >= (favoritesCollection?.itemIds.length ?? 0)))

  let userId = $derived(page.params.id)

  let favoritesCollection = $derived(
    cols.value.find((c) => c.id === DEFAULT_COLLECTION_ID)
  )

  $effect(() => {
    loadUser(userId)
  })

  async function loadUser(id: string) {
    loading = true
    error = false
    submissions = []
    comments = []
    commentStoryIds = new Map()
    favorites = []
    loadedTabs = new Set()
    submittedOffset = 0
    favoritesOffset = 0
    submissionsPage = 1
    commentsPage = 1
    favoritesPage = 1
    try {
      user = await client.fetchUser(id)
      if (!user) {
        error = true
      } else {
        await loadTab(activeTab)
      }
    } catch {
      error = true
    }
    loading = false
  }

  function switchTab(tab: Tab) {
    activeTab = tab
    sortBy = 'newest'
    filterPeriod = 'all'
    if (!loadedTabs.has(tab)) {
      loadTab(tab)
    }
  }

  function resetPages() {
    submissionsPage = 1
    commentsPage = 1
    favoritesPage = 1
  }

  async function loadTab(tab: Tab) {
    tabLoading = true
    if (tab === 'submissions' || tab === 'comments') {
      await loadSubmitted()
    } else {
      await loadFavorites()
    }
    loadedTabs = new Set([...loadedTabs, tab])
    tabLoading = false
  }

  const CHUNK_SIZE = 10

  async function loadSubmitted() {
    if (!user?.submitted?.length) return

    const targetSubmissions = submissions.length + PAGE_SIZE
    const targetComments = comments.length + PAGE_SIZE

    while (submittedOffset < user.submitted.length) {
      if (submissions.length >= targetSubmissions && comments.length >= targetComments) break

      const chunk = user.submitted.slice(submittedOffset, submittedOffset + CHUNK_SIZE)
      const results = await Promise.all(chunk.map((id) => client.fetchItem(id)))
      for (const item of results) {
        if (!item) continue
        if ('title' in item) {
          submissions = [...submissions, item as Story]
        } else if ('parent' in item && !item.deleted && !item.dead) {
          comments = [...comments, item as HnComment]
        }
      }
      submittedOffset += CHUNK_SIZE
    }

    await resolveStoryIds()
    loadedTabs = new Set([...loadedTabs, 'submissions', 'comments'])
  }

  async function loadMore() {
    if (loadingMore) return
    loadingMore = true

    if (activeTab === 'submissions') {
      if (displayedSubmissions.length < sortedSubmissions.length) {
        submissionsPage++
      } else if (submittedOffset < (user?.submitted?.length ?? 0)) {
        await loadSubmitted()
        submissionsPage++
      }
    } else if (activeTab === 'comments') {
      if (displayedComments.length < sortedComments.length) {
        commentsPage++
      } else if (submittedOffset < (user?.submitted?.length ?? 0)) {
        await loadSubmitted()
        commentsPage++
      }
    } else if (activeTab === 'favorites') {
      if (displayedFavorites.length < sortedFavorites.length) {
        favoritesPage++
      } else if (favoritesOffset < (favoritesCollection?.itemIds.length ?? 0)) {
        await loadFavorites()
        favoritesPage++
      }
    }

    loadingMore = false
  }

  function observeSentinel(node: HTMLElement) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore()
      }
    }, { rootMargin: '200px' })
    observer.observe(node)
    return {
      destroy() {
        observer.disconnect()
      }
    }
  }

  async function resolveStoryIds() {
    const unresolved = comments.filter((c) => !commentStoryIds.has(c.id))
    const results = new Map(commentStoryIds)
    await Promise.all(unresolved.map(async (comment) => {
      let parentId = comment.parent
      for (let i = 0; i < 20; i++) {
        const parent = await client.fetchItem(parentId)
        if (!parent) break
        if ('title' in parent) {
          results.set(comment.id, parent.id)
          break
        }
        if ('parent' in parent) {
          parentId = parent.parent
        } else {
          break
        }
      }
    }))
    commentStoryIds = results
  }

  async function loadFavorites() {
    const ids = favoritesCollection?.itemIds ?? []
    if (!ids.length || favoritesOffset >= ids.length) return
    const chunk = ids.slice(favoritesOffset, favoritesOffset + PAGE_SIZE)
    const results = await Promise.all(
      chunk.map((id) => client.fetchItem(id))
    )
    favorites = [...favorites, ...results.filter(
      (item): item is Story => item !== null && 'title' in item
    )]
    favoritesOffset += PAGE_SIZE
  }

  function formatDate(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }
</script>

{#if loading}
  <p class="status">Loading...</p>
{:else if error || !user}
  <p class="status">User not found.</p>
{:else}
  <div class="profile">
    <header class="profile-header">
      <h1 class="username">{user.id}</h1>
      <div class="stats">
        <span>{user.karma.toLocaleString()} karma</span>
        <span class="sep">|</span>
        <span>Joined {formatDate(user.created)}</span>
        <span class="sep">|</span>
        <span>{timeAgo(user.created)}</span>
      </div>
    </header>

    {#if user.about}
      <section class="about">
        <div class="about-content">{@html user.about}</div>
      </section>
    {/if}

    <nav class="tabs">
      <button class="tab" class:active={activeTab === 'submissions'} onclick={() => switchTab('submissions')}>
        Submissions
      </button>
      <button class="tab" class:active={activeTab === 'comments'} onclick={() => switchTab('comments')}>
        Comments
      </button>
      <button class="tab" class:active={activeTab === 'favorites'} onclick={() => switchTab('favorites')}>
        Favorites
      </button>
    </nav>

    <div class="controls">
      <div class="control-group">
        <span class="control-label">Sort</span>
        <button class="control-btn" class:active={sortBy === 'newest'} onclick={() => { sortBy = 'newest'; resetPages() }}>Newest</button>
        <button class="control-btn" class:active={sortBy === 'oldest'} onclick={() => { sortBy = 'oldest'; resetPages() }}>Oldest</button>
        {#if activeTab !== 'comments'}
          <button class="control-btn" class:active={sortBy === 'points'} onclick={() => { sortBy = 'points'; resetPages() }}>Points</button>
          <button class="control-btn" class:active={sortBy === 'discussed'} onclick={() => { sortBy = 'discussed'; resetPages() }}>Discussed</button>
        {/if}
      </div>
      <div class="control-group">
        <span class="control-label">Period</span>
        <button class="control-btn" class:active={filterPeriod === 'all'} onclick={() => { filterPeriod = 'all'; resetPages() }}>All</button>
        <button class="control-btn" class:active={filterPeriod === 'week'} onclick={() => { filterPeriod = 'week'; resetPages() }}>Week</button>
        <button class="control-btn" class:active={filterPeriod === 'month'} onclick={() => { filterPeriod = 'month'; resetPages() }}>Month</button>
        <button class="control-btn" class:active={filterPeriod === 'year'} onclick={() => { filterPeriod = 'year'; resetPages() }}>Year</button>
      </div>
    </div>

    <section class="tab-content">
      {#if tabLoading && !loadedTabs.has(activeTab)}
        <p class="status">Loading...</p>
      {:else if activeTab === 'submissions'}
        {#if displayedSubmissions.length === 0}
          <p class="status">No submissions.</p>
        {:else}
          {#each displayedSubmissions as story, i (story.id)}
            <StoryCard item={storyToFeedItem(story)} index={i} />
          {/each}
          {#if hasMoreSubmissions}
            <div class="sentinel" use:observeSentinel>
              {#if loadingMore}<p class="status">Loading more...</p>{/if}
            </div>
          {/if}
        {/if}
      {:else if activeTab === 'comments'}
        {#if displayedComments.length === 0}
          <p class="status">No comments.</p>
        {:else}
          {#each displayedComments as comment (comment.id)}
            <a href="/item/{commentStoryIds.get(comment.id) ?? comment.parent}" class="comment-card">
              <div class="comment-text">{@html comment.text}</div>
              <div class="comment-meta">
                {timeAgo(comment.time)}
              </div>
            </a>
          {/each}
          {#if hasMoreComments}
            <div class="sentinel" use:observeSentinel>
              {#if loadingMore}<p class="status">Loading more...</p>{/if}
            </div>
          {/if}
        {/if}
      {:else if activeTab === 'favorites'}
        {#if displayedFavorites.length === 0}
          <p class="status">No favorites.</p>
        {:else}
          {#each displayedFavorites as story, i (story.id)}
            <StoryCard item={storyToFeedItem(story)} index={i} />
          {/each}
          {#if hasMoreFavorites}
            <div class="sentinel" use:observeSentinel>
              {#if loadingMore}<p class="status">Loading more...</p>{/if}
            </div>
          {/if}
        {/if}
      {/if}
    </section>
  </div>
{/if}

<style>
  .status {
    color: var(--color-text-muted);
    padding: 16px 0;
  }

  .profile {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .profile-header {
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
  }

  .username {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .stats {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .sep {
    color: var(--color-text-faint);
  }

  .about-content {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--color-text);
    overflow-wrap: break-word;
  }

  .about-content :global(a) {
    color: var(--color-link);
    text-decoration: underline;
  }

  .about-content :global(a:hover) {
    color: var(--color-accent);
  }

  .about-content :global(p) {
    margin-bottom: 6px;
  }

  .tabs {
    display: flex;
    gap: 16px;
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 8px;
  }

  .tab {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    padding: 0;
  }

  .tab:hover {
    color: var(--color-text);
  }

  .tab.active {
    color: var(--color-accent);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .control-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .control-label {
    font-size: 0.75rem;
    color: var(--color-text-faint);
    margin-right: 2px;
  }

  .control-btn {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    padding: 2px 6px;
    border: 1px solid transparent;
  }

  .control-btn:hover {
    color: var(--color-text);
  }

  .control-btn.active {
    color: var(--color-accent);
    border-color: var(--color-border);
  }

  .tab-content {
    display: flex;
    flex-direction: column;
  }

  .comment-card {
    display: block;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
    text-decoration: none;
    color: inherit;
  }

  .comment-card:hover {
    background: var(--color-surface-hover);
    color: inherit;
  }

  .comment-text {
    font-size: 0.95rem;
    line-height: 1.5;
    color: var(--color-text);
    overflow-wrap: break-word;
  }

  .comment-text :global(a) {
    color: var(--color-link);
    text-decoration: underline;
  }

  .comment-text :global(a:hover) {
    color: var(--color-accent);
  }

  .comment-text :global(p) {
    margin-bottom: 4px;
  }

  .comment-meta {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-top: 4px;
  }

  .sentinel {
    min-height: 1px;
    padding: 8px 0;
  }
</style>
