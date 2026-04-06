<script lang="ts">
  import '../app.css'
  import NavBar from '../components/NavBar.svelte'
  import { handleKeydown } from '$lib/keyboard.svelte'

  let { children } = $props()
</script>

<svelte:window onkeydown={handleKeydown} />

<NavBar />
<main class="main">
  {@render children()}
</main>

<style>
  .main {
    max-width: var(--max-width);
    margin: 0 auto;
    padding: var(--space-lg);
  }
</style>
