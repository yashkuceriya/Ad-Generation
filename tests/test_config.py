"""Tests for configuration and settings."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config.evaluation_rubrics import DIMENSION_WEIGHTS, QUALITY_THRESHOLD, DIMENSION_RUBRICS
from config.settings import IMAGE_COST_PER_IMAGE, COST_PER_TOKEN


EXPECTED_DIMENSIONS = [
    "clarity",
    "value_proposition",
    "cta_strength",
    "brand_voice",
    "emotional_resonance",
]


def test_dimension_weights_sum_to_one():
    """Dimension weights must sum to 1.0 for proper weighted averaging."""
    total = sum(DIMENSION_WEIGHTS.values())
    assert abs(total - 1.0) < 1e-9, f"Weights sum to {total}, expected 1.0"


def test_all_five_dimensions_defined():
    """All 5 quality dimensions must be present in weights."""
    for dim in EXPECTED_DIMENSIONS:
        assert dim in DIMENSION_WEIGHTS, f"Missing dimension: {dim}"
    assert len(DIMENSION_WEIGHTS) == 5


def test_quality_threshold_set():
    """Quality threshold should be a positive float."""
    assert QUALITY_THRESHOLD > 0
    assert isinstance(QUALITY_THRESHOLD, float)
    assert QUALITY_THRESHOLD == 7.0


def test_image_cost_per_image():
    """IMAGE_COST_PER_IMAGE should be 0.07 per OpenRouter pricing."""
    assert IMAGE_COST_PER_IMAGE == 0.07


def test_dimension_rubrics_match_weights():
    """Every dimension in DIMENSION_WEIGHTS must have a rubric definition."""
    for dim in DIMENSION_WEIGHTS:
        assert dim in DIMENSION_RUBRICS, f"Missing rubric for dimension: {dim}"
        rubric = DIMENSION_RUBRICS[dim]
        assert "name" in rubric
        assert "prompt" in rubric
        assert "question" in rubric


def test_cost_per_token_has_known_models():
    """COST_PER_TOKEN should include the primary models used in the pipeline."""
    assert "google/gemini-3-flash-preview" in COST_PER_TOKEN
    assert "google/gemini-3.1-flash-lite-preview" in COST_PER_TOKEN
    for model, rates in COST_PER_TOKEN.items():
        assert "input" in rates, f"Missing input rate for {model}"
        assert "output" in rates, f"Missing output rate for {model}"
