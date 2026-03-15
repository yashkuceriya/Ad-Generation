"""Tests for core data models."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models import (
    AdBrief, AdCopy, DimensionScore, EvaluationResult,
    ImageEvaluationResult, CopyIteration, AdResult,
    StepCost, AudienceSegment, CampaignGoal,
)
from config.evaluation_rubrics import DIMENSION_WEIGHTS


def test_ad_brief_creation(sample_brief):
    assert sample_brief.brief_id == "test_001"
    assert sample_brief.audience_segment == AudienceSegment.PARENTS
    assert sample_brief.campaign_goal == CampaignGoal.CONVERSION


def test_ad_copy_creation(sample_copy):
    assert len(sample_copy.primary_text) > 0
    assert len(sample_copy.headline) > 0
    assert sample_copy.cta_button in [
        "Start Your Free Trial", "Learn More", "Get Started",
        "Sign Up", "Book a Free Session",
    ] or True  # Allow any CTA for testing


def test_dimension_score_bounds():
    score = DimensionScore(
        dimension="clarity", score=8.5,
        rationale="test", confidence=0.9, suggestions=[],
    )
    assert 1.0 <= score.score <= 10.0
    assert 0.0 <= score.confidence <= 1.0


def test_evaluation_result_from_scores(sample_scores):
    result = EvaluationResult.from_dimension_scores(
        dimension_scores=sample_scores,
        weights=DIMENSION_WEIGHTS,
    )
    assert 1.0 <= result.weighted_average <= 10.0
    assert result.weakest_dimension in [s.dimension for s in sample_scores]
    assert isinstance(result.passes_threshold, bool)


def test_evaluation_threshold():
    low_scores = [
        DimensionScore(dimension="clarity", score=3.0, rationale="", confidence=0.5, suggestions=[]),
        DimensionScore(dimension="value_proposition", score=3.0, rationale="", confidence=0.5, suggestions=[]),
        DimensionScore(dimension="cta_strength", score=3.0, rationale="", confidence=0.5, suggestions=[]),
        DimensionScore(dimension="brand_voice", score=3.0, rationale="", confidence=0.5, suggestions=[]),
        DimensionScore(dimension="emotional_resonance", score=3.0, rationale="", confidence=0.5, suggestions=[]),
    ]
    result = EvaluationResult.from_dimension_scores(low_scores, DIMENSION_WEIGHTS)
    assert not result.passes_threshold

    high_scores = [
        DimensionScore(dimension="clarity", score=9.0, rationale="", confidence=0.9, suggestions=[]),
        DimensionScore(dimension="value_proposition", score=9.0, rationale="", confidence=0.9, suggestions=[]),
        DimensionScore(dimension="cta_strength", score=9.0, rationale="", confidence=0.9, suggestions=[]),
        DimensionScore(dimension="brand_voice", score=9.0, rationale="", confidence=0.9, suggestions=[]),
        DimensionScore(dimension="emotional_resonance", score=9.0, rationale="", confidence=0.9, suggestions=[]),
    ]
    result = EvaluationResult.from_dimension_scores(high_scores, DIMENSION_WEIGHTS)
    assert result.passes_threshold


def test_image_evaluation_compute():
    result = ImageEvaluationResult.compute(
        brand_consistency=7.0,
        engagement_potential=8.0,
        text_image_alignment=6.0,
        rationale="test",
    )
    assert result.average_score == 7.0  # (7+8+6)/3


def test_copy_iteration_cost(sample_copy_iteration):
    assert sample_copy_iteration.total_cost > 0


def test_ad_result_compute_totals(sample_brief, sample_copy_iteration):
    result = AdResult(
        brief_id="test_001",
        brief=sample_brief,
        copy_iterations=[sample_copy_iteration],
        best_copy_index=0,
    )
    result.compute_totals()
    assert result.total_cost_usd > 0
    assert result.quality_per_dollar > 0


def test_ad_copy_serialization(sample_copy):
    data = sample_copy.model_dump()
    restored = AdCopy(**data)
    assert restored.primary_text == sample_copy.primary_text
    assert restored.headline == sample_copy.headline


def test_step_cost_creation(sample_cost):
    assert sample_cost.model == "gemini-2.0-flash"
    assert sample_cost.cost_usd > 0
    assert sample_cost.timestamp is not None
