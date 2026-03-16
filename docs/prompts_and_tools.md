# Prompts, Models & Tools

How the Nerdy Ad Engine uses AI and what tools it is built with.

## AI Models Used

| Role | Model | Why |
|---|---|---|
| Draft generation | `google/gemini-3-flash-preview` | Fast, high-quality copy generation at low cost |
| Refinement | `google/gemini-3-flash-preview` | Same model, lower temperature (more focused rewrites) |
| Evaluation | `google/gemini-3.1-flash-lite-preview` | Lightweight model keeps scoring cheap; each ad requires 5 separate scoring calls |
| Fallback (gen) | `google/gemini-2.5-flash-preview` | Automatic failover if primary model errors |
| Fallback (eval) | `google/gemini-2.0-flash-exp:free` | Free-tier fallback for evaluation |
| Image generation | Gemini Imagen | Currently disabled (`IMAGE_GENERATION_ENABLED=false`) |

All models are accessed via OpenRouter. LangChain's `ChatOpenAI` client handles the interface.

## Generation Prompt Strategy

**System prompt** establishes the persona: a world-class performance marketer writing Facebook/Instagram ads for Varsity Tutors SAT prep. It includes:

- Full brand voice guidelines (injected from `config/brand_guidelines.py`)
- Approved CTA buttons (Learn More, Sign Up, Get Started, Book Now, Apply Now)
- Strict ad format rules: hook under 125 chars, 2-4 short body paragraphs, 5-8 word headline, 8-15 word description
- Six proven hook frameworks (stat shock, micro-story, direct callout, contrarian, before/after, question + agitate)
- Anti-patterns to avoid (generic openers, vague benefits, filler phrases)
- Meta platform best practices for 2025

**User message** provides the specific brief: audience segment with pain points and motivators, product offer, campaign goal, tone, competitor patterns, and insights from prior runs. Output is structured JSON with four fields: `primary_text`, `headline`, `description`, `cta_button`.

## Evaluation Prompt Strategy

Each ad is scored independently on 5 dimensions, one LLM call per dimension:

| Dimension | Weight | What It Measures |
|---|---|---|
| Clarity | 0.20 | Message understandable in under 3 seconds |
| Value Proposition | 0.25 | Specific, compelling, differentiated benefit |
| CTA Strength | 0.20 | Clear, urgent, low-friction next step |
| Brand Voice | 0.15 | Sounds like Varsity Tutors (empowering, approachable, results-focused) |
| Emotional Resonance | 0.20 | Taps into real parent/student motivations |

Each rubric prompt includes:
- Detailed scoring anchors (1-10 with specific examples at each level)
- The full ad copy and brief context (audience, campaign goal)
- Calibration instructions: "7 means good with clear room for improvement, 9+ should be rare"
- Structured JSON output: `score`, `rationale`, `confidence`, `suggestions`

The weighted average produces a single quality score. The quality threshold is 7.0.

## Refinement Prompt Strategy

Refinement targets the weakest dimension. The prompt includes:

- Full scorecard across all 5 dimensions with markers: "FIX THIS" on weakest, "PROTECT" on 8+, "could improve" on the rest
- The evaluator's rationale and specific suggestions for the weakest dimension
- The current ad copy verbatim
- Rules: protect high-scoring parts, focus changes on the weakest dimension, tighten rather than expand, raise weakest by at least 1 point without dropping others

This is a generate-evaluate-refine loop: draft, score on 5 dimensions, rewrite targeting the weakest, re-score, repeat.

## Tech Stack

**Backend**: Python 3.12, FastAPI, SQLAlchemy (PostgreSQL), LangChain, LangSmith (tracing)
**Frontend**: React 18, Material UI (MUI), Recharts for data visualization
**Infrastructure**: Docker, Railway (deployment), PostgreSQL (persistence)
**API Gateway**: OpenRouter (unified access to Gemini models)

## AI Tools Used in Development

- **Claude Code** (Anthropic) — Implementation assistance throughout development: architecture decisions, prompt engineering, debugging, and code generation.
