# Nerdy Autonomous Ad Generation Engine

[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://python.org)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![MUI 6](https://img.shields.io/badge/MUI-6-007FFF?logo=mui&logoColor=white)](https://mui.com)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-LLM_Gateway-6366F1)](https://openrouter.ai)

An autonomous system that generates, evaluates, iterates, and improves Facebook/Instagram ad creatives for **Varsity Tutors SAT test prep** — with a full real-time web dashboard, human-in-the-loop governance, and zero-cost quality gates.

> **One command. Thirty ads. Full iteration history. Trust signals. Cost analytics. Human approval workflow.**

---

## Architecture

```
                        ┌───────────────────────────────────────────┐
                        │          Web Dashboard (React 19)          │
                        │  Dashboard · Ad Library · Compare · Trust  │
                        │  Evaluation · Costs · Run · Settings       │
                        │        Dark Mode · SSE Live Updates        │
                        └──────────────────┬────────────────────────┘
                                           │ SSE + REST
                        ┌──────────────────▼────────────────────────┐
                        │        FastAPI Server (Python 3.11)        │
                        │  12 route groups · SSE broadcaster · State │
                        └──────────────────┬────────────────────────┘
                                           │
  ┌────────────────────────────────────────▼──────────────────────────────────────┐
  │                        Autonomous Pipeline                                    │
  │                                                                               │
  │  Brief ─► Copy Generation ─► 5-Dim Evaluation (batched) ─► Iteration Loop    │
  │    ─► Best Copy Selection ─► Compliance Check ─► Diversity Check              │
  │    ─► Image Generation ─► Image Evaluation ─► Image Loop ─► Best Image       │
  │    ─► Human Approval ─► A/B Variants ─► Experiment Ready                     │
  └───────────────────────────────────────────────────────────────────────────────┘
```

All LLM calls routed through **OpenRouter** (Gemini, Claude, GPT-4o, Llama, DeepSeek available). Cost tracked per-token, per-step, per-model. Optional LangSmith tracing.

---

## Quick Start

### Docker (Recommended)

```bash
cd nerdy-ad-engine
cp .env.example .env      # Add your OPENROUTER_API_KEY
docker-compose up
```

Dashboard: **http://localhost:3000** · API: **http://localhost:8000**

### Manual Setup

```bash
# Backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # Add OPENROUTER_API_KEY
uvicorn server.app:app --reload --port 3008

# Frontend (separate terminal)
cd web && npm install && npm run dev
```

Dashboard: **http://localhost:5173** · API: **http://localhost:3008**

### CLI Only

```bash
python main.py --mode demo                         # 5 ads, quick test
python main.py --mode batch --count 50             # Full batch
python main.py --mode batch --count 50 --no-images # Copy only (cheaper)
```

---

## Web Dashboard

10 pages, all with real-time SSE updates, dark mode, and responsive layout:

| Page | What it does |
|---|---|
| **Dashboard** | Hero stats, score histogram, dimension radar, iteration progression, audience breakdown, actionable recommendations |
| **Ad Library** | Filter by audience/status/score, multi-select, export JSON/CSV, grouped status filters (Ready / In Review / Needs Work / In Progress) |
| **Ad Detail** | Full iteration timeline, 6 tabs (Copy · Scores · Images · Costs · Compliance · A/B Variants), readiness stepper, approve/reject workflow |
| **Compare** | Side-by-side diff of up to 3 ads with dimension highlighting |
| **Evaluation** | Audience radar, quality-vs-cost scatter, iteration efficiency, dimension correlations, marginal cost of improvement, creative diversity analysis |
| **Trust Center** | Overall trust score, evaluator confidence, score consistency, compliance rate, dimension agreement, needs-review escalation table |
| **Cost Analytics** | Per-model/stage cost breakdown, token usage, cost-per-ad, quality-per-dollar |
| **Run Pipeline** | Mode selector, custom brief builder, cost estimator, live event stream, animated pipeline flow, run history |
| **Settings** | Runtime model selection (5 roles × 10+ models), pipeline tuning sliders (iterations, thresholds), brand config |
| **Dark Mode** | Full MUI dark theme toggle with localStorage persistence |

---

## Key Features

### Autonomous Pipeline

- **5-Dimension Evaluation** — Clarity, Value Proposition, CTA Strength, Brand Voice, Emotional Resonance. Each scored independently with calibrated rubrics and confidence signals.
- **Batched Scoring** — All 5 dimensions evaluated concurrently via `asyncio.gather`, cutting eval latency ~5x.
- **Iterative Refinement** — Up to 3 iterations per ad with full history preserved. Best selected by score, not recency.
- **Early Stopping** — Ads scoring ≥ 9.0 skip remaining iterations. Saves cost without sacrificing quality.
- **Image Pipeline** — Generate → evaluate (3 dimensions: brand consistency, engagement potential, text-image alignment) → refine, capped at 3 iterations.
- **Competitive Intelligence** — Princeton Review, Kaplan, Khan Academy, Chegg patterns fed into generation context.

### Trust & Governance

- **Readiness Workflow** — `iterating → generated → evaluator_pass → compliance_pass → human_approved → experiment_ready` (plus `below_threshold` and `rejected`). Human decisions are preserved across recomputation.
- **Compliance Checker** — Rule-based, zero LLM cost: character limits, CTA validation, prohibited content, structural checks against Meta ad policies. Runs instantly after copy generation.
- **Diversity Checker** — Rule-based, zero LLM cost: detects near-duplicate headlines, hooks, primary text, and structural copies using `difflib.SequenceMatcher`. Flags convergent output before it ships.
- **Human Approval Layer** — Approve/reject any ad with notes. Rejection blocks progression. Approval gates A/B variant generation.
- **Trust Center** — Aggregates evaluator confidence, score consistency, compliance pass rates, dimension agreement, and surfaces ads needing human review.

### A/B Testing & Variants

- **Variant Generator** — Creates hook variant + CTA variant from winning copy using LLM, each with a testable hypothesis.
- **Experiment-Ready Status** — Only human-approved ads with variants can be marked experiment-ready for live testing.

### Human-in-the-Loop

- **Manual Refinement** — Natural language instructions trigger a new copy iteration with the human directive as highest priority.
- **On-Demand Image Generation** — Lazy mode defers image generation until a user clicks, with per-user SHA256 prompt caching.

### Real-Time Architecture

- **SSE Broadcasting** — Thread-safe Server-Sent Events push every pipeline event (iteration scores, compliance results, diversity signals, errors) to all connected clients.
- **Live Pipeline Flow** — Animated step visualization (Brief → Generate → Evaluate → Iterate → Comply → Image → Done) with active stage highlighting.

### Cost Intelligence

- **Per-Token Tracking** — Every API call logged with model, input/output tokens, latency, and USD cost.
- **Marginal Cost Analysis** — Visualization of cost vs. score lift per iteration step — answers "is the 3rd iteration worth the spend?"
- **Quality-per-Dollar** — Each ad scored on quality/cost ratio for ROI optimization.
- **Runtime Model Selection** — Switch between 10+ models per role (draft, refine, evaluation, vision, image) without restarting.

---

## Engineering Highlights

| Feature | Implementation |
|---|---|
| Batched scoring | 5 LLM calls fire concurrently via `asyncio.gather` — cuts eval latency ~5x |
| Early stopping | Score checked after each iteration; ≥ 9.0 exits loop immediately |
| SSE broadcasting | Thread-safe broadcaster pushes events to all connected clients in real-time |
| Readiness workflow | 8-state lifecycle with human-decision preservation across recomputation |
| Compliance gate | Zero-cost rule-based checker (Meta ad policies) — no LLM calls |
| Diversity gate | Zero-cost string similarity checker — catches near-duplicates instantly |
| Human steering | `POST /api/ads/{id}/refine` triggers a new iteration with custom instructions |
| Image caching | Per-user cache with SHA256 prompt hashing — no duplicate generations |
| Cost telemetry | Every API call logged with input/output tokens, latency, model, and USD cost |
| Runtime config | PATCH endpoints for model and pipeline settings — changes apply on next run |
| Rate limiting | Request-level rate limiter to stay within OpenRouter quotas |

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/pipeline/run` | Start pipeline (mode, count, image_mode, custom_brief) |
| `POST` | `/api/pipeline/stop` | Stop running pipeline |
| `GET` | `/api/pipeline/status` | Pipeline status + progress |
| `GET` | `/api/pipeline/history` | Run history |
| `GET` | `/api/ads` | List ads (sort, filter, min_score) |
| `GET` | `/api/ads/{id}` | Ad detail with full iteration history |
| `POST` | `/api/ads/{id}/refine` | Human-in-the-loop refinement |
| `POST` | `/api/ads/{id}/generate-image` | On-demand image generation |
| `POST` | `/api/ads/{id}/compliance` | Run compliance check |
| `POST` | `/api/ads/{id}/diversity` | Run diversity check |
| `POST` | `/api/ads/{id}/variants` | Generate A/B variants |
| `POST` | `/api/ads/{id}/approve` | Human approval |
| `POST` | `/api/ads/{id}/reject` | Human rejection |
| `POST` | `/api/ads/{id}/mark-experiment-ready` | Mark experiment-ready |
| `GET` | `/api/costs/summary` | Cost summary |
| `GET` | `/api/costs/ledger` | Full cost ledger |
| `GET` | `/api/config` | Engine configuration |
| `PATCH` | `/api/config/models` | Update model assignments |
| `PATCH` | `/api/config/pipeline` | Update pipeline settings |
| `GET` | `/api/trust` | Trust center signals |
| `GET` | `/api/briefs/presets` | Brief presets |
| `GET` | `/api/events/stream` | SSE event stream |
| `GET` | `/api/calibration/latest` | Calibration data |

---

## Output

Results saved to `output/reports/`:

| File | Content |
|---|---|
| `final_results.json` | Full results with all iteration history |
| `best_ads.csv` | Flat CSV with best version per ad |
| `iteration_history.json` | Iteration-by-iteration data |
| `report.md` | Summary report with top ads and statistics |
| `cost_summary.json` | Cost breakdown by model and stage |
| `cost_ledger.json` | Every API call logged |
| `run_history.json` | Historical run metadata |

---

## Project Structure

```
nerdy-ad-engine/
├── main.py                              # CLI entry point
├── docker-compose.yml                   # Docker orchestration
├── Dockerfile.backend / .frontend       # Container definitions
├── config/
│   ├── settings.py                      # Models, thresholds, costs (env-configurable)
│   ├── brand_guidelines.py              # Varsity Tutors brand voice + proof points
│   └── evaluation_rubrics.py            # 5-dimension scoring rubrics + image rubric
├── src/
│   ├── models.py                        # Core Pydantic models (AdResult, CopyIteration, etc.)
│   ├── pipeline.py                      # Main orchestrator
│   ├── generate/
│   │   ├── copy_generator.py            # LLM-based ad copy generation
│   │   ├── image_generator.py           # Gemini image generation
│   │   └── variant_generator.py         # A/B test variant generation
│   ├── evaluate/
│   │   ├── copy_evaluator.py            # 5-dimension orchestrator
│   │   ├── batched_scorer.py            # Concurrent dimension scoring
│   │   ├── dimension_scorer.py          # Single-dimension LLM scorer
│   │   ├── image_evaluator.py           # Vision-based image evaluation
│   │   ├── compliance_checker.py        # Rule-based Meta ad policy checker
│   │   └── diversity_checker.py         # Rule-based near-duplicate detector
│   ├── iterate/
│   │   ├── copy_iterator.py             # Copy feedback loop (max 3 iterations)
│   │   ├── image_iterator.py            # Image feedback loop (max 3 iterations)
│   │   └── best_selector.py             # Best version selection
│   ├── intelligence/
│   │   ├── competitor_analyzer.py       # Competitive intelligence
│   │   └── brief_factory.py             # Ad brief generation
│   ├── tracking/
│   │   ├── cost_tracker.py              # Per-token cost tracking
│   │   ├── rate_limiter.py              # API rate limiting
│   │   └── langsmith_tracer.py          # LangSmith integration
│   └── output/
│       ├── formatter.py                 # JSON/CSV/Markdown export
│       └── visualizer.py                # Charts and graphs
├── server/
│   ├── app.py                           # FastAPI application + CORS + lifespan
│   ├── sse.py                           # Thread-safe SSE broadcaster
│   ├── state.py                         # In-memory run store (singleton)
│   ├── runner.py                        # Background pipeline runner with SSE
│   └── routes/
│       ├── pipeline.py                  # Run, stop, status, history
│       ├── ads.py                       # CRUD, refine, approve, reject, compliance, diversity, variants
│       ├── costs.py                     # Summary + ledger
│       ├── config.py                    # GET config + PATCH models/pipeline
│       ├── trust.py                     # Trust center aggregation
│       ├── briefs.py                    # Brief presets
│       ├── events.py                    # SSE stream
│       └── calibration.py              # Score calibration analysis
├── web/
│   ├── index.html
│   ├── public/favicon.svg               # Orange branded favicon
│   └── src/
│       ├── App.tsx                       # Router + ThemeProvider + dark mode
│       ├── theme.ts                     # MUI theme with createAppTheme(mode)
│       ├── hooks/usePageTitle.ts         # Dynamic document.title
│       ├── components/
│       │   ├── Layout.tsx               # Sidebar + top bar + dark mode toggle
│       │   ├── PipelineFlow.tsx         # Animated pipeline stage visualization
│       │   ├── AdCard.tsx               # Gallery card component
│       │   ├── IterationTimeline.tsx    # Vertical iteration history
│       │   └── ScoreChip.tsx            # Score badge with color coding
│       ├── pages/
│       │   ├── Dashboard.tsx            # Main dashboard with charts
│       │   ├── AdGallery.tsx            # Filterable ad library
│       │   ├── AdDetail.tsx             # Full ad deep-dive (6 tabs + approval)
│       │   ├── AdCompare.tsx            # Side-by-side comparison
│       │   ├── Analysis.tsx             # Evaluation + diversity + marginal cost
│       │   ├── TrustCenter.tsx          # Trust signals + escalation
│       │   ├── CostDashboard.tsx        # Cost analytics
│       │   ├── RunPipeline.tsx          # Pipeline launcher + history
│       │   └── Settings.tsx             # Model selection + pipeline tuning
│       ├── api/
│       │   ├── endpoints.ts             # 25+ typed API functions
│       │   ├── client.ts                # Axios client with interceptors
│       │   ├── useSSE.ts                # SSE React hook
│       │   └── clientId.ts              # Per-user client ID
│       └── types/index.ts              # TypeScript interfaces
├── tests/
├── output/
└── docs/
```

---

## Testing

```bash
pytest tests/ -v
```

---

## Models

Default models (configurable at runtime via Settings page or API):

| Role | Model | Why |
|---|---|---|
| Draft (copy generation) | `google/gemini-3-flash-preview` | Fast, creative, cheap |
| Refine (iteration) | `google/gemini-3-flash-preview` | Same quality for targeted edits |
| Evaluation (scoring) | `google/gemini-3.1-flash-lite-preview` | Cheapest — most frequent calls |
| Vision (image eval) | `google/gemini-3-flash-preview` | Multimodal capability required |
| Image (generation) | `google/gemini-3.1-flash-image-preview` | Native image output |

10+ alternative models available per role including Claude Sonnet 4, GPT-4o, Llama 4, DeepSeek R1.
