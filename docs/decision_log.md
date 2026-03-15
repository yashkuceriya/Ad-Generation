# Decision Log

This documents every major design choice, what alternatives were considered, and WHY each decision was made.

## 1. Evaluator Architecture: Separate Calls Per Dimension

**Decision:** Each of the 5 quality dimensions (clarity, value proposition, CTA strength, brand voice, emotional resonance) is scored by a separate LLM call.

**Why:** Research on LLM-as-judge (EMNLP 2025, LLM-Rubric ACL 2024) consistently shows that single-criterion evaluators are more reliable than multi-criteria ones. When asked to score 5 things at once, LLMs trade off dimensions and produce less consistent results.

**Tradeoff:** 5x the API calls per evaluation. At 3 iterations per ad, that's 15 evaluation calls per ad. Accepted because:
- Flash model is cheap (~$0.00003 per call)
- Evaluation quality is the north star — the spec says "the system that knows what good looks like wins"

**Alternative rejected:** Single multi-criteria prompt → faster but less reliable scores.

## 2. Dimension Weights

**Decision:** Value Proposition: 0.25, Clarity: 0.20, CTA Strength: 0.20, Emotional Resonance: 0.20, Brand Voice: 0.15

**Why:** For SAT test prep ads competing against Princeton Review, Kaplan, and Khan Academy, the specific benefit claim is the primary differentiator. Brand voice is hardest for an LLM evaluator to judge reliably (lower confidence), so it gets the lowest weight.

**What I'd change:** If calibration against reference ads shows brand voice scores are actually consistent, I'd raise its weight to 0.20 and lower value proposition to 0.20.

## 3. Image Iteration Hard Cap at 3

**Decision:** Image generation loop is hard-capped at 3 iterations, with all 3 preserved and best selected by score.

**Why:** Image generation is expensive ($0.04 per image via Imagen). Beyond 3 iterations, refinement prompts for images have diminishing returns — the evaluator's feedback isn't specific enough to guide meaningful improvement. 3 iterations gives enough exploration while controlling cost.

**Key insight:** The best image is NOT always the last one. Iteration 2 might score highest if iteration 3 overcorrects on one feedback dimension. This is why we keep all iterations and select by score.

## 4. Model Routing: Flash for Everything (v1)

**Decision:** Using gemini-2.0-flash for both generation and evaluation in v1.

**Why:** Cost optimization. At 50+ ads × 3 iterations × 6 LLM calls per iteration = 900+ API calls, even small per-call costs add up. Flash is ~10x cheaper than Pro while maintaining acceptable quality for ad copy generation.

**Alternative considered:** Flash for drafts, Pro for final refinement. Deferred to v2 — want to establish baseline quality-per-dollar first.

## 5. Competitive Intelligence as Static Data

**Decision:** Competitor patterns are hardcoded from research, not live-scraped from Meta Ad Library.

**Why:** Meta Ad Library does not have a public API suitable for programmatic access. Web scraping it would be fragile and may violate ToS. The research-based patterns are accurate and stable — competitor ad strategies don't change week to week.

**Limitation:** Data may become stale. In production, this would be a recurring research task.

## 6. Sequential Brief Processing

**Decision:** Briefs are processed one at a time, not concurrently.

**Why:** Gemini API rate limits. At 900+ calls for 50 briefs, concurrent processing risks 429 errors. Sequential with incremental saves (every 5 briefs) is safer. If the process crashes at brief 40, we keep the first 40 results.

**Tradeoff:** Slower. A 50-brief batch takes ~30-60 minutes vs ~10 minutes concurrent.

## 7. LangSmith as the Observability Layer

**Decision:** All LLM calls traced via LangSmith with tagged metadata (pipeline_stage, iteration, brief_id).

**Why:** LangSmith provides structured trace visualization that cost tracking alone can't. You can see the full chain of generate → evaluate × 5 → refine for each brief, click into any step, and see the exact prompt/response. Essential for debugging quality issues.

**Tradeoff:** Adds ~10ms overhead per call for tracing. Negligible compared to LLM latency.

## 8. Quality Threshold: 7.0/10

**Decision:** Ads scoring below 7.0 weighted average are flagged as below threshold.

**Why:** Spec requirement. Calibration against reference ads should confirm this is the right line. If most ads score 8+, the threshold is too low. If most score 5-6, either the generator or evaluator needs work.

## 9. Best Selection: Highest Score, Not Last Iteration

**Decision:** The "best" version is selected by highest weighted average score across ALL iterations, not by taking the last one.

**Why:** Targeted refinement can overcorrect. Example: Iteration 1 scores 6.5 (weak CTA). Iteration 2 scores 8.2 (great CTA, maintained everything else). Iteration 3 scores 7.8 (CTA improved further but emotional resonance dropped). Taking the last iteration would give 7.8 when 8.2 was available.

## 10. Weakest Dimension Targeting

**Decision:** Refinement feedback targets the dimension with the lowest *raw score*, not the lowest *weighted contribution*.

**Why:** Weighted contribution conflates weight with weakness. A dimension weighted 0.15 scoring 4.0 is still the biggest quality gap, even though its weighted contribution (0.6) is less than a 0.25-weight dimension scoring 7.0 (1.75). Fixing the lowest raw score produces the largest overall quality lift.

**PRD alignment:** The spec says "identify weakest dimension → targeted regeneration." Weakest = lowest actual score.

## 11. User-Scoped Image Caching

**Decision:** Image generation results are stored in per-user cache manifests (`output/images/users/{client_id}/{brief_id}/cache_manifest.json`). The shared `AdResult` in memory is NOT mutated by image generation.

**Why:** In multi-tab or multi-user scenarios, writing to shared state causes image leakage — one user's generated image appears for all users. User-scoped caching + per-request cache resolution isolates users while allowing the shared copy results to remain global (copy doesn't vary by user).

**Tradeoff:** Slightly more complex serialization path. Each `GET /ads/{id}` must resolve the caller's cache. Accepted for correctness.

## 12. Parse Failure Telemetry

**Decision:** The dimension scorer tracks structured parse-outcome counters (json_ok, json_extract_fallback, regex_fallback, default_fallback) and exposes them via `/api/costs/summary`.

**Why:** The PRD emphasizes evaluator quality. If the LLM returns malformed JSON, the fallback chain (extract → regex → default 5.0) silently degrades scoring. Tracking these outcomes surfaces silent reliability issues without blocking the pipeline.

## 13. Unified Artifact Output

**Decision:** Both CLI (`main.py`) and API (`server/runner.py`) produce the same set of persisted artifacts: `final_results.json`, `run_history.json`, `cost_summary.json`, `cost_ledger.json`, `report.md`, `iteration_history.json`.

**Why:** The PRD values repeatable, explainable artifacts. Having different output sets between CLI and API runs breaks reproducibility and confuses reviewers checking the `output/reports/` directory.

## What Didn't Work / Limitations

- **Image evaluation via LLM is subjective.** Scores vary more across runs than copy evaluation. Would benefit from a fine-tuned image evaluator or human calibration.
- **Self-refinement diminishing returns.** After iteration 2, improvements are marginal. The feedback gets too generic. Would benefit from more structured, dimension-specific refinement prompts.
- **No real performance data.** We generate and evaluate but can't validate against actual CTR/conversion. The evaluation framework is a proxy for quality, not a guarantee of performance.
- **Single model for generation.** Using the same model family for generation and evaluation creates self-enhancement bias. A cross-model setup (generate with Gemini, evaluate with Claude) would be more robust.
- **Evaluator calibration prompt had a duplicate block.** The clarity dimension rubric contained two identical CALIBRATION paragraphs, wasting tokens. Fixed.
- **`completed_run_ads` self-reference bug.** The PipelineProgress component had `const runAds = status.completed_run_ads ?? runAds` which referenced itself before declaration. Fixed to `?? 0`.
