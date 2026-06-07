# Review Export

The current app is a static web page. Review button decisions are stored in browser `localStorage`.

The `Export Review Decisions` button exports reviewed events as JSON.

## Exported Fields

- `exportedAt`
- `industryId`
- `industryName`
- `reviewedItems`

Each reviewed item includes:

- `id`
- `company`
- `impact`
- `origin`
- `source`
- `sourceIds`
- `summary`
- `reviewStatus`

## Next Use

The exported JSON can be used as input for applying approved updates to reviewed data.
