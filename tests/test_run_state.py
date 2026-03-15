"""Tests for run state isolation and pipeline lifecycle."""

import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models import (
    AdBrief, AdCopy, AdResult, AudienceSegment, CampaignGoal,
    CopyIteration, EvaluationResult, DimensionScore, StepCost,
)
from server.state import RunStore
from config.evaluation_rubrics import DIMENSION_WEIGHTS

DIMS = ["clarity", "value_proposition", "cta_strength", "brand_voice", "emotional_resonance"]


def _make_result(brief_id: str, score: float = 7.5) -> AdResult:
    """Create a minimal AdResult for testing."""
    scores = [
        DimensionScore(dimension=d, score=score, rationale="test", confidence=0.8, suggestions=[])
        for d in DIMS
    ]
    evaluation = EvaluationResult.from_dimension_scores(scores, DIMENSION_WEIGHTS)
    copy_iter = CopyIteration(
        iteration_number=1,
        ad_copy=AdCopy(primary_text="t", headline="h", description="d", cta_button="c"),
        evaluation=evaluation,
        costs=[StepCost(model="test", step_name="gen", pipeline_stage="copy")],
    )
    result = AdResult(
        brief_id=brief_id,
        brief=AdBrief(
            brief_id=brief_id,
            audience_segment=AudienceSegment.PARENTS,
            product_offer="SAT tutoring",
            campaign_goal=CampaignGoal.CONVERSION,
            tone="urgent",
        ),
        copy_iterations=[copy_iter],
    )
    result.compute_totals()
    return result


@pytest.fixture(autouse=True)
def reset_store():
    RunStore.reset()
    # Reinitialize singleton
    RunStore._instance = None
    yield
    RunStore._instance = None


def test_run_results_isolated_from_historical():
    """New run metrics should not include historical results."""
    store = RunStore()

    # Simulate historical results loaded on startup
    store.add_result(_make_result("historical_001", 6.0))
    store.add_result(_make_result("historical_002", 5.0))

    assert len(store.get_all_results()) == 2

    # Start a new run
    store.start_run(total_briefs=1)

    # Run results should be empty
    assert len(store.get_run_results()) == 0
    # All results still includes historical
    assert len(store.get_all_results()) == 2

    # Add a new run result
    store.add_result(_make_result("run_001", 8.5))

    # Run results = just the new one
    assert len(store.get_run_results()) == 1
    assert store.get_run_results()[0].brief_id == "run_001"

    # All results = historical + new
    assert len(store.get_all_results()) == 3


def test_start_run_resets_state():
    """start_run() should reset all run tracking state."""
    store = RunStore()
    store.run_status = "completed"
    store.current_brief_index = 5
    store.error = "previous error"

    store.start_run(total_briefs=3)

    assert store.run_status == "running"
    assert store.total_briefs == 3
    assert store.current_brief_index == 0
    assert store.error is None
    assert store.should_stop is False
    assert store.started_at is not None


def test_stop_requested():
    """request_stop() should signal the pipeline to stop."""
    store = RunStore()
    store.start_run(total_briefs=5)

    assert store.should_stop is False
    store.request_stop()
    assert store.should_stop is True


def test_get_status_includes_run_ads():
    """get_status() should include completed run ad count."""
    store = RunStore()
    store.start_run(total_briefs=2)
    store.add_result(_make_result("r1"))

    status = store.get_status()
    assert status["status"] == "running"
    assert status["total_briefs"] == 2
    assert status["completed_run_ads"] == 1
    assert status["completed_ads"] == 1


def test_historical_results_not_in_new_run_metrics():
    """Simulates the full scenario: load history, start run, check metrics."""
    store = RunStore()

    # Load 3 historical low-scoring ads
    for i in range(3):
        store.add_result(_make_result(f"old_{i}", 5.0))

    # Start a new run
    store.start_run(total_briefs=2)

    # Add 2 high-scoring new ads
    store.add_result(_make_result("new_0", 9.0))
    store.add_result(_make_result("new_1", 8.5))

    # Run metrics should only reflect the 2 new ads
    run_results = store.get_run_results()
    run_scores = [r.best_copy.evaluation.weighted_average for r in run_results]

    assert len(run_scores) == 2
    avg = sum(run_scores) / len(run_scores)
    assert avg >= 8.0, f"Run avg {avg} should be ~8.75, not contaminated by historical 5.0s"

    # Gallery shows all 5
    assert len(store.get_all_results()) == 5
