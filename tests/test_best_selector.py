"""Tests for best iteration selection."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models import (
    AdCopy, CopyIteration, ImageIteration,
    DimensionScore, EvaluationResult, ImageEvaluationResult, StepCost,
)
from src.iterate.best_selector import BestSelector
from config.evaluation_rubrics import DIMENSION_WEIGHTS


def _make_copy_iteration(iteration_num: int, score: float) -> CopyIteration:
    """Helper to create a CopyIteration with a given score."""
    scores = [
        DimensionScore(dimension=d, score=score, rationale="test", confidence=0.8, suggestions=[])
        for d in DIMENSION_WEIGHTS
    ]
    evaluation = EvaluationResult.from_dimension_scores(scores, DIMENSION_WEIGHTS)

    return CopyIteration(
        iteration_number=iteration_num,
        ad_copy=AdCopy(
            primary_text=f"Test copy iteration {iteration_num}",
            headline="Test Headline",
            description="Test desc",
            cta_button="Learn More",
        ),
        evaluation=evaluation,
        costs=[],
    )


def _make_image_iteration(iteration_num: int, score: float) -> ImageIteration:
    return ImageIteration(
        iteration_number=iteration_num,
        image_path=f"/tmp/test_v{iteration_num}.png",
        image_prompt="test prompt",
        evaluation=ImageEvaluationResult.compute(
            brand_consistency=score,
            engagement_potential=score,
            text_image_alignment=score,
            rationale="test",
        ),
        costs=[],
    )


def test_select_best_copy_picks_highest():
    iterations = [
        _make_copy_iteration(1, 6.0),
        _make_copy_iteration(2, 8.5),  # Best
        _make_copy_iteration(3, 7.0),  # Overcorrected
    ]
    best_idx = BestSelector.select_best_copy(iterations)
    assert best_idx == 1  # Iteration 2, not the last one


def test_select_best_copy_single():
    iterations = [_make_copy_iteration(1, 7.0)]
    assert BestSelector.select_best_copy(iterations) == 0


def test_select_best_copy_empty():
    assert BestSelector.select_best_copy([]) == 0


def test_select_best_image_picks_highest():
    iterations = [
        _make_image_iteration(1, 5.0),
        _make_image_iteration(2, 9.0),  # Best
        _make_image_iteration(3, 7.0),
    ]
    best_idx = BestSelector.select_best_image(iterations)
    assert best_idx == 1


def test_select_best_image_all_same():
    iterations = [
        _make_image_iteration(1, 7.0),
        _make_image_iteration(2, 7.0),
        _make_image_iteration(3, 7.0),
    ]
    # Should pick first (or any) — just shouldn't crash
    best_idx = BestSelector.select_best_image(iterations)
    assert 0 <= best_idx <= 2


def test_iteration_history_preserved():
    """Verify all 3 iterations are kept regardless of best selection."""
    iterations = [
        _make_copy_iteration(1, 6.0),
        _make_copy_iteration(2, 8.0),
        _make_copy_iteration(3, 7.5),
    ]
    best_idx = BestSelector.select_best_copy(iterations)

    # All iterations still exist
    assert len(iterations) == 3
    assert iterations[0].iteration_number == 1
    assert iterations[1].iteration_number == 2
    assert iterations[2].iteration_number == 3
    assert best_idx == 1  # Best is iteration 2
