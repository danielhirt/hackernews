<!-- packages/web/src/components/Toast.svelte -->
<script lang="ts">
  import { getToast, dismissToast } from '$lib/toast.svelte'

  const toast = getToast()
</script>

{#if toast.value}
  <div class="toast toast-{toast.value.status}">
    {#if toast.value.status === 'loading'}
      <span class="toast-spinner">✦</span>
    {/if}
    <span class="toast-message">{toast.value.message}</span>
    {#if toast.value.status === 'error'}
      <button class="toast-dismiss" onclick={dismissToast}>✕</button>
    {/if}
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 300;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    font-size: 0.85rem;
    color: var(--color-text);
    animation: toast-in 0.2s ease-out;
  }

  .toast-error {
    border-color: var(--color-danger);
  }

  .toast-success {
    border-color: var(--color-accent);
  }

  .toast-spinner {
    display: inline-block;
    font-size: 0.9rem;
    color: var(--color-accent);
    animation: spin 1.5s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  .toast-dismiss {
    font-size: 0.8rem;
    color: var(--color-text-faint);
    padding: 0 2px;
  }

  .toast-dismiss:hover {
    color: var(--color-danger);
  }

  .toast-message {
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
