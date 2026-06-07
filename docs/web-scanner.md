# Web Scanner

`scripts/web-scan.mjs` is the first real scanner prototype.

It reads `data/source-watchlist.json`, visits source URLs, extracts page text, computes a content fingerprint, compares it with `data/source-cache.json`, and generates candidate events only when a page changes.

## Data Flow

```text
source-watchlist.json -> web-scan.mjs -> source-cache.json -> generated-update-events.json -> review desk
```

## Outputs

- `data/source-cache.json`: latest title, hash, checked time, and errors for each source.
- `data/generated-update-events.json`: candidate events from the scan.

## Review Principle

The scanner proves that a page changed. It does not prove that the investment or supply chain thesis changed.

Every generated event must enter the review desk for human confirmation.
