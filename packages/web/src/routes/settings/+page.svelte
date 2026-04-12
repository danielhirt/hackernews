<script lang="ts">
  import { getSettings, updateSettings, type ModelOption } from '$lib/settings.svelte'

  const settings = getSettings()

  const models: { value: ModelOption; label: string; description: string }[] = [
    { value: 'haiku', label: 'Haiku', description: 'Fastest, good for quick summaries' },
    { value: 'sonnet', label: 'Sonnet', description: 'Balanced speed and quality' },
    { value: 'opus', label: 'Opus', description: 'Most capable, slower' },
  ]

  const accentPresets = [
    { color: '#ff6600', label: 'Orange' },
    { color: '#ef4444', label: 'Red' },
    { color: '#f59e0b', label: 'Amber' },
    { color: '#22c55e', label: 'Green' },
    { color: '#06b6d4', label: 'Cyan' },
    { color: '#3b82f6', label: 'Blue' },
    { color: '#8b5cf6', label: 'Violet' },
    { color: '#ec4899', label: 'Pink' },
  ]
</script>

<div class="settings-page">
  <h1>Settings</h1>

  <section class="setting-group">
    <h2>AI Summary Model</h2>
    <p class="setting-description">Select the Claude model used for AI summaries.</p>
    <div class="model-options">
      {#each models as model}
        <button
          class="model-option"
          class:active={settings.value.model === model.value}
          onclick={() => updateSettings({ model: model.value })}
        >
          <span class="model-label">{model.label}</span>
          <span class="model-desc">{model.description}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="setting-group">
    <h2>Accent Color</h2>
    <p class="setting-description">Applies to links, active states, and interactive elements.</p>
    <div class="accent-options">
      {#each accentPresets as preset}
        <button
          class="accent-swatch"
          class:active={settings.value.accentColor === preset.color}
          style="background: {preset.color}"
          title={preset.label}
          onclick={() => updateSettings({ accentColor: preset.color })}
        ></button>
      {/each}
      <label class="accent-custom" title="Custom color">
        <input
          type="color"
          value={settings.value.accentColor}
          onchange={(e) => updateSettings({ accentColor: (e.target as HTMLInputElement).value })}
        />
        <span class="custom-label">Custom</span>
      </label>
    </div>
  </section>
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  h1 {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  h2 {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .setting-description {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .accent-options {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .accent-swatch {
    width: 28px;
    height: 28px;
    border: 2px solid transparent;
    cursor: pointer;
  }

  .accent-swatch:hover {
    opacity: 0.8;
  }

  .accent-swatch.active {
    border-color: var(--color-text);
    outline: 2px solid var(--color-bg);
    outline-offset: -3px;
  }

  .accent-custom {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  }

  .accent-custom input[type="color"] {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--color-border);
    background: none;
    cursor: pointer;
  }

  .accent-custom input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  .accent-custom input[type="color"]::-webkit-color-swatch {
    border: none;
  }

  .custom-label {
    font-size: 0.75rem;
    color: var(--color-text-faint);
  }

  .model-options {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .model-option {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    text-align: left;
  }

  .model-option:hover {
    border-color: var(--color-text-faint);
  }

  .model-option.active {
    border-color: var(--color-accent);
  }

  .model-label {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .model-option.active .model-label {
    color: var(--color-accent);
  }

  .model-desc {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
</style>
