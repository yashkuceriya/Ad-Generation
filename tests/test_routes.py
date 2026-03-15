"""Tests for API routes: ads serialization, progress, cost endpoints."""

import json
import os
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models import (
    AdBrief, AdCopy, AdResult, AudienceSegment, CampaignGoal,
    CopyIteration, EvaluationResult, DimensionScore, StepCost,
    ImageIteration, ImageEvaluationResult,
)
from server.state import RunStore
from server.routes.ads import (
    _serialize_result,
    _resolve_user_images,
    _add_image_urls,
    _save_cache_manifest,
)
from config.evaluation_rubrics import DIMENSION_WEIGHTS
from config.settings import IMAGES_DIR

DIMS = ["clarity", "value_proposition", "cta_strength", "brand_voice", "emotional_resonance"]


def _make_result(brief_id: str, score: float = 7.5) -> AdResult:
    scores = [
        DimensionScore(dimension=d, score=score, rationale="test", confidence=0.8)
        for d in DIMS
    ]
    evaluation = EvaluationResult.from_dimension_scores(scores, DIMENSION_WEIGHTS)
    copy_iter = CopyIteration(
        iteration_number=1,
        ad_copy=AdCopy(primary_text="t", headline="h", description="d", cta_button="c"),
        evaluation=evaluation,
        costs=[StepCost(model="test", step_name="gen", pipeline_stage="copy")],
    )
    return AdResult(
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


class TestSerializeResult:
    def test_basic_serialization(self):
        result = _make_result("test_001")
        data = _serialize_result(result)
        assert data["brief_id"] == "test_001"
        assert "copy_iterations" in data
        assert len(data["image_iterations"]) == 0

    def test_no_client_id_returns_empty_images(self):
        result = _make_result("test_002")
        data = _serialize_result(result, client_id=None)
        assert data["image_iterations"] == []

    def test_client_id_resolves_user_cache(self):
        """When client_id is passed, images should be resolved from user cache."""
        with tempfile.TemporaryDirectory() as tmpdir:
            from unittest.mock import patch
            with patch("server.routes.ads.IMAGES_DIR", tmpdir):
                client = "test_client"
                brief = "brief_001"
                cache_dir = os.path.join(tmpdir, "users", client, brief)
                os.makedirs(cache_dir, exist_ok=True)

                img_path = os.path.join(cache_dir, "img.png")
                with open(img_path, "w") as f:
                    f.write("fake")

                manifest = {
                    "cache_key_1": {
                        "image_files": [img_path],
                        "iterations": [{
                            "iteration_number": 1,
                            "image_path": img_path,
                            "image_prompt": "test prompt",
                            "evaluation": {
                                "brand_consistency": 7.0,
                                "engagement_potential": 7.5,
                                "text_image_alignment": 8.0,
                                "average_score": 7.5,
                                "rationale": "ok",
                                "suggestions": [],
                            },
                            "costs": [],
                        }],
                        "best_image_index": 0,
                        "generated_at": "2025-01-01T00:00:00Z",
                    }
                }
                _save_cache_manifest(cache_dir, manifest)

                result = _make_result(brief)
                data = _serialize_result(result, client_id=client)
                assert len(data["image_iterations"]) == 1
                assert data["best_image_index"] == 0


class TestResolveUserImages:
    def test_no_cache_returns_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            from unittest.mock import patch
            with patch("server.routes.ads.IMAGES_DIR", tmpdir):
                iters, idx = _resolve_user_images("nonexistent", "no_client")
                assert iters == []
                assert idx == 0


class TestAddImageUrls:
    def test_adds_url_for_images_in_images_dir(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            from unittest.mock import patch
            with patch("server.routes.ads.IMAGES_DIR", tmpdir):
                img_path = os.path.join(tmpdir, "test.png")
                with open(img_path, "w") as f:
                    f.write("fake")

                data = {
                    "image_iterations": [{"image_path": img_path}]
                }
                _add_image_urls(data, "brief_001")
                assert data["image_iterations"][0]["image_url"] == "/api/ads/brief_001/image/test.png"


class TestWeakestDimension:
    def test_weakest_is_lowest_raw_score(self):
        """Weakest dimension should be the one with the lowest raw score."""
        scores = [
            DimensionScore(dimension="clarity", score=8.0, rationale="", confidence=0.8),
            DimensionScore(dimension="value_proposition", score=6.0, rationale="", confidence=0.8),
            DimensionScore(dimension="cta_strength", score=7.5, rationale="", confidence=0.8),
            DimensionScore(dimension="brand_voice", score=4.0, rationale="", confidence=0.8),
            DimensionScore(dimension="emotional_resonance", score=7.0, rationale="", confidence=0.8),
        ]
        result = EvaluationResult.from_dimension_scores(scores, DIMENSION_WEIGHTS)
        assert result.weakest_dimension == "brand_voice"

    def test_weakest_not_confused_by_weight(self):
        """Even with high weight, the lowest raw score should be weakest."""
        scores = [
            DimensionScore(dimension="clarity", score=9.0, rationale="", confidence=0.8),
            DimensionScore(dimension="value_proposition", score=5.5, rationale="", confidence=0.8),
            DimensionScore(dimension="cta_strength", score=9.0, rationale="", confidence=0.8),
            DimensionScore(dimension="brand_voice", score=9.0, rationale="", confidence=0.8),
            DimensionScore(dimension="emotional_resonance", score=9.0, rationale="", confidence=0.8),
        ]
        result = EvaluationResult.from_dimension_scores(scores, DIMENSION_WEIGHTS)
        assert result.weakest_dimension == "value_proposition"


class TestParseTelemetry:
    def test_telemetry_counters_exist(self):
        from src.evaluate.dimension_scorer import DimensionScorer
        telemetry = DimensionScorer.parse_telemetry()
        assert "json_ok" in telemetry
        assert "json_extract_fallback" in telemetry
        assert "regex_fallback" in telemetry
        assert "default_fallback" in telemetry


class TestRunStoreStatus:
    @pytest.fixture(autouse=True)
    def reset(self):
        RunStore.reset()
        RunStore._instance = None
        yield
        RunStore._instance = None

    def test_status_completed_run_ads(self):
        store = RunStore()
        store.start_run(total_briefs=3)
        store.add_result(_make_result("r1"))
        store.add_result(_make_result("r2"))
        status = store.get_status()
        assert status["completed_run_ads"] == 2
        assert status["total_briefs"] == 3
