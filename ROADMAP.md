# Omnifeed Roadmap

## Next Up

### Mobile Responsiveness
Improve layout and usability on mobile and smaller devices. The current CSS assumes desktop widths. Key areas:
- NavBar: source dropdown + feed tabs + nav links need to collapse or stack on narrow screens
- FeedControls: mode tabs + source chips + filter buttons overflow on small widths
- StoryCard: meta row wraps awkwardly, rank numbers and icons crowd the title
- Item detail: comment threading indentation breaks on narrow viewports
- Touch targets: buttons and links need adequate tap area (44px minimum)

### Omnifeed Clustering / Ordering
Improve how items are grouped and ordered in the unified feed, particularly in Newest mode. Current behavior: all items from all sources sorted strictly by timestamp, which means high-volume sources (DEV.to) dominate the feed with low-quality posts while slower sources (Lobsters) sink to the bottom.

Possible approaches:
- **Round-robin interleaving**: take N items from each source in rotation, preserving each source's native ranking within its slots
- **Source-weighted scoring**: blend timestamp with a per-source weight factor so lower-volume quality sources get proportional representation
- **Deduplication by URL**: cross-source stories linking to the same URL should merge into one entry showing all source badges
- **Minimum representation**: guarantee each source gets at least K items in the first page regardless of timestamps

## Completed

### Unified Omnifeed (2026-04-12)
Default view merging all sources with Newest/Hottest modes, source filter chips, score-based sorting for hottest, filter/mode state persistence across navigation, loading indicators, source badges, controls layout.

### Multi-Source Aggregator (2026-04-11)
HN + Lobsters + DEV.to source adapters, per-source views with feed tabs, tag navigation, user profiles.

### Core Features
Feed caching, infinite scroll pagination, read history, collections with IndexedDB, AI summaries via Claude, keyboard navigation, dark/light theme, inline HN search via Algolia.
