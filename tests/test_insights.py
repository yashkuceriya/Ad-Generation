"""Tests for insight extraction."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models import (
    AdBrief, AdCopy, AdResult, AudienceSegment, CampaignGoal,
    CopyIteration, DimensionScore, EvaluationResult, StepCost,
)
from config.evaluation_rubrics import DIMENSION_WEIGHTS
from src.intelligence.insight_extractor import extract_insights


def _make_result(
    brief_id: str,
    audience: AudienceSegment,
    goal: CampaignGoal,
    scores_map: dict[str, float],
    headline: str = "Test Headline",
    refinement_feedback: str | None = None,
    extra_iteration_scores: dict[str, float] | None = None,
) -> AdResult:
    """Helper to build an AdResult with given dimension scores."""
    dim_scores = [
        DimensionScore(dimension=d, score=s, rationale="test", confidence=0.8)
        for d, s in scores_map.items()
    ]
    evaluation = EvaluationResult.from_dimension_scores(dim_scores, DIMENSION_WEIGHTS)
    copy_iter = CopyIteration(
        iteration_number=1,
        ad_copy=AdCopy(
            primary_text="Test primary text for the ad.",
            headline=headline,
            description="Test description",
            cta_button="Get Started",
        ),
        evaluation=evaluation,
        costs=[StepCost(model="test", step_name="gen", pipeline_stage="copy", cost_usd=0.001)],
    )
    iterations = [copy_iter]

    if extra_iteration_scores is not None:
        dim_scores_2 = [
            DimensionScore(dimension=d, score=s, rationale="refined", confidence=0.85)
            for d, s in extra_iteration_scores.items()
        ]
        eval_2 = EvaluationResult.from_dimension_scores(dim_scores_2, DIMENSION_WEIGHTS)
        iter_2 = CopyIteration(
            iteration_number=2,
            ad_copy=AdCopy(
                primary_text="Refined primary text.",
                headline=headline,
                description="Refined description",
                cta_button="Learn More",
            ),
            evaluation=eval_2,
            refinement_feedback=refinement_feedback,
            costs=[StepCost(model="test", step_name="refine", pipeline_stage="copy", cost_usd=0.001)],
        )
        iterations.append(iter_2)

    return AdResult(
        brief_id=brief_id,
        brief=AdBrief(
            brief_id=brief_id,
            audience_segment=audience,
            product_offer="SAT tutoring",
            campaign_goal=goal,
            tone="urgent",
        ),
        copy_iterations=iterations,
    )


def test_extract_insights_empty_list():
    """extract_insights returns empty list for no results."""
    assert extract_insights([]) == []


def test_extract_insights_winning_pattern():
    """extract_insights identifies a winning_pattern insight."""
    scores = {
        "clarity": 8.0, "value_proposition": 8.0,
        "cta_strength": 8.0, "brand_voice": 8.0,
        "emotional_resonance": 8.0,
    }
    result = _make_result(
        "b1", AudienceSegment.PARENTS, CampaignGoal.CONVERSION,
        scores, headline="Ace Your SAT Today",
    )
    insights = extract_insights([result])
    winning = [i for i in insights if i["insight_type"] == "winning_pattern"]
    assert len(winning) >= 1
    assert winning[0]["audience_segment"] == "parents"
    assert winning[0]["campaign_goal"] == "conversion"


def test_extract_insights_weak_dimension():
    """extract_insights identifies dimensions averaging below 7.0."""
    scores = {
        "clarity": 8.0, "value_proposition": 8.0,
        "cta_strength": 5.0, "brand_voice": 8.0,
        "emotional_resonance": 8.0,
    }
    result = _make_result(
        "b1", AudienceSegment.STUDENTS, CampaignGoal.AWARENESS, scores,
    )
    insights = extract_insights([result])
    weak = [i for i in insights if i["insight_type"] == "weak_dimension"]
    assert len(weak) >= 1
    dim_names = [w["dimension"] for w in weak]
    assert "cta_strength" in dim_names


def test_extract_insights_top_performer():
    """extract_insights includes top_performer insight per audience."""
    scores = {
        "clarity": 9.0, "value_proposition": 9.0,
        "cta_strength": 9.0, "brand_voice": 9.0,
        "emotional_resonance": 9.0,
    }
    result = _make_result(
        "b1", AudienceSegment.FAMILIES, CampaignGoal.AWARENESS,
        scores, headline="Family SAT Success",
    )
    insights = extract_insights([result])
    top = [i for i in insights if i["insight_type"] == "top_performer"]
    assert len(top) >= 1
    assert top[0]["audience_segment"] == "families"


def test_extract_insights_refinement_tip():
    """extract_insights records refinement tips when scores improve."""
    first_scores = {
        "clarity": 6.0, "value_proposition": 6.0,
        "cta_strength": 6.0, "brand_voice": 6.0,
        "emotional_resonance": 6.0,
    }
    better_scores = {
        "clarity": 8.0, "value_proposition": 8.0,
        "cta_strength": 8.0, "brand_voice": 8.0,
        "emotional_resonance": 8.0,
    }
    result = _make_result(
        "b1", AudienceSegment.PARENTS, CampaignGoal.CONVERSION,
        first_scores,
        refinement_feedback="Add more urgency and social proof",
        extra_iteration_scores=better_scores,
    )
    insights = extract_insights([result])
    tips = [i for i in insights if i["insight_type"] == "refinement_tip"]
    assert len(tips) >= 1
    assert tips[0]["evidence"]["delta"] > 0
