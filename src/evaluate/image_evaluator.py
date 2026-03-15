"""Image evaluation using vision model via OpenRouter."""

from __future__ import annotations

import json
import time
import base64
import re
from pathlib import Path

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

from src.models import AdCopy, ImageEvaluationResult, StepCost
from src.tracking.cost_tracker import CostTracker, extract_token_usage
from src.tracking.langsmith_tracer import get_callbacks, get_run_metadata
from src.tracking.rate_limiter import RateLimiter
from config.settings import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    MODEL_VISION,
    LLM_EVAL_TEMPERATURE,
)
from config.evaluation_rubrics import IMAGE_RUBRIC


class ImageEvaluator:
    """Evaluates ad creative images for brand fit and quality."""

    def __init__(self):
        self.llm = ChatOpenAI(
            model=MODEL_VISION,
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
            temperature=LLM_EVAL_TEMPERATURE,
            max_tokens=1024,
        )
        self.tracker = CostTracker()
        self.rate_limiter = RateLimiter()

    def evaluate(
        self,
        image_path: str,
        ad_copy: AdCopy,
        iteration: int = 1,
        brief_id: str = "",
    ) -> tuple[ImageEvaluationResult, StepCost]:
        """Evaluate an image. Returns (evaluation, cost)."""
        prompt_text = IMAGE_RUBRIC["prompt"].format(
            primary_text=ad_copy.primary_text,
            headline=ad_copy.headline,
        )

        image_data = Path(image_path).read_bytes()
        b64_image = base64.b64encode(image_data).decode()

        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt_text},
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64_image}"},
                },
            ]
        )

        callbacks = get_callbacks(
            pipeline_stage="image_evaluation",
            iteration=iteration,
            brief_id=brief_id,
        )

        self.rate_limiter.wait_if_needed()

        start = time.perf_counter()
        response = self.llm.invoke(
            [message],
            config={
                "callbacks": callbacks,
                "metadata": get_run_metadata(
                    pipeline_stage="image_evaluation",
                    iteration=iteration,
                    brief_id=brief_id,
                    step_name="evaluate_image",
                ),
            },
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        input_tokens, output_tokens = extract_token_usage(response)

        cost = self.tracker.record(
            model=MODEL_VISION,
            step_name="evaluate_image",
            pipeline_stage="image_evaluation",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=elapsed_ms,
            iteration=iteration,
            brief_id=brief_id,
        )

        result = self._parse_response(response.content)
        return result, cost

    def _parse_response(self, content: str) -> ImageEvaluationResult:
        text = content.strip()
        if "```" in text:
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            json_match = re.search(r'\{[^{}]*\}', text, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group())
                except json.JSONDecodeError:
                    data = {}
            else:
                data = {}

        return ImageEvaluationResult.compute(
            brand_consistency=float(data.get("brand_consistency", 5.0)),
            engagement_potential=float(data.get("engagement_potential", 5.0)),
            text_image_alignment=float(data.get("text_image_alignment", 5.0)),
            rationale=data.get("rationale", "Unable to parse image evaluation"),
            suggestions=data.get("suggestions", []),
        )
