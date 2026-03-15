"""A/B variant generator — creates intentional test variants of winning copy."""

from __future__ import annotations

import json
import time
from typing import Callable

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from src.models import AdBrief, AdCopy, StepCost
from src.tracking.cost_tracker import CostTracker, extract_token_usage
from src.tracking.langsmith_tracer import get_callbacks, get_run_metadata
from src.tracking.rate_limiter import RateLimiter
from config.settings import (
    OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL,
    MODEL_REFINE,
    LLM_REFINE_TEMPERATURE,
    LLM_MAX_OUTPUT_TOKENS,
)


VARIANT_SYSTEM_PROMPT = """You are an expert A/B test designer for Facebook/Instagram ads. Given a winning ad, you create a strategic variant that tests a SPECIFIC hypothesis.

You MUST respond with ONLY valid JSON in this format:
{{"primary_text": "...", "headline": "...", "description": "...", "cta_button": "...", "variant_hypothesis": "Testing [what] to see if [expected outcome]"}}"""


HOOK_VARIANT_PROMPT = """Create an A/B variant of this winning ad by changing the HOOK STYLE.

ORIGINAL AD (control):
Primary Text: {primary_text}
Headline: {headline}
Description: {description}
CTA: {cta_button}

AUDIENCE: {audience} | GOAL: {campaign_goal} | TONE: {tone}

INSTRUCTIONS:
- Keep the same core VALUE PROPOSITION and offer
- Change the opening hook to use a DIFFERENT framework:
  * If original uses a stat → try a micro-story or question
  * If original uses a question → try a bold claim or contrarian take
  * If original uses a story → try a direct callout or stat shock
- Keep the CTA button the same
- Maintain the same tone and brand voice
- The variant should feel like a genuinely different ad, not a minor tweak

The goal: test whether a different hook style improves click-through rate."""


CTA_VARIANT_PROMPT = """Create an A/B variant of this winning ad by changing the CTA APPROACH.

ORIGINAL AD (control):
Primary Text: {primary_text}
Headline: {headline}
Description: {description}
CTA: {cta_button}

AUDIENCE: {audience} | GOAL: {campaign_goal} | TONE: {tone}

INSTRUCTIONS:
- Keep the same opening hook and primary text structure
- Change the CLOSING of the primary text to use a different urgency/motivation lever:
  * If original uses scarcity → try social proof ("Join 10,000+ families...")
  * If original uses social proof → try urgency ("March SAT is 90 days away...")
  * If original uses urgency → try value emphasis ("Your first session is free...")
- Change the headline to complement the new closing approach
- Change the CTA button to match (e.g., "Get Started" → "Book Now" or "Sign Up")
- Keep the description aligned

The goal: test whether a different CTA approach improves conversion rate."""


class VariantGenerator:
    """Generates A/B test variants from winning ad copy.

    Creates 2 variants per ad:
    1. Hook variant: Same message, different opening hook framework
    2. CTA variant: Same hook, different urgency/CTA approach
    """

    def __init__(self):
        self.llm = ChatOpenAI(
            model=MODEL_REFINE,
            api_key=OPENROUTER_API_KEY,
            base_url=OPENROUTER_BASE_URL,
            temperature=LLM_REFINE_TEMPERATURE,
            max_tokens=LLM_MAX_OUTPUT_TOKENS,
        )
        self.tracker = CostTracker()
        self.rate_limiter = RateLimiter()

    def generate_variants(
        self,
        ad_copy: AdCopy,
        brief: AdBrief,
        on_variant: Callable | None = None,
    ) -> list[dict]:
        """Generate A/B test variants of the given ad copy.

        Returns list of variant dicts with keys:
        - ad_copy: AdCopy
        - variant_type: "hook_variant" or "cta_variant"
        - variant_hypothesis: What this variant is testing
        - costs: list[StepCost]
        """
        variants = []

        for variant_type, prompt_template in [
            ("hook_variant", HOOK_VARIANT_PROMPT),
            ("cta_variant", CTA_VARIANT_PROMPT),
        ]:
            try:
                variant = self._generate_single(
                    ad_copy, brief, variant_type, prompt_template,
                )
                variants.append(variant)
                if on_variant:
                    on_variant(variant)
            except Exception as e:
                print(f"  [Variant] Failed to generate {variant_type}: {e}")

        return variants

    def _generate_single(
        self,
        original: AdCopy,
        brief: AdBrief,
        variant_type: str,
        prompt_template: str,
    ) -> dict:
        """Generate a single variant."""
        user_msg = prompt_template.format(
            primary_text=original.primary_text,
            headline=original.headline,
            description=original.description,
            cta_button=original.cta_button,
            audience=brief.audience_segment.value,
            campaign_goal=brief.campaign_goal.value,
            tone=brief.tone,
        )

        callbacks = get_callbacks(
            pipeline_stage="variant_generation",
            iteration=0,
            brief_id=brief.brief_id,
            extra_tags=[variant_type],
        )

        self.rate_limiter.wait_if_needed()

        start = time.perf_counter()
        response = self.llm.invoke(
            [
                SystemMessage(content=VARIANT_SYSTEM_PROMPT),
                HumanMessage(content=user_msg),
            ],
            config={
                "callbacks": callbacks,
                "metadata": get_run_metadata(
                    pipeline_stage="variant_generation",
                    iteration=0,
                    brief_id=brief.brief_id,
                    step_name=variant_type,
                ),
                "tags": [f"brief:{brief.brief_id}", variant_type],
            },
        )
        elapsed_ms = (time.perf_counter() - start) * 1000
        input_tokens, output_tokens = extract_token_usage(response)

        cost = self.tracker.record(
            model=MODEL_REFINE,
            step_name=variant_type,
            pipeline_stage="variant_generation",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=elapsed_ms,
            iteration=0,
            brief_id=brief.brief_id,
        )

        data = self._parse_response(response.content)
        hypothesis = data.pop("variant_hypothesis", f"Testing {variant_type.replace('_', ' ')}")

        ad_copy = AdCopy(
            primary_text=data.get("primary_text", original.primary_text),
            headline=data.get("headline", original.headline),
            description=data.get("description", original.description),
            cta_button=data.get("cta_button", original.cta_button),
        )

        return {
            "ad_copy": ad_copy,
            "variant_type": variant_type,
            "variant_hypothesis": hypothesis,
            "costs": [cost],
        }

    @staticmethod
    def _parse_response(content: str) -> dict:
        """Parse LLM response into dict."""
        text = content.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(lines)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Try extracting JSON object
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
