<script lang="ts">
  import '../app.css'
  import NavBar from '../components/NavBar.svelte'
  import ScrollToTop from '../components/ScrollToTop.svelte'
  import { handleKeydown } from '$lib/keyboard.svelte'
  import { getSettings } from '$lib/settings.svelte'

  getSettings()

  let { children } = $props()

  function handleClick(e: MouseEvent) {
    const anchor = (e.target as HTMLElement).closest('a[href]') as HTMLAnchorElement | null
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      e.preventDefault()
      window.open(href, '_blank', 'noopener')
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={handleClick}>

<NavBar />
<main class="main">
  {@render children()}
</main>
<ScrollToTop />
</div>

<style>
  .main {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 12px 16px 80px;
  }
</style>
