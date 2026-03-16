# Nerdy Ad Engine

Autonomous AI-powered ad generation system with built-in quality evaluation, cost governance, human review workflows, and experiment orchestration.

## What It Does
- Generates ad copy using Gemini models with structured briefs
- Evaluates each ad across 5 quality dimensions with weighted scoring
- Iterates automatically until quality thresholds are met (early stopping)
- Tracks every API call's cost with ledger-backed accounting
- Routes ads through a human review queue with bulk approve/reject
- Learns from prior runs and injects insights into future generation
- Packages experiment-ready ads into structured launch packs
- Full trust center with evaluator confidence, compliance, and audit signals

## Architecture
```
Brief -> Generate -> Evaluate -> Iterate -> Review -> Approve -> Experiment
                                  ^                               |
                             Cost Tracker                  Insight Memory
```

## Key Engineering Decisions
- **Batched evaluation with early stopping**: Saves tokens by stopping iteration when quality threshold is met
- **DB-backed cost ledger**: Survives Railway redeploys, reconciles with image generation costs
- **Client-scoped everything**: Ads, costs, trust signals, and history are all scoped per session
- **Insight memory**: System extracts patterns from completed runs and feeds them back into generation prompts
- **Status governance**: Refining an approved ad resets it to needs_review — no silent state corruption

## Tech Stack
- **Backend**: Python 3.11, FastAPI, SQLAlchemy + PostgreSQL
- **Frontend**: React 19, TypeScript, MUI 6, Recharts
- **AI**: Google Gemini (2.5 Flash for generation/evaluation, image generation)
- **Deploy**: Docker, Railway

## Quick Start
```bash
# With Docker
docker-compose up

# Local development
cd web && npm install && npm run dev  # Frontend on :5173
python -m uvicorn server.app:app --reload  # Backend on :8000
```

## Pages
| Page | Purpose |
|------|---------|
| Dashboard | Pipeline overview, score distribution, dimension analysis |
| Ad Library | Browse, filter, search all generated ads |
| Review Queue | Prioritized review inbox with bulk approve/reject |
| Ad Detail | Full editorial view with approve/reject/refine workflow |
| Evaluation | Cross-ad analysis, radar charts, score distribution |
| Trust Center | Evaluator confidence, compliance rates, audit signals |
| Cost Analytics | Token costs, API call tracking, cost per ad |
| Insights | What the system learned across runs |
| Experiments | Structured launch packs for A/B testing |
| Settings | Engine configuration and model parameters |

## Project Structure
```
├── src/                  # Core engine
│   ├── generate/         # Copy + variant + image generation
│   ├── evaluate/         # Dimension scoring + rubrics
│   ├── intelligence/     # Insight extraction + memory
│   └── tracking/         # Cost tracking
├── server/               # FastAPI backend
│   ├── routes/           # API endpoints
│   └── database.py       # PostgreSQL models + CRUD
├── web/                  # React frontend
│   └── src/pages/        # Dashboard, Gallery, Review, etc.
└── config/               # Settings, rubrics, prompts
```
