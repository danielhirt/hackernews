# Omnifeed

## Project Overview

A multi-source news aggregator (HN, Lobsters, DEV.to) built as a pnpm monorepo with two packages:

- **`packages/core`** — TypeScript library: API clients, data models, feed pagination, caching
- **`packages/web`** — SvelteKit 5 frontend: feed views, story detail, collections, AI summaries

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

## Conventions

- Unicode icons for actions: `▸/▾` (expand/collapse), `✦` (AI), `○/●` (save), `↗` (external link)
- Faint → muted → accent color progression for interactive element states
- Custom thin scrollbars matching theme via `scrollbar-width: thin` + `::-webkit-scrollbar`
- Pre-existing TS errors in `+server.ts` (missing `@types/node`) and some route files — not blockers
