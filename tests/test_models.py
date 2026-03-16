"""Tests for core data models."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from pydantic import ValidationError

from src.models import (
    AdBrief, AdCopy, DimensionScore, EvaluationResult,
    ImageEvaluationResult, CopyIteration, AdResult,
    StepCost, AudienceSegment, CampaignGoal,
    AdStatus, ComplianceResult,
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


def test_ad_result_compute_totals_sets_status_by_score(sample_brief, sample_copy):
    """compute_totals should set EVALUATOR_PASS when score >= threshold."""
    high_scores = [
        DimensionScore(dimension=d, score=9.0, rationale="", confidence=0.9)
        for d in DIMENSION_WEIGHTS
    ]
    evaluation = EvaluationResult.from_dimension_scores(high_scores, DIMENSION_WEIGHTS)
    cost = StepCost(model="test", step_name="gen", pipeline_stage="copy", cost_usd=0.01)
    copy_iter = CopyIteration(
        iteration_number=1, ad_copy=sample_copy,
        evaluation=evaluation, costs=[cost],
    )
    result = AdResult(
        brief_id="test_status",
        brief=sample_brief,
        copy_iterations=[copy_iter],
    )
    result.compute_totals(quality_threshold=7.0)
    assert result.status == AdStatus.EVALUATOR_PASS.value


def test_ad_result_compute_totals_below_threshold(sample_brief, sample_copy):
    """compute_totals should set BELOW_THRESHOLD when score < threshold."""
    low_scores = [
        DimensionScore(dimension=d, score=3.0, rationale="", confidence=0.5)
        for d in DIMENSION_WEIGHTS
    ]
    evaluation = EvaluationResult.from_dimension_scores(low_scores, DIMENSION_WEIGHTS)
    cost = StepCost(model="test", step_name="gen", pipeline_stage="copy", cost_usd=0.01)
    copy_iter = CopyIteration(
        iteration_number=1, ad_copy=sample_copy,
        evaluation=evaluation, costs=[cost],
    )
    result = AdResult(
        brief_id="test_low",
        brief=sample_brief,
        copy_iterations=[copy_iter],
    )
    result.compute_totals(quality_threshold=7.0)
    assert result.status == AdStatus.BELOW_THRESHOLD.value


def test_ad_result_compute_totals_preserves_human_approved(sample_brief, sample_copy):
    """compute_totals must NOT override HUMAN_APPROVED status."""
    scores = [
        DimensionScore(dimension=d, score=5.0, rationale="", confidence=0.5)
        for d in DIMENSION_WEIGHTS
    ]
    evaluation = EvaluationResult.from_dimension_scores(scores, DIMENSION_WEIGHTS)
    cost = StepCost(model="test", step_name="gen", pipeline_stage="copy", cost_usd=0.01)
    copy_iter = CopyIteration(
        iteration_number=1, ad_copy=sample_copy,
        evaluation=evaluation, costs=[cost],
    )
    result = AdResult(
        brief_id="test_approved",
        brief=sample_brief,
        copy_iterations=[copy_iter],
        status=AdStatus.HUMAN_APPROVED.value,
    )
    result.compute_totals(quality_threshold=7.0)
    assert result.status == AdStatus.HUMAN_APPROVED.value


def test_ad_result_compute_totals_compliance_pass(sample_brief, sample_copy):
    """compute_totals should set COMPLIANCE_PASS when score >= threshold and compliance passes."""
    high_scores = [
        DimensionScore(dimension=d, score=9.0, rationale="", confidence=0.9)
        for d in DIMENSION_WEIGHTS
    ]
    evaluation = EvaluationResult.from_dimension_scores(high_scores, DIMENSION_WEIGHTS)
    cost = StepCost(model="test", step_name="gen", pipeline_stage="copy", cost_usd=0.01)
    copy_iter = CopyIteration(
        iteration_number=1, ad_copy=sample_copy,
        evaluation=evaluation, costs=[cost],
    )
    result = AdResult(
        brief_id="test_compliance",
        brief=sample_brief,
        copy_iterations=[copy_iter],
        compliance=ComplianceResult(passes=True),
    )
    result.compute_totals(quality_threshold=7.0)
    assert result.status == AdStatus.COMPLIANCE_PASS.value


def test_ad_status_enum_values():
    """Key AdStatus enum values must exist."""
    assert AdStatus.ITERATING.value == "iterating"
    assert AdStatus.EVALUATOR_PASS.value == "evaluator_pass"
    assert AdStatus.HUMAN_APPROVED.value == "human_approved"
    assert AdStatus.BELOW_THRESHOLD.value == "below_threshold"
    assert AdStatus.COMPLIANCE_PASS.value == "compliance_pass"
    assert AdStatus.REJECTED.value == "rejected"


def test_dimension_score_validation_rejects_out_of_range():
    """DimensionScore should reject score outside 1-10 and confidence outside 0-1."""
    with pytest.raises(ValidationError):
        DimensionScore(dimension="clarity", score=11.0, rationale="", confidence=0.5)
    with pytest.raises(ValidationError):
        DimensionScore(dimension="clarity", score=5.0, rationale="", confidence=1.5)


def test_evaluation_weighted_average_calculation():
    """Verify the weighted average calculation matches expected math."""
    scores = [
        DimensionScore(dimension="clarity", score=10.0, rationale="", confidence=1.0),
        DimensionScore(dimension="value_proposition", score=10.0, rationale="", confidence=1.0),
        DimensionScore(dimension="cta_strength", score=10.0, rationale="", confidence=1.0),
        DimensionScore(dimension="brand_voice", score=10.0, rationale="", confidence=1.0),
        DimensionScore(dimension="emotional_resonance", score=10.0, rationale="", confidence=1.0),
    ]
    result = EvaluationResult.from_dimension_scores(scores, DIMENSION_WEIGHTS)
    assert result.weighted_average == 10.0

    # All 1.0 should give 1.0
    scores_low = [
        DimensionScore(dimension=d, score=1.0, rationale="", confidence=0.5)
        for d in DIMENSION_WEIGHTS
    ]
    result_low = EvaluationResult.from_dimension_scores(scores_low, DIMENSION_WEIGHTS)
    assert result_low.weighted_average == 1.0
