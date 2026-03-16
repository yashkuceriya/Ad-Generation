# Decision Log

Honest account of what was tried, what worked, what failed, and why.

## Architecture Decisions

### Multi-stage pipeline over single-shot generation
**Decision**: Generate -> Evaluate -> Iterate loop rather than one-shot ad creation.
**Why**: Single-shot generation produces inconsistent quality. The iteration loop with early stopping gives controllable quality while minimizing token spend on already-good ads.
**Trade-off**: Higher latency per ad, but better quality-per-token.

### Dimension-based scoring over single aggregate score
**Decision**: Score 5 independent dimensions (clarity, value prop, CTA, brand voice, emotion) then weight-average.
**Why**: A single score is uninterpretable. Dimension scores tell you *why* an ad is weak and *what* to fix. This makes refinement targeted rather than random.
**Trade-off**: 5x more evaluation tokens, but much more actionable feedback.

### In-memory store + PostgreSQL persistence over pure DB
**Decision**: Keep ads in memory (RunStore dict) with DB persistence for costs, history, and insights.
**Why**: The ad generation pipeline needs fast iteration with in-memory access. DB is used for data that must survive restarts (costs, insights, images).
**Trade-off**: Ads are lost on restart unless re-loaded from DB. Acceptable for a demo/challenge context.

### Client-scoped session model over user authentication
**Decision**: Use a client_id (UUID generated per browser session) rather than auth.
**Why**: Full auth is out of scope for this challenge. Client scoping still demonstrates multi-tenant thinking and prevents data leakage between sessions.
**Trade-off**: No persistent user identity. Refreshing the page creates a new session.

### Early stopping over fixed iteration count
**Decision**: Stop iterating when weighted_average >= threshold (default 7.5).
**Why**: Running 5 iterations on an ad that scored 8.2 on round 1 wastes tokens. Early stopping saved ~40% of iteration costs in testing.
**Metric**: Quality threshold is configurable; 7.5 was chosen as the minimum "good enough" bar.

### Image generation budget lock
**Decision**: Added IMAGE_GENERATION_ENABLED server-side flag that blocks all image API calls.
**Why**: Image generation costs $0.07/image and is not reversible. After generating 55 images ($3.85), a hard lock was needed to prevent accidental spend during development.
**Trade-off**: Manual toggle required. Could be automated with budget caps in production.

### Separate LLM calls per evaluation dimension
**Decision**: Each of the 5 quality dimensions is scored by a separate LLM call, not a single multi-criteria prompt.
**Why**: Research on LLM-as-judge consistently shows single-criterion evaluators are more reliable than multi-criteria ones. When asked to score 5 things at once, LLMs trade off dimensions and produce less consistent results.
**Trade-off**: 5x the API calls per evaluation. Accepted because Flash model is cheap (~$0.00003 per call) and evaluation quality is the north star.

### Best selection by highest score, not last iteration
**Decision**: The "best" version is selected by highest weighted average across ALL iterations, not by taking the last one.
**Why**: Targeted refinement can overcorrect. Iteration 2 might score 8.2 while iteration 3 overcorrects and drops to 7.8. Taking the last iteration would miss the better version.

### Weakest dimension targeting for refinement
**Decision**: Refinement feedback targets the dimension with the lowest raw score, not the lowest weighted contribution.
**Why**: Weighted contribution conflates weight with weakness. A dimension weighted 0.15 scoring 4.0 is still the biggest quality gap. Fixing the lowest raw score produces the largest overall quality lift.

## What Worked Well
- **Batched evaluation with early stopping**: Clear cost savings, clean implementation
- **SSE for live updates**: Pipeline progress feels responsive without polling
- **Insight memory across runs**: Simple pattern extraction that feeds back into prompts
- **Review queue with bulk actions**: Makes the product feel operational, not just analytical
- **Cost ledger with DB persistence**: Survives Railway redeploys, critical for trust
- **Zero-cost compliance and diversity gates**: Rule-based checkers (Meta ad policies, near-duplicate detection) that add governance without burning tokens

## What Was Tried and Changed
- **Scatter chart for score vs cost**: Replaced with composed bar+line chart — scatter was unreadable with clustered data
- **System health showing 0% degraded**: Changed to "No Data" when no telemetry exists — 0% was misleading
- **Horizontal bar chart for audience scores**: Replaced with dual-axis composed chart — horizontal bars looked flat
- **tsc --noEmit for build verification**: Switched to full `npm run build` — Vite build catches errors tsc misses
- **Evaluator calibration prompt**: Had a duplicate block in the clarity dimension rubric, wasting tokens. Fixed.
- **`completed_run_ads` self-reference bug**: PipelineProgress component had `const runAds = status.completed_run_ads ?? runAds` which referenced itself before declaration. Fixed to `?? 0`.

## What Would Be Done With More Time
- Real authentication and persistent user sessions
- Budget caps with automatic pause (not just manual toggle)
- A/B test result ingestion (close the experiment feedback loop)
- Webhook integrations for Slack/email notifications on review status changes
- Model comparison (evaluate same brief with different models, compare quality-per-token)
- Prompt versioning and A/B testing on generation prompts
- Cross-model evaluation (generate with Gemini, evaluate with Claude) to reduce self-enhancement bias
