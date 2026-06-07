# Apply Review Decisions

`scripts/apply-review-decisions.mjs` reads exported review JSON and applies approved items to a reviewed candidate dataset.

It does not directly overwrite official data.

## Output

- `data/industries.reviewed.json`

## Rule

Only items with `reviewStatus: "approved"` are applied.
