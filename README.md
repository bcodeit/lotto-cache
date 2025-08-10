# lotto-cache

Serverless cache of Korean Lotto results using GitHub Actions and Pages.

## Workflows
- **backfill-all-rounds**: manually run to backfill all rounds from 1 to latest.
- **update-lotto-latest**: scheduled weekly (Sat 12:00 UTC) to fetch the newest round.

## Data layout
Generated files are published to GitHub Pages under `public/`:
- `latest.json`: latest round details
- `index.json`: summary `{ latestRound, updatedAt }`
- `history.json`: array of all rounds
- `rounds/<n>.json`: per-round detail files

Scripts in `scripts/` perform fetching and file updates.
