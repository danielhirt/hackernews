# Save to Obsidian Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Save to Obsidian" option to the post detail page dropdown that generates an AI summary and writes a note to the user's Obsidian vault via the notetaker skill.

**Architecture:** Two sequential API calls from the client — first to `/api/summarize` (existing, or use cached summary), then to a new `/api/obsidian-save` endpoint that shells out to the `claude` CLI with notetaker skill instructions. A toast notification system provides non-blocking feedback during the async flow. The "Save to Obsidian" option is added at the top of the existing CollectionPicker dropdown with a subtle divider.

**Tech Stack:** SvelteKit, Svelte 5 runes, Claude CLI (`claude -p`), Node `child_process.spawn`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `packages/web/src/lib/toast.svelte.ts` (create) | Toast state management — show/update/dismiss toasts |
| `packages/web/src/components/Toast.svelte` (create) | Toast UI component — renders notifications at bottom-center |
| `packages/web/src/routes/api/obsidian-save/+server.ts` (create) | API endpoint — accepts post data + summary, shells out to `claude` CLI with notetaker skill |
| `packages/web/src/components/CollectionPicker.svelte` (modify) | Add "Save to Obsidian" option at top with divider |
| `packages/web/src/components/SaveButton.svelte` (modify) | Pass obsidian save handler to CollectionPicker |
| `packages/web/src/routes/item/[id]/+page.svelte` (modify) | Wire up the obsidian save flow: summary generation + API call + toast |
| `packages/web/src/routes/+layout.svelte` (modify) | Mount Toast component globally |

---

### Task 1: Toast State Management

**Files:**
- Create: `packages/web/src/lib/toast.svelte.ts`

- [ ] **Step 1: Create toast state module**

```typescript
// packages/web/src/lib/toast.svelte.ts

export type ToastStatus = 'loading' | 'success' | 'error'

export interface Toast {
  id: string
  message: string
  status: ToastStatus
}

let current = $state<Toast | null>(null)
let dismissTimer: ReturnType<typeof setTimeout> | undefined

export function getToast() {
  return {
    get value() { return current },
  }
}

export function showToast(message: string, status: ToastStatus = 'loading'): string {
  clearTimeout(dismissTimer)
  const id = crypto.randomUUID()
  current = { id, message, status }
  if (status === 'success') {
    dismissTimer = setTimeout(() => { current = null }, 3000)
  }
  return id
}

export function updateToast(id: string, message: string, status: ToastStatus): void {
  if (current?.id !== id) return
  clearTimeout(dismissTimer)
  current = { id, message, status }
  if (status === 'success') {
    dismissTimer = setTimeout(() => { current = null }, 3000)
  }
}

export function dismissToast(): void {
  clearTimeout(dismissTimer)
  current = null
}
```

- [ ] **Step 2: Verify module compiles**

Run: `cd packages/web && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No errors related to toast.svelte.ts

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/toast.svelte.ts
git commit -m "feat: add toast notification state management"
```

---

### Task 2: Toast UI Component

**Files:**
- Create: `packages/web/src/components/Toast.svelte`
- Modify: `packages/web/src/routes/+layout.svelte`

- [ ] **Step 1: Create Toast component**

```svelte
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
```

- [ ] **Step 2: Mount Toast in the root layout**

Read `packages/web/src/routes/+layout.svelte` and add the Toast component. Import it at the top of the script block:

```typescript
import Toast from '../components/Toast.svelte'
```

Add `<Toast />` as the last child inside the layout markup, after all other content (but before the closing tag or `</div>`). It renders fixed-position so placement in the DOM tree doesn't matter much, but it should be outside any scrollable container.

- [ ] **Step 3: Verify it compiles**

Run: `cd packages/web && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No errors related to Toast.svelte or +layout.svelte

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/Toast.svelte packages/web/src/routes/+layout.svelte
git commit -m "feat: add Toast notification component"
```

---

### Task 3: Obsidian Save API Endpoint

**Files:**
- Create: `packages/web/src/routes/api/obsidian-save/+server.ts`

- [ ] **Step 1: Create the API endpoint**

This endpoint accepts post data + summary and shells out to `claude` CLI with a prompt that invokes the notetaker skill. Follow the same `spawn` pattern from `/api/summarize/+server.ts`.

```typescript
// packages/web/src/routes/api/obsidian-save/+server.ts
import { spawn } from 'node:child_process'
import type { RequestHandler } from './$types'

const CLAUDE_TIMEOUT_MS = 120_000

function runClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false
    const proc = spawn('claude', [
      '-p',
      '--output-format', 'stream-json',
      '--verbose',
      '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep',
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/tmp',
      env: {
        ...process.env,
        PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin:' + (process.env.HOME ?? '') + '/.local/bin',
      },
    })

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        proc.kill()
        reject(new Error('Obsidian save timed out'))
      }
    }, CLAUDE_TIMEOUT_MS)

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

    proc.on('close', () => {
      clearTimeout(timer)
      if (settled) return
      settled = true

      // Parse stream-json to extract the last assistant text response
      let lastText = ''
      for (const line of stdout.split('\n')) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.type !== 'assistant') continue
          const blocks = event.message?.content
          if (!Array.isArray(blocks)) continue
          for (const block of blocks) {
            if (block.type === 'text' && block.text) {
              lastText = block.text.trim()
            }
          }
        } catch {
          // skip malformed lines
        }
      }

      if (lastText) {
        resolve(lastText)
      } else {
        reject(new Error(stderr.trim() || 'No response from Claude'))
      }
    })

    proc.on('error', (err: Error) => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(err)
      }
    })

    proc.stdin.write(prompt)
    proc.stdin.end()
  })
}

function buildPrompt(data: {
  title: string
  url?: string
  bodyText?: string
  summary: string
  source: string
  author: string
  tags?: string[]
}): string {
  let noteContent = `# ${data.title}\n\n`

  if (data.url) {
    noteContent += `[Original post](${data.url})\n\n`
  } else if (data.bodyText) {
    noteContent += `${data.bodyText}\n\n`
  }

  noteContent += `## AI Summary\n\n${data.summary}\n`

  const tagList = [data.source, ...(data.tags ?? [])].join(', ')

  return `Use the /notetaker skill to write the following note to my Obsidian vault. The note title should be "${data.title}". Add relevant tags including: ${tagList}. Author: ${data.author}.

Here is the note content to save:

${noteContent}

After writing the note, briefly confirm where it was saved.`
}

export const POST: RequestHandler = async ({ request }) => {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  const { title, url, bodyText, summary, source, author, tags } = body as {
    title: string
    url?: string
    bodyText?: string
    summary: string
    source: string
    author: string
    tags?: string[]
  }

  if (!title || !summary) {
    return new Response('Missing title or summary', { status: 400 })
  }

  const prompt = buildPrompt({ title, url, bodyText, summary, source, author, tags })

  try {
    const result = await runClaude(prompt)
    return new Response(JSON.stringify({ success: true, message: result }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ success: false, message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/web && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No errors related to obsidian-save

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/routes/api/obsidian-save/+server.ts
git commit -m "feat: add /api/obsidian-save endpoint"
```

---

### Task 4: Add "Save to Obsidian" to CollectionPicker

**Files:**
- Modify: `packages/web/src/components/CollectionPicker.svelte`
- Modify: `packages/web/src/components/SaveButton.svelte`

- [ ] **Step 1: Add obsidian option to CollectionPicker**

Add a new `onobsidian` callback prop and render the option at the top with a divider. Update `CollectionPicker.svelte`:

Add `onobsidian` to the props:

```typescript
let {
  collections,
  itemCollections,
  onselect,
  onclose,
  onobsidian,
}: {
  collections: Collection[]
  itemCollections: Collection[]
  onselect: (collectionId: string) => void
  onclose: () => void
  onobsidian?: () => void
} = $props()
```

Add the obsidian option at the top of the `.picker` div, before the `{#each}` block:

```svelte
{#if onobsidian}
  <button
    class="picker-item obsidian-item"
    onclick={(e) => { e.preventDefault(); e.stopPropagation(); onobsidian(); onclose(); }}
  >
    <span>Save to Obsidian</span>
  </button>
  <div class="picker-divider"></div>
{/if}
```

Add the divider style:

```css
.picker-divider {
  height: 1px;
  background: var(--color-border);
  margin: 2px 0;
}

.obsidian-item {
  color: var(--color-text-muted);
}

.obsidian-item:hover {
  color: var(--color-text);
}
```

- [ ] **Step 2: Pass onobsidian handler from SaveButton**

Update `SaveButton.svelte` to accept and forward the handler. Add an `onobsidian` prop:

```typescript
let { itemId, onobsidian }: { itemId: string; onobsidian?: () => void } = $props()
```

Pass it to CollectionPicker:

```svelte
<CollectionPicker
  collections={cols.value}
  {itemCollections}
  onselect={handleSelect}
  onclose={() => (showPicker = false)}
  {onobsidian}
/>
```

Also update `handleClick` so that when there's only 1 collection, the picker still opens (since the user needs access to the Obsidian option). Change the condition:

```typescript
async function handleClick(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()

  if (cols.value.length <= 1 && !onobsidian) {
    if (saved) {
      await removeFromCollection(DEFAULT_COLLECTION_ID, itemId)
    } else {
      await addToCollection(DEFAULT_COLLECTION_ID, itemId)
    }
  } else {
    showPicker = !showPicker
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd packages/web && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/CollectionPicker.svelte packages/web/src/components/SaveButton.svelte
git commit -m "feat: add Save to Obsidian option in CollectionPicker dropdown"
```

---

### Task 5: Wire Up the Obsidian Save Flow on the Post Page

**Files:**
- Modify: `packages/web/src/routes/item/[id]/+page.svelte`

- [ ] **Step 1: Add the obsidian save function and pass it to SaveButton**

Add imports at the top of the script block:

```typescript
import { showToast, updateToast } from '$lib/toast.svelte'
```

Add the save function after the existing `fetchSummary` function:

```typescript
async function saveToObsidian() {
  const toastId = showToast('Saving to Obsidian...')

  try {
    // Step 1: Get or generate summary
    let summary = getSummary(itemId)
    if (!summary) {
      const body: Record<string, unknown> = { model: appSettings.value.model }
      if (source === SOURCE_ID.HN) {
        body.storyId = Number(sourceId)
      } else {
        body.title = title
        body.url = url
        body.text = bodyText
        body.comments = comments.slice(0, 30).map(c => ({
          author: c.author,
          text: stripHtml(c.text),
        }))
      }

      const sumRes = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!sumRes.ok) {
        const errText = await sumRes.text()
        updateToast(toastId, `Summary failed: ${errText}`, 'error')
        return
      }

      summary = await sumRes.text()
      saveSummary(itemId, summary)
      summaryText = summary
      summaryExpanded = true
      setExpanded(itemId, true)
    }

    // Step 2: Save to Obsidian
    updateToast(toastId, 'Writing to Obsidian...')

    const saveRes = await fetch('/api/obsidian-save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        url,
        bodyText: url ? undefined : bodyText,
        summary,
        source,
        author,
        tags,
      }),
    })

    const result = await saveRes.json()
    if (saveRes.ok && result.success) {
      updateToast(toastId, 'Saved to Obsidian', 'success')
    } else {
      updateToast(toastId, result.message ?? 'Failed to save', 'error')
    }
  } catch {
    updateToast(toastId, 'Failed to save to Obsidian', 'error')
  }
}
```

Update the SaveButton usage in the template to pass the handler:

```svelte
<SaveButton {itemId} onobsidian={saveToObsidian} />
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/web && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Test manually in the browser**

1. Open http://localhost:5173
2. Click on any post to go to the item detail page
3. Click the save button (○) — the dropdown should appear with "Save to Obsidian" at the top, a divider, then collection items
4. Click "Save to Obsidian" — a toast should appear at bottom-center saying "Saving to Obsidian..."
5. The toast should update to "Writing to Obsidian..." after the summary generates
6. On success: toast shows "Saved to Obsidian" and auto-dismisses after 3 seconds
7. The AI summary panel should appear on the post if it wasn't visible before
8. Verify the note was written to the Obsidian vault

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/routes/item/[id]/+page.svelte
git commit -m "feat: wire up Save to Obsidian flow with summary + toast"
```

---

### Task 6: Update the `updateToast` call without status

**Files:**
- Modify: `packages/web/src/lib/toast.svelte.ts`

- [ ] **Step 1: Add an overload for updateToast that keeps the current status**

The `saveToObsidian` function in Task 5 calls `updateToast(toastId, 'Writing to Obsidian...')` without a status parameter (to keep the loading status). Update the function signature to make `status` optional:

```typescript
export function updateToast(id: string, message: string, status?: ToastStatus): void {
  if (current?.id !== id) return
  clearTimeout(dismissTimer)
  current = { id, message, status: status ?? current.status }
  if (current.status === 'success') {
    dismissTimer = setTimeout(() => { current = null }, 3000)
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd packages/web && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/lib/toast.svelte.ts
git commit -m "fix: make updateToast status param optional"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Run full type check**

Run: `cd packages/web && npx svelte-check --tsconfig ./tsconfig.json`
Expected: No errors

- [ ] **Step 2: Run existing tests to check for regressions**

Run: `cd /Users/daniel/Development/omnifeed && pnpm test`
Expected: All existing tests pass

- [ ] **Step 3: Full manual E2E test**

1. Open http://localhost:5173
2. Navigate to a post with a link (e.g. an HN story linking to an article)
3. Click save button, confirm "Save to Obsidian" appears at top of dropdown with divider
4. Click "Save to Obsidian" and verify:
   - Toast appears: "Saving to Obsidian..."
   - Toast updates: "Writing to Obsidian..."
   - Toast updates: "Saved to Obsidian" (auto-dismisses)
   - Summary panel appears on the post
   - Note exists in Obsidian vault with correct content
5. Repeat with a text-only post (no URL) — verify body text is included in note instead of link
6. Repeat with a post that already has a cached summary — verify it skips summary generation and goes straight to "Writing to Obsidian..."
7. Verify collection save still works normally (click save button, select a collection)
8. Verify existing save behavior works when only 1 collection exists and onobsidian is passed (should open picker, not toggle)

- [ ] **Step 4: Final commit if any adjustments were needed**

```bash
git add -A
git commit -m "fix: adjustments from E2E testing"
```
