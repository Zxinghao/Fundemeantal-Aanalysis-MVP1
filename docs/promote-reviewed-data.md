# Promote Reviewed Data

`scripts/promote-reviewed-data.mjs` is the safety gate before official publication.

It promotes `data/industries.reviewed.json` to `data/industries.json` only after manual confirmation.

## Safety Controls

- Manual trigger only.
- Requires the confirmation word `PROMOTE`.
- Preserves the previous official dataset.
- Does not reinterpret review content.
