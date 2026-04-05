<script lang="ts">
  import '../app.css'
  import NavBar from '../components/NavBar.svelte'

  let { children } = $props()
</script>

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
