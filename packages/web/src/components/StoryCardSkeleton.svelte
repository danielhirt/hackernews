<div class="skeleton-card">
  <div class="skeleton-title"></div>
  <div class="skeleton-meta"></div>
</div>

<style>
  .skeleton-card {
    padding: var(--space-md);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .skeleton-title,
  .skeleton-meta {
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-title {
    height: 1.25rem;
    width: 75%;
  }

  .skeleton-meta {
    height: 0.875rem;
    width: 50%;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
</style>
