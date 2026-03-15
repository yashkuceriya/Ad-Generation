"""Shared fixtures for tests."""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models import (
    AdBrief, AdCopy, DimensionScore, EvaluationResult,
    ImageEvaluationResult, CopyIteration, ImageIteration,
    StepCost, AudienceSegment, CampaignGoal,
)
from config.evaluation_rubrics import DIMENSION_WEIGHTS


@pytest.fixture
def sample_brief():
    return AdBrief(
        brief_id="test_001",
        audience_segment=AudienceSegment.PARENTS,
        product_offer="1-on-1 SAT tutoring sessions",
        campaign_goal=CampaignGoal.CONVERSION,
        tone="urgent",
        competitor_context=["Princeton Review leads with score guarantees"],
    )


@pytest.fixture
def sample_copy():
    return AdCopy(
        primary_text="Is your child's SAT score holding them back? Our expert tutors have helped 10,000+ students improve by 200+ points.",
        headline="Boost Your SAT Score",
        description="Personalized 1-on-1 tutoring from expert tutors",
        cta_button="Start Your Free Trial",
    )


@pytest.fixture
def sample_scores():
    return [
        DimensionScore(dimension="clarity", score=8.0, rationale="Clear message", confidence=0.9, suggestions=[]),
        DimensionScore(dimension="value_proposition", score=7.5, rationale="Good value prop", confidence=0.85, suggestions=["Add specifics"]),
        DimensionScore(dimension="cta_strength", score=6.0, rationale="CTA could be stronger", confidence=0.8, suggestions=["Add urgency"]),
        DimensionScore(dimension="brand_voice", score=7.0, rationale="On brand", confidence=0.75, suggestions=[]),
        DimensionScore(dimension="emotional_resonance", score=8.5, rationale="Strong emotional pull", confidence=0.9, suggestions=[]),
    ]


@pytest.fixture
def sample_evaluation(sample_scores):
    return EvaluationResult.from_dimension_scores(
        dimension_scores=sample_scores,
        weights=DIMENSION_WEIGHTS,
    )


@pytest.fixture
def sample_cost():
    return StepCost(
        model="gemini-2.0-flash",
        step_name="generate_copy",
        pipeline_stage="copy_generation",
        iteration=1,
        brief_id="test_001",
        input_tokens=500,
        output_tokens=200,
        latency_ms=1500.0,
        cost_usd=0.00013,
    )


@pytest.fixture
def sample_copy_iteration(sample_copy, sample_evaluation, sample_cost):
    return CopyIteration(
        iteration_number=1,
        ad_copy=sample_copy,
        evaluation=sample_evaluation,
        costs=[sample_cost],
    )


@pytest.fixture
def sample_image_evaluation():
    return ImageEvaluationResult.compute(
        brand_consistency=7.5,
        engagement_potential=8.0,
        text_image_alignment=7.0,
        rationale="Good image overall",
        suggestions=["Improve color contrast"],
    )
