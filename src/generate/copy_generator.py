"""Ad copy generator using LLM via OpenRouter."""

from __future__ import annotations

import json
import time

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from src.models import AdBrief, AdCopy, StepCost
from src.tracking.cost_tracker import CostTracker, extract_token_usage
from src.tracking.langsmith_tracer import get_callbacks, get_run_metadata
from src.tracking.rate_limiter import RateLimiter
from config.settings import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    MODEL_DRAFT,
    MODEL_REFINE,
    MODEL_DRAFT_FALLBACK,
    MODEL_REFINE_FALLBACK,
    LLM_TEMPERATURE,
    LLM_REFINE_TEMPERATURE,
    LLM_MAX_OUTPUT_TOKENS,
)
from src.tracking.resilient_call import resilient_invoke
from config.brand_guidelines import (
    BRAND_VOICE,
    APPROVED_CTAS,
    AUDIENCE_PROFILES,
)


SYSTEM_PROMPT = """You are a world-class performance marketer and direct-response copywriter. You write Facebook/Instagram ads for Varsity Tutors (a Nerdy company) — specifically for SAT test prep.

Your ads routinely achieve 3-5x ROAS. You understand Meta's algorithm: thumb-stopping hooks, native-feeling copy, and emotional triggers that drive action.

BRAND VOICE:
{brand_voice}

CRITICAL AD FORMAT RULES:
- Primary text line 1 (THE HOOK): Must be a scroll-stopping pattern interrupt. Under 125 chars. This determines 80% of ad performance. Use one of: bold claim, shocking stat, relatable question, micro-story opener, or direct callout.
- Primary text body (2-4 short paragraphs): Story arc of Pain → Agitate → Solution → Proof → CTA. Use line breaks for readability. Keep each paragraph 1-3 sentences max.
- Headline: 5-8 words. Benefit-driven. Use power words (free, proven, guaranteed, instant, exclusive). Do NOT repeat the hook.
- Description: 8-15 words. Reinforce urgency or social proof. Make it complement the headline.
- CTA button: Must be one of: {approved_ctas}

WHAT WINS ON META IN 2025:
- Native > promotional. Ads that feel like posts from a friend outperform polished brand ads 3:1.
- Specificity sells. "200+ point average improvement" beats "boost your score" every time.
- Short paragraphs. Mobile users scan — no paragraph should exceed 2 sentences.
- Emoji used sparingly (1-2 max) as visual anchors, not decoration.
- Social proof is king: testimonials, stats, before/after results, number of students helped.
- Direct address ("you", "your child") creates personal connection.
- End primary text with a clear, low-friction call to action that mirrors the CTA button.

PROVEN HOOK FRAMEWORKS (use and adapt these):
- Stat shock: "93% of students who prep with a tutor score 200+ points higher. Here's why."
- Micro-story: "My daughter was averaging 1050 on practice tests. 8 weeks later, she scored 1410."
- Direct callout: "Parents of juniors: the March SAT is 90 days away."
- Contrarian: "Stop spending $2,000 on SAT prep books your kid will never open."
- Before/after: "From 'I can't do this' to 'I got into my dream school.'"
- Question + agitate: "What if your child misses their dream school by 50 points?"

AVOID these common weak patterns:
- Generic openers: "Are you looking for...", "Do you want to...", "Introducing..."
- Vague benefits: "improve your scores", "get better results", "reach your potential"
- Overused CTAs: "Don't miss out!", "Act now!", "Limited time!"
- Filler phrases: "In today's competitive world...", "As a parent, you know..."
- Repeating the headline in the primary text opening

LENGTH RULES:
- Headline: 5-8 words maximum, punchy and specific
- Primary text: 3-5 short sentences, front-load the hook
- Description: 1 sentence, 10-20 words, complements (never repeats) the headline
- CTA button: Use ONLY standard Meta buttons: Learn More, Sign Up, Get Started, Book Now, Apply Now

ADVANCED TECHNIQUES:
- Use em dashes for emphasis — they create visual pauses that draw the eye.
- Front-load the value. Put the most compelling benefit in the first 3 words of the headline.
- Create urgency without being sleazy (limited spots, upcoming test dates, registration deadlines).
- Mirror the audience's internal dialogue. Parents think: "Am I doing enough?" Students think: "What if I'm not smart enough?"

You MUST respond with ONLY valid JSON in this format:
{{"primary_text": "...", "headline": "...", "description": "...", "cta_button": "..."}}"""


REFINEMENT_PROMPT = """The previous ad copy scored {avg_score}/10 overall. We need to push it higher — every 0.5 point matters.

FULL SCORECARD (all 5 dimensions):
{all_dimension_scores}

PRIORITY FIX — WEAKEST DIMENSION: {weakest_dimension} (scored {weakest_score}/10)
Evaluator feedback: {weakest_rationale}
Specific suggestions: {suggestions}

CURRENT AD COPY (this is what you're improving):
Primary Text: {primary_text}
Headline: {headline}
Description: {description}
CTA: {cta_button}

REFINEMENT RULES — READ CAREFULLY:
1. PROTECT what scored 8+. Do NOT rewrite parts that are already strong. Copy those sections verbatim or with only minor tweaks. Preserve dimensions scoring 8.0 or higher — do NOT change what's already working.
2. FOCUS changes ONLY on the weakest dimension and its specific suggestions. That's where the biggest score gain is. Apply the specific suggestions above.
3. ALSO bump any dimension below 8.0 — small targeted edits, not full rewrites.
4. KEEP the same overall structure and hook approach if it scored well on clarity. Keep the same hook framework; change wording, not structure. Changing everything = regression.
5. TIGHTEN, don't expand. Shorter copy almost always scores higher on clarity. Cut filler words ruthlessly.
6. The headline should complement (never repeat) the primary text hook.
7. Your goal: raise the weakest dimension by at least 1 point without dropping any other dimension.

You MUST respond with ONLY valid JSON in this format:
{{"primary_text": "...", "headline": "...", "description": "...", "cta_button": "..."}}"""


def _get_relevant_insights(audience: str, goal: str) -> str:
    """Load insights from DB and format for prompt injection."""
    try:
        from server.database import load_insights_from_db
        insights = load_insights_from_db(audience=audience, goal=goal)
        if not insights:
            return ""
        lines = [f"- {i['insight_text']}" for i in insights[:5]]  # top 5
        return "\n\nINSIGHTS FROM PRIOR RUNS:\n" + "\n".join(lines)
    except Exception:
        return ""


class CopyGenerator:
    def __init__(self):
        self.draft_llm = ChatOpenAI(
            model=MODEL_DRAFT,
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
            temperature=LLM_TEMPERATURE,
            max_tokens=LLM_MAX_OUTPUT_TOKENS,
        )
        self.refine_llm = ChatOpenAI(
            model=MODEL_REFINE,
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
            temperature=LLM_REFINE_TEMPERATURE,
            max_tokens=LLM_MAX_OUTPUT_TOKENS,
        )
        self.tracker = CostTracker()
        self.rate_limiter = RateLimiter()

    def generate(
        self,
        brief: AdBrief,
        iteration: int = 1,
        feedback: str | None = None,
        previous_copy: AdCopy | None = None,
    ) -> tuple[AdCopy, list[StepCost]]:
        """Generate ad copy. Returns (ad_copy, costs)."""
        is_refinement = feedback is not None and previous_copy is not None
        model_name = MODEL_REFINE if is_refinement else MODEL_DRAFT
        llm = self.refine_llm if is_refinement else self.draft_llm

        audience = AUDIENCE_PROFILES.get(brief.audience_segment.value, {})

        system_msg = SYSTEM_PROMPT.format(
            brand_voice=json.dumps(BRAND_VOICE, indent=2),
            approved_ctas=", ".join(APPROVED_CTAS),
        )

        if is_refinement:
            user_msg = feedback
        else:
            competitor_context = ""
            if brief.competitor_context:
                competitor_context = (
                    "\n\nCOMPETITOR PATTERNS TO LEARN FROM (adapt, don't copy):\n"
                    + "\n".join(f"- {p}" for p in brief.competitor_context)
                )

            # Load relevant insights from prior runs
            insights_section = _get_relevant_insights(
                brief.audience_segment.value, brief.campaign_goal.value
            )

            user_msg = f"""Generate a Facebook/Instagram ad for Varsity Tutors SAT prep.

AUDIENCE: {brief.audience_segment.value} — {audience.get('description', '')}
Pain points: {', '.join(audience.get('pain_points', []))}
Motivators: {', '.join(audience.get('motivators', []))}

PRODUCT/OFFER: {brief.product_offer}
CAMPAIGN GOAL: {brief.campaign_goal.value}
TONE: {brief.tone}
{competitor_context}{insights_section}

Generate compelling ad copy that will stop the scroll and drive {brief.campaign_goal.value}."""

        callbacks = get_callbacks(
            pipeline_stage="copy_generation",
            iteration=iteration,
            brief_id=brief.brief_id,
            extra_tags=["refinement" if is_refinement else "initial"],
        )

        self.rate_limiter.wait_if_needed()

        fallback = MODEL_REFINE_FALLBACK if is_refinement else MODEL_DRAFT_FALLBACK

        start = time.perf_counter()
        response = resilient_invoke(
            llm,
            [SystemMessage(content=system_msg), HumanMessage(content=user_msg)],
            config={
                "callbacks": callbacks,
                "metadata": get_run_metadata(
                    pipeline_stage="copy_generation",
                    iteration=iteration,
                    brief_id=brief.brief_id,
                    step_name="generate_copy" if not is_refinement else "refine_copy",
                ),
                "tags": [f"brief:{brief.brief_id}", f"iter:{iteration}"],
            },
            fallback_model=fallback,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        input_tokens, output_tokens = extract_token_usage(response)

        cost = self.tracker.record(
            model=model_name,
            step_name="generate_copy" if not is_refinement else "refine_copy",
            pipeline_stage="copy_generation",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=elapsed_ms,
            iteration=iteration,
            brief_id=brief.brief_id,
        )

        ad_copy = self._parse_response(response.content)
        return ad_copy, [cost]

    def build_refinement_prompt(
        self,
        previous_copy: AdCopy,
        evaluation,
    ) -> str:
        """Build a targeted refinement prompt based on evaluation results."""
        weakest = evaluation.scores[evaluation.weakest_dimension]

        # Build full scorecard so the LLM sees all dimensions
        score_lines = []
        for dim_name, dim_score in evaluation.scores.items():
            label = dim_name.replace("_", " ").title()
            marker = " ← FIX THIS" if dim_name == evaluation.weakest_dimension else (
                " ✓ PROTECT" if dim_score.score >= 8.0 else " (could improve)"
            )
            suggestions_str = "; ".join(dim_score.suggestions) if dim_score.suggestions else ""
            score_lines.append(
                f"  {label}: {dim_score.score}/10{marker}"
                + (f"\n    Suggestions: {suggestions_str}" if suggestions_str and dim_score.score < 8.0 else "")
            )

        return REFINEMENT_PROMPT.format(
            avg_score=evaluation.weighted_average,
            all_dimension_scores="\n".join(score_lines),
            weakest_dimension=evaluation.weakest_dimension.replace("_", " ").title(),
            weakest_score=weakest.score,
            weakest_rationale=weakest.rationale,
            suggestions="; ".join(weakest.suggestions) if weakest.suggestions else "No specific suggestions",
            primary_text=previous_copy.primary_text,
            headline=previous_copy.headline,
            description=previous_copy.description,
            cta_button=previous_copy.cta_button,
        )

    @staticmethod
    def _extract_json_object(text: str) -> dict:
        """Extract the first complete JSON object from text, handling nested braces."""
        start = text.find('{')
        if start == -1:
            return {}
        depth = 0
        in_string = False
        escape_next = False
        for i in range(start, len(text)):
            c = text[i]
            if escape_next:
                escape_next = False
                continue
            if c == '\\' and in_string:
                escape_next = True
                continue
            if c == '"' and not escape_next:
                in_string = not in_string
                continue
            if in_string:
                continue
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        return {}
        return {}

    def _parse_response(self, content: str) -> AdCopy:
        """Parse LLM response into AdCopy, handling markdown code blocks."""
        text = content.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            data = self._extract_json_object(text)
            if not data:
                data = {
                    "primary_text": text[:200],
                    "headline": "Boost Your SAT Score",
                    "description": "Expert 1-on-1 tutoring",
                    "cta_button": "Get Started",
                }

        return AdCopy(
            primary_text=data.get("primary_text", ""),
            headline=data.get("headline", ""),
            description=data.get("description", ""),
            cta_button=data.get("cta_button", "Learn More"),
        )
