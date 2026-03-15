"""Individual dimension scoring via separate LLM calls."""

from __future__ import annotations

import json
import logging
import time
import re

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
    LLM_EVAL_TEMPERATURE,
)
from config.evaluation_rubrics import DIMENSION_RUBRICS


class DimensionScorer:
    """Scores ad copy on a single quality dimension via LLM."""

    def __init__(self):
        self.llm = ChatOpenAI(
            model=MODEL_EVAL,
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
            temperature=LLM_EVAL_TEMPERATURE,
            max_tokens=1024,
        )
        self.tracker = CostTracker()
        self.rate_limiter = RateLimiter()

    def score(
        self,
        ad_copy: AdCopy,
        brief: AdBrief,
        dimension: str,
        iteration: int = 1,
    ) -> tuple[DimensionScore, StepCost]:
        """Score a single dimension. Returns (score, cost)."""
        rubric = DIMENSION_RUBRICS[dimension]

        prompt_text = rubric["prompt"].format(
            primary_text=ad_copy.primary_text,
            headline=ad_copy.headline,
            description=ad_copy.description,
            cta_button=ad_copy.cta_button,
            audience_segment=brief.audience_segment.value,
            campaign_goal=brief.campaign_goal.value,
        )

        callbacks = get_callbacks(
            pipeline_stage="evaluation",
            iteration=iteration,
            brief_id=brief.brief_id,
            extra_tags=[f"dim:{dimension}"],
        )

        self.rate_limiter.wait_if_needed()

        start = time.perf_counter()
        response = self.llm.invoke(
            [HumanMessage(content=prompt_text)],
            config={
                "callbacks": callbacks,
                "metadata": get_run_metadata(
                    pipeline_stage="evaluation",
                    iteration=iteration,
                    brief_id=brief.brief_id,
                    step_name=f"score_{dimension}",
                ),
                "tags": [f"brief:{brief.brief_id}", f"dim:{dimension}"],
            },
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        input_tokens, output_tokens = extract_token_usage(response)

        cost = self.tracker.record(
            model=MODEL_EVAL,
            step_name=f"score_{dimension}",
            pipeline_stage="evaluation",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=elapsed_ms,
            iteration=iteration,
            brief_id=brief.brief_id,
        )

        dim_score = self._parse_score(response.content, dimension)
        return dim_score, cost

    @staticmethod
    def _extract_json_object(text: str) -> dict:
        """Extract the first complete JSON object from text, handling nested braces."""
        # Find the first '{' and match braces to find the complete object
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

    # Telemetry counters for parse outcomes across the scorer lifetime
    _parse_ok: int = 0
    _parse_fallback_json_extract: int = 0
    _parse_fallback_regex: int = 0
    _parse_fallback_default: int = 0

    @classmethod
    def parse_telemetry(cls) -> dict[str, int]:
        return {
            "json_ok": cls._parse_ok,
            "json_extract_fallback": cls._parse_fallback_json_extract,
            "regex_fallback": cls._parse_fallback_regex,
            "default_fallback": cls._parse_fallback_default,
        }

    def _parse_score(self, content: str, dimension: str) -> DimensionScore:
        """Parse LLM evaluation response into DimensionScore with structured fallbacks."""
        text = content.strip()
        parse_method = "json_ok"

        if "```" in text:
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)

        try:
            data = json.loads(text)
            DimensionScorer._parse_ok += 1
        except json.JSONDecodeError:
            data = self._extract_json_object(text)
            if data:
                parse_method = "json_extract_fallback"
                DimensionScorer._parse_fallback_json_extract += 1
            else:
                parse_method = "regex_fallback"

        raw_score = data.get("score")
        if raw_score is None and not data:
            score_match = re.search(r'(\d+(?:\.\d+)?)\s*/\s*10', text)
            if not score_match:
                score_match = re.search(r'[Ss]core[:\s]+(\d+(?:\.\d+)?)', text)
            if score_match:
                raw_score = float(score_match.group(1))
                DimensionScorer._parse_fallback_regex += 1
            else:
                logger.warning(
                    "Parse fallback for %s — defaulting to 5.0. Method: %s. Response: %.200s",
                    dimension, parse_method, text,
                )
                raw_score = 5.0
                parse_method = "default_fallback"
                DimensionScorer._parse_fallback_default += 1

        score = float(raw_score if raw_score is not None else 5.0)
        score = max(1.0, min(10.0, score))

        parsed_ok = bool(data.get("rationale"))

        if not parsed_ok:
            logger.info("Missing rationale for %s (parse_method=%s)", dimension, parse_method)

        raw_suggestions = data.get("suggestions", [])
        suggestions = raw_suggestions if isinstance(raw_suggestions, list) else (
            [raw_suggestions] if isinstance(raw_suggestions, str) else []
        )

        return DimensionScore(
            dimension=dimension,
            score=score,
            rationale=data.get("rationale", f"Parse fallback ({parse_method}) — no rationale extracted"),
            confidence=float(data.get("confidence", 0.7 if parsed_ok else 0.2)),
            suggestions=suggestions,
        )
