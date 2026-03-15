# Evaluator Calibration Guide

## Purpose

The PRD emphasizes evaluation quality and "the system that knows what good looks like wins." This document describes how to calibrate the scoring system against reference ads and interpret the parse telemetry.

## Reference Ad Scoring Workflow

1. **Collect reference ads** — place them in `data/reference_ads/` as JSON files matching `AdResult` schema. Include the best and worst examples from competitor research.

2. **Run calibration** — use the CLI to evaluate reference ads:

```bash
python main.py --mode single --count 1
```

Then manually compare the generated scores against your ground-truth expectations.

3. **Check score distributions** — healthy calibration shows:
   - Average scores between 5.5–7.5 (not clustered at 7–8)
   - Weakest dimension varies across ads (not always the same)
   - Confidence > 0.6 on most scores (not 0.2 defaults)
   - Parse fallback rate < 5% (visible via `/api/costs/summary → parse_telemetry`)

4. **Adjust if needed** — if scores cluster too high, tighten the CALIBRATION block in `config/evaluation_rubrics.py`. If a dimension is always weakest, review its rubric anchors for ambiguity.

## Parse Telemetry

The dimension scorer tracks four parse outcomes:

| Counter | Meaning | Healthy Target |
|---------|---------|---------------|
| `json_ok` | LLM returned valid JSON directly | > 90% |
| `json_extract_fallback` | JSON embedded in markdown/text, extracted via brace matching | < 8% |
| `regex_fallback` | No JSON found, extracted score via regex like `7.5/10` | < 2% |
| `default_fallback` | No parseable score found, defaulted to 5.0 | < 1% |

Access via `GET /api/costs/summary` → `parse_telemetry` field.

## Competitor Pattern Study

Reference competitor hooks and CTA patterns from the competitor analyzer:

| Competitor | Hook Pattern | CTA Pattern | Differentiator |
|-----------|-------------|-------------|---------------|
| Princeton Review | Score improvement guarantees | "Free consultation" | Guarantee-led |
| Kaplan | Flexible scheduling, proven method | "Start for free" | Method-led |
| Khan Academy | Free, self-paced | "Start learning" | Free access |
| Chegg | Budget-friendly, tutoring + homework help | "Try for free" | Bundle value |

Source: `src/intelligence/competitor_analyzer.py` — static research data.

## Score Calibration Reference Points

The rubric anchors define what each score means. If scores don't match these expectations, the rubric may need adjustment:

| Score | Meaning | Expected % of ads |
|-------|---------|------------------|
| 1–3 | Poor — fundamental problems | < 5% |
| 4–5 | Below average — clear weaknesses | 10–20% |
| 6–7 | Good — solid with room for improvement | 40–50% |
| 8–9 | Excellent — strong, polished | 20–30% |
| 10 | Perfect — essentially unreachable | < 1% |

## Adding New Reference Ads

Place reference ad data in `data/reference_ads/`:

```
data/reference_ads/
├── best_parents_awareness.json
├── best_students_conversion.json
├── worst_generic_low_cta.json
└── README.md
```

Each file should contain an `AdResult`-compatible JSON structure with expected scores annotated in a `_expected_scores` field for comparison.
