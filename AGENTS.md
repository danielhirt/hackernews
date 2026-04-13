# Omnifeed

## Project Overview

A multi-source news aggregator (HN, Lobsters, DEV.to) with a unified "omnifeed" that merges all sources into one chronological or score-ranked stream. Built as a pnpm monorepo:

- **`packages/core`** — TypeScript library: API clients, data models, feed pagination, caching, `mergeFeeds` pure function for cross-source aggregation
- **`packages/web`** — SvelteKit 5 frontend: unified omnifeed, per-source views, story detail, collections, AI summaries

## Tech Stack

- **Framework**: Svelte 5 (runes: `$state`, `$derived`, `$effect`, `$props`) + SvelteKit 2
- **Bundler**: Vite 7
- **Styling**: Scoped CSS with CSS variables (dark/light theme via `--color-*` tokens in `app.css`)
- **Storage**: localStorage (summaries, settings, read history), IndexedDB via `idb` (collections)
- **Testing**: Vitest + `@testing-library/svelte` + jsdom
- **Markdown**: `marked` for rendering AI summaries

## Commands

```bash
# From packages/web:
pnpm dev          # Start dev server
pnpm test         # Run tests (vitest run)
pnpm test:watch   # Watch mode
pnpm build        # Production build
pnpm check        # Svelte + TypeScript checking
```

## Architecture

### Unified Omnifeed

The default view (`/` with no `?source` param) merges items from all sources. Key files:

- **`packages/core/src/omnifeed.ts`** — `mergeFeeds(feedsBySource, sort)` pure function, `OmnifeedMode` (`'newest'|'hottest'`), `FeedView` (`ContentSource|'omnifeed'`), `OMNIFEED_MAP` (maps modes to per-source sub-feeds)
- **`packages/web/src/lib/feed.svelte.ts`** — `loadOmnifeed(mode)` parallel-fetches all sources via `fetchAllSources` helper, `loadMore` omnifeed branch with deduplication
- **`packages/web/src/components/FeedControls.svelte`** — mode tabs (Newest/Hottest) + source filter chips (HN/Lobsters/DEV) on left, All/Unread/Saved + refresh on right

State persistence: `omnifeedMode`, `sourceFilter`, and `feedFilter` live in the feed store (module-level `$state`) so they survive SvelteKit page remounts. The page's reset `$effect` uses a `mounted` flag to skip the initial run + a `viewKey` derived string to only reset on actual view changes.

NavBar detects omnifeed mode via `feed.view === 'omnifeed'` on non-feed routes, showing "Omnifeed ▾" dropdown when the user came from the unified view.

### State Management

Svelte 5 reactive stores in `$lib/*.svelte.ts` files — no external state library. Each store uses lazy initialization from localStorage/IndexedDB with `ensureLoaded()` pattern.

### AI Summary System

- **Trigger**: `✦` button on feed cards and item detail page
- **Endpoint**: `POST /api/summarize` — accepts `{ storyId, model }`
- **Backend**: Spawns `claude` CLI in isolated mode (`--tools ''`, `--system-prompt`, `--output-format stream-json`, `cwd: /tmp`) to avoid project config/hooks leaking into output. Parses stream-json to extract first assistant text response only.
- **Caching**: LRU cache in localStorage (max 100 entries) via `$lib/summaries.svelte.ts`
- **Models**: haiku, sonnet (default), opus — configurable in settings

### Feed Story Cards

Each `StoryCard.svelte` has an expandable panel with:
- **OP Comment**: Shows `story.text` if present, with preview/expand/collapse controls
- **AI Summary**: Triggered via `✦` button, displayed below OP text with its own expand controls, loading spinner, regenerate/dismiss actions
- Sections are labeled ("OP COMMENT", "AI SUMMARY") and separated by a divider only when both are present

### Component Testing

Component tests use `@testing-library/svelte` with jsdom. The vite config needs `resolve.conditions: ['browser']` to force Svelte's client build in test environment.

## Verification

After code changes, run this verification sequence:

```bash
# 1. Unit tests + type check (always)
pnpm test && pnpm check

# 2. Browser walkthrough (after features or large changes)
# Use playwright-cli to interactively verify the app
playwright-cli open http://localhost:5174

# 3. Automated regression suite (optional, for broad changes)
python3 scripts/test_regression.py
```

### Browser walkthrough with playwright-cli

Use `playwright-cli` for interactive browser verification after significant changes. The dev server must be running on `:5173`. Walk through this checklist:

1. **Omnifeed default**: `/` loads unified feed with items from multiple sources, source badges visible
2. **Mode switching**: click Hottest, verify items re-sort by score. Click Newest, verify chronological
3. **Source filter chips**: click HN/Lobsters/DEV, verify items filter. Click active chip to deselect
4. **Filter persistence**: set Hottest + Lobsters, click item, click ← Back, verify both persist
5. **NavBar context**: on item detail from omnifeed, dropdown shows "Omnifeed ▾". From HN view, shows "HN ▾"
6. **Source dropdown**: open dropdown, verify Omnifeed is first item, click a source, verify per-source view
7. **Per-source feed tabs**: on `/?source=hackernews`, verify Top/New/Best/Ask/Show/Jobs tabs
8. **Tag navigation** (Lobsters): click a tag pill, verify tag header + back button, click back
9. **Search** (HN per-source only): type query, submit, verify results, clear. Hidden in omnifeed mode
10. **Collections / Settings**: navigate to each, verify they render
11. **Theme toggle**: click sun/moon icon, verify `data-theme` changes on `:root`
12. **Keyboard nav**: set `hn-settings` with `keyboardNav: true` via `localstorage-set`, reload, test j/k/o
13. **Infinite scroll**: scroll to bottom, verify loading pill appears, new items load
14. **Console errors**: run `playwright-cli console error`, verify 0 errors

Key commands:
```bash
playwright-cli open http://localhost:5174       # open browser
playwright-cli snapshot --depth=3 "main"        # inspect DOM
playwright-cli click ".story-card >> nth=0"     # click first story
playwright-cli eval "document.querySelector('.tab.active')?.textContent"
playwright-cli localstorage-set hn-settings '{"keyboardNav":true}'
playwright-cli console error                    # check for errors
playwright-cli screenshot                       # visual capture
playwright-cli close                            # done
```

### Automated regression suite

`scripts/test_regression.py` is a headless Playwright Python script that automates the walkthrough above. Run it for broad changes or as a CI gate. Screenshots go to `/tmp/regression_*.png`.

### Known test caveats

- **HN API latency**: User profile loading depends on the HN Firebase API. Tests use generous timeouts but may warn on slow responses.
- **Settings storage key**: The localStorage key is `hn-settings` (legacy name, not yet renamed to match the Omnifeed rebrand).
- **Search pagination**: Algolia may return results that fit on a single page, so pagination presence is a warning, not an error.

## Conventions

- Unicode icons for actions: `▸/▾` (expand/collapse), `✦` (AI), `○/●` (save), `↗` (external link)
- Faint → muted → accent color progression for interactive element states
- Custom thin scrollbars matching theme via `scrollbar-width: thin` + `::-webkit-scrollbar`
