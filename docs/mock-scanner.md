# Mock Scanner

`scripts/mock-scan.mjs` simulates daily and weekly information scanning.

It does not fetch real page content. It reads `data/source-watchlist.json` and generates standardized English `UpdateEvent` candidates.

## Purpose

The goal is to test the data path:

```text
source-watchlist.json -> generated-update-events.json -> review desk
```

## Limits

- Does not access real web pages.
- Does not know whether pages actually changed.
- Does not extract financial reports or article bodies.
- Generates candidate events from source metadata and keywords only.
