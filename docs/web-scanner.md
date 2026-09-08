# Web Scanner

`scripts/web-scan.mjs` is a source-change detector for the research pipeline.

It reads `data/source-watchlist.json`, visits source URLs that are due for their configured cadence, extracts page text, computes a content fingerprint, compares it with `data/source-cache.json`, and creates a candidate event when a page changes.

It is intentionally not treated as proof that the supply-chain or investment thesis changed.

## Data Flow

```text
source-watchlist.json
  -> web-scan.mjs
  -> source-cache.json
  -> persistent generated-update-events.json
  -> review desk
```

## Cadence

- `daily` sources can be checked on every scheduled scan.
- `weekly` sources are skipped until approximately one week has elapsed since their previous check.

The GitHub Action may still run every day; cadence is enforced inside the scanner.

## Persistent Event Store

`data/generated-update-events.json` is not a disposable snapshot. The scanner reads existing events and merges newly detected events by event ID.

Consequences:

- An older pending event does not disappear just because the source did not change again on the next run.
- A reviewed event keeps its non-pending review state if the same event is encountered again.
- A new source change on a later date creates a separate event, preserving research history.

Events include detection timestamps so the review trail can distinguish first detection from later observation.

## Outputs

- `data/source-cache.json`: latest title, hash, check time, change time, and fetch error for each source.
- `data/generated-update-events.json`: persistent source-change candidates and their repository-persisted review state.

## Review Principle

The scanner proves only that monitored page content changed and records watched keyword context. It does not know the exact economic meaning of the change and it does not automatically modify canonical industry data.

Every material candidate must enter the human review process before promotion.

## Next Research-Layer Upgrade

The next stage is semantic evidence processing: extract the changed disclosure, convert it into explicit claims, cite supporting evidence, and generate a proposed structured patch for human approval. That capability is separate from this change-detection layer.
