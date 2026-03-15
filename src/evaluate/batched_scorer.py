"""Batched dimension scoring — all 5 dimensions in a single LLM call.

Reduces evaluation from 5 API calls to 1, cutting pipeline time by ~60%.
"""

from __future__ import annotations

import json
import logging
import time
logger = logging.getLogger(__name__)

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from src.models import AdBrief, AdCopy, DimensionScore, StepCost
from src.tracking.cost_tracker import CostTracker, extract_token_usage
from src.tracking.langsmith_tracer import get_callbacks, get_run_metadata
from src.tracking.rate_limiter import RateLimiter
from config.settings import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    MODEL_EVAL,
    MODEL_EVAL_FALLBACK,
    LLM_EVAL_TEMPERATURE,
)
from src.tracking.resilient_call import resilient_invoke
from config.evaluation_rubrics import DIMENSION_RUBRICS, DIMENSION_WEIGHTS


BATCHED_EVAL_PROMPT = """You are an expert ad copy evaluator. Score this Facebook/Instagram ad for Varsity Tutors SAT prep on ALL 5 dimensions below.

═══ AD COPY ═══
Primary Text: {primary_text}
Headline: {headline}
Description: {description}
CTA: {cta_button}

Audience: {audience_segment}
Campaign Goal: {campaign_goal}

═══ SCORING DIMENSIONS ═══

1. CLARITY (weight {w_clarity}): Is the message immediately understandable in <3 seconds?
   1-2: Confusing | 3-4: Buried message | 5-6: Clear but needs re-reading | 7-8: Crystal clear | 9-10: Instantly lands

2. VALUE PROPOSITION (weight {w_value}): Does it communicate a specific, compelling, differentiated benefit?
   1-2: No benefit stated | 3-4: Vague benefit | 5-6: Generic | 7-8: Specific and compelling | 9-10: Irresistible with proof

3. CTA STRENGTH (weight {w_cta}): Is the call-to-action clear, urgent, and low-friction?
   1-2: No CTA | 3-4: Weak/high-friction | 5-6: Decent but no urgency | 7-8: Clear and specific | 9-10: Urgent with scarcity

4. BRAND VOICE (weight {w_brand}): Does it sound like Varsity Tutors — empowering, knowledgeable, approachable, results-focused?
   1-2: Generic tone | 3-4: Inconsistent | 5-6: Appropriate but bland | 7-8: Distinctly on-brand | 9-10: Unmistakable

5. EMOTIONAL RESONANCE (weight {w_emotion}): Does it tap into real motivation (parent anxiety, student ambition, test anxiety)?
   1-2: Flat/rational only | 3-4: Forced emotion | 5-6: Some resonance | 7-8: Reader feels understood | 9-10: Deeply resonant

═══ CALIBRATION ═══
A 7 means "good with clear room for improvement." 9+ is rare. Use decimals (6.5, 7.3). Do NOT cluster all scores at 7-8.

Think step by step for each dimension, then respond in this exact JSON format:
{{
  "clarity": {{"score": <float>, "rationale": "<reasoning>", "confidence": <float 0-1>, "suggestions": ["<tip1>", "<tip2>"]}},
  "value_proposition": {{"score": <float>, "rationale": "<reasoning>", "confidence": <float 0-1>, "suggestions": ["<tip1>", "<tip2>"]}},
  "cta_strength": {{"score": <float>, "rationale": "<reasoning>", "confidence": <float 0-1>, "suggestions": ["<tip1>", "<tip2>"]}},
  "brand_voice": {{"score": <float>, "rationale": "<reasoning>", "confidence": <float 0-1>, "suggestions": ["<tip1>", "<tip2>"]}},
  "emotional_resonance": {{"score": <float>, "rationale": "<reasoning>", "confidence": <float 0-1>, "suggestions": ["<tip1>", "<tip2>"]}}
}}"""


class BatchedScorer:
    """Scores ad copy on all 5 dimensions in a single LLM call."""

    def __init__(self):
        self.llm = ChatOpenAI(
            model=MODEL_EVAL,
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
            temperature=LLM_EVAL_TEMPERATURE,
            max_tokens=2048,  # More headroom for 5 dimensions
        )
        self.tracker = CostTracker()
        self.rate_limiter = RateLimiter()

    def score_all(
        self,
        ad_copy: AdCopy,
        brief: AdBrief,
        iteration: int = 1,
    ) -> tuple[list[DimensionScore], StepCost]:
        """Score all dimensions in one call. Returns (scores, cost)."""
        prompt_text = BATCHED_EVAL_PROMPT.format(
            primary_text=ad_copy.primary_text,
            headline=ad_copy.headline,
            description=ad_copy.description,
            cta_button=ad_copy.cta_button,
            audience_segment=brief.audience_segment.value,
            campaign_goal=brief.campaign_goal.value,
            w_clarity=DIMENSION_WEIGHTS.get("clarity", 0.2),
            w_value=DIMENSION_WEIGHTS.get("value_proposition", 0.25),
            w_cta=DIMENSION_WEIGHTS.get("cta_strength", 0.2),
            w_brand=DIMENSION_WEIGHTS.get("brand_voice", 0.15),
            w_emotion=DIMENSION_WEIGHTS.get("emotional_resonance", 0.2),
        )

        callbacks = get_callbacks(
            pipeline_stage="evaluation",
            iteration=iteration,
            brief_id=brief.brief_id,
            extra_tags=["batched_eval"],
        )

        self.rate_limiter.wait_if_needed()

        start = time.perf_counter()
        response = resilient_invoke(
            self.llm,
            [HumanMessage(content=prompt_text)],
            config={
                "callbacks": callbacks,
                "metadata": get_run_metadata(
                    pipeline_stage="evaluation",
                    iteration=iteration,
                    brief_id=brief.brief_id,
                    step_name="score_all_dimensions",
                ),
                "tags": [f"brief:{brief.brief_id}", "batched_eval"],
            },
            fallback_model=MODEL_EVAL_FALLBACK,
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        input_tokens, output_tokens = extract_token_usage(response)

        cost = self.tracker.record(
            model=MODEL_EVAL,
            step_name="score_all_dimensions",
            pipeline_stage="evaluation",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=elapsed_ms,
            iteration=iteration,
            brief_id=brief.brief_id,
        )

        scores = self._parse_batched_response(response.content)
        return scores, cost

    def _parse_batched_response(self, content: str) -> list[DimensionScore]:
        """Parse the batched response into 5 DimensionScore objects."""
        text = content.strip()

        # Strip markdown code fences
        if "```" in text:
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)

        data = self._extract_json(text)

        scores: list[DimensionScore] = []
        for dimension in DIMENSION_RUBRICS:
            dim_data = data.get(dimension, {})
            if not isinstance(dim_data, dict):
                dim_data = {}

            raw_score = dim_data.get("score")
            if raw_score is None:
                # Try to find score in a flat format
                raw_score = data.get(f"{dimension}_score", 5.0)

            score_val = float(raw_score if raw_score is not None else 5.0)
            score_val = max(1.0, min(10.0, score_val))

            scores.append(DimensionScore(
                dimension=dimension,
                score=score_val,
                rationale=dim_data.get("rationale", f"Batched evaluation — {dimension}"),
                confidence=float(dim_data.get("confidence", 0.7 if dim_data.get("rationale") else 0.3)),
                suggestions=dim_data.get("suggestions", []),
            ))

        return scores

    @staticmethod
    def _extract_json(text: str) -> dict:
        """Extract JSON from LLM response, with fallbacks."""
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try finding the outermost { ... }
        start = text.find("{")
        if start == -1:
            return {}

        # Find matching closing brace
        depth = 0
        in_string = False
        escape_next = False
        for i in range(start, len(text)):
            c = text[i]
            if escape_next:
                escape_next = False
                continue
            if c == "\\" and in_string:
                escape_next = True
                continue
            if c == '"' and not escape_next:
                in_string = not in_string
                continue
            if in_string:
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        return {}

        return {}
