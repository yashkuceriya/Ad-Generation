# Known Limitations

Honest account of what the system does not do, and why.

## Architecture Limitations

- **In-memory ad store**: Ads live in a Python dict with DB persistence. On server restart, ads are reloaded from PostgreSQL, but any unsaved in-progress pipeline run is lost. Trade-off: speed of iteration vs durability. Acceptable for a challenge submission.

- **Single-process pipeline**: The pipeline runs as a single background thread. No task queue (Celery, etc). Concurrent pipeline runs are not supported — starting a new run while one is active will be rejected.

- **No real authentication**: Client sessions use a browser-generated UUID. There is no login, no persistent user identity. Refreshing generates a new session. Client scoping exists but is session-based, not user-based.

## Evaluation Limitations

- **Self-evaluation bias**: The same model family (Gemini) generates and evaluates ads. The evaluator may systematically overrate certain patterns it also generates. Mitigation: confidence scores flag uncertain evaluations, and the Trust Center surfaces disagreement signals.

- **No human calibration data**: We have no ground-truth human ratings to validate evaluator accuracy. The calibration workbench exists but has not been populated with human-labeled reference ads.

- **Dimension independence assumption**: The 5 dimensions are scored independently, but in reality they interact (e.g., a very strong CTA may compensate for weaker clarity). The weighted average treats them as additive.

## Cost & Budget Limitations

- **Legacy data lacks client_id**: Cost ledger entries and run history created before client scoping was added have no client_id. The system falls back to showing all data when filtered results are empty.

- **Image generation paused**: Image generation is currently disabled via IMAGE_GENERATION_ENABLED=false to prevent accidental spend. 55 images exist from prior runs at $0.07/image ($3.85 total). Re-enabling requires setting the environment variable.

- **No automatic budget caps**: The budget lock is a manual on/off toggle. There is no automatic "stop when you hit $X" mechanism. In production, this would be a critical feature.

## Scale Limitations

- **55 ads generated**: Meets the 50+ requirement but is not stress-tested at 500+ or 5000+. The in-memory store and single-thread pipeline would need rearchitecting for production scale.

- **No rate limiting**: API endpoints have no rate limiting. In production, this would need middleware for both internal pipeline calls and external API access.

- **No pagination**: The ad gallery loads all ads at once. At 55 ads this is fine; at 5000 it would need server-side pagination.

## What Would Fix These

| Limitation | Fix | Effort |
|---|---|---|
| In-memory store | Redis or full DB-backed store | 1-2 days |
| Single-process | Celery + Redis task queue | 1 day |
| No auth | OAuth2 / JWT middleware | 1 day |
| Self-eval bias | Second model as evaluator, or human ratings | 2-3 days |
| No budget caps | Budget table + pre-call check | 0.5 days |
| No pagination | Cursor-based pagination on list endpoints | 0.5 days |
