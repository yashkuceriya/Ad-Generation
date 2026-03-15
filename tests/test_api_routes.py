"""FastAPI TestClient tests for refine and generate-image endpoints."""

import os
import sys
import json
import tempfile
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient

from src.models import (
    AdBrief, AdCopy, AdResult, AudienceSegment, CampaignGoal,
    CopyIteration, EvaluationResult, DimensionScore, StepCost,
)
from config.evaluation_rubrics import DIMENSION_WEIGHTS

DIMS = ["clarity", "value_proposition", "cta_strength", "brand_voice", "emotional_resonance"]


def _make_result(brief_id: str = "test_brief", score: float = 7.5) -> AdResult:
    scores = [
        DimensionScore(dimension=d, score=score, rationale="test", confidence=0.8)
        for d in DIMS
    ]
    evaluation = EvaluationResult.from_dimension_scores(scores, DIMENSION_WEIGHTS)
    copy_iter = CopyIteration(
        iteration_number=1,
        ad_copy=AdCopy(
            primary_text="Boost your SAT score today.",
            headline="SAT Prep That Works",
            description="Expert tutoring for top scores.",
            cta_button="Get Started",
        ),
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


@pytest.fixture(autouse=True)
def _reset_store():
    from server.state import RunStore
    RunStore._instance = None
    yield
    RunStore._instance = None


@pytest.fixture
def client():
    from server.app import app
    return TestClient(app)


@pytest.fixture
def seeded_store():
    from server.state import RunStore
    store = RunStore()
    result = _make_result("test_brief")
    store.add_result(result)
    return store


class TestRefineEndpoint:
    def test_refine_returns_404_for_unknown_brief(self, client: TestClient):
        resp = client.post("/api/ads/nonexistent/refine", json={
            "instruction": "make it better",
            "client_id": "test_client",
        })
        assert resp.status_code == 404

    def test_refine_returns_refining_status(self, client: TestClient, seeded_store):
        with patch("server.routes.ads.threading.Thread") as mock_thread:
            mock_thread.return_value = MagicMock()
            resp = client.post("/api/ads/test_brief/refine", json={
                "instruction": "use more urgency",
                "client_id": "test_client",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "refining"
        assert data["brief_id"] == "test_brief"

    def test_refine_requires_instruction(self, client: TestClient, seeded_store):
        resp = client.post("/api/ads/test_brief/refine", json={
            "client_id": "test_client",
        })
        assert resp.status_code == 422


class TestGenerateImageEndpoint:
    def test_generate_image_404_for_unknown_brief(self, client: TestClient):
        resp = client.post("/api/ads/nonexistent/generate-image", json={
            "client_id": "test_client",
        })
        assert resp.status_code == 404

    def test_generate_image_cache_hit(self, client: TestClient, seeded_store):
        """When cached images exist for a brief+client, return immediately."""
        with tempfile.TemporaryDirectory() as tmpdir:
            with patch("server.routes.ads.IMAGES_DIR", tmpdir):
                client_id = "test_client"
                brief_id = "test_brief"

                cache_dir = os.path.join(tmpdir, "users", client_id, brief_id)
                os.makedirs(cache_dir, exist_ok=True)

                img_path = os.path.join(cache_dir, "test_img.png")
                with open(img_path, "wb") as f:
                    f.write(b"\x89PNG fake image data")

                from server.routes.ads import _prompt_hash

                result = seeded_store.get_result(brief_id)
                best_copy = result.best_copy.ad_copy
                cache_key = _prompt_hash(
                    f"{best_copy.headline}|{best_copy.primary_text[:100]}|"
                    f"{result.brief.audience_segment.value}|{result.brief.campaign_goal.value}"
                )

                manifest = {
                    cache_key: {
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
                manifest_path = os.path.join(cache_dir, "cache_manifest.json")
                with open(manifest_path, "w") as f:
                    json.dump(manifest, f)

                resp = client.post("/api/ads/test_brief/generate-image", json={
                    "client_id": client_id,
                    "force_regenerate": False,
                })
                assert resp.status_code == 200
                data = resp.json()
                assert data["status"] == "generating"
                assert data["brief_id"] == brief_id


class TestListAds:
    def test_list_ads_empty(self, client: TestClient):
        resp = client.get("/api/ads")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_ads_returns_seeded(self, client: TestClient, seeded_store):
        resp = client.get("/api/ads")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["brief_id"] == "test_brief"


class TestCalibrationEndpoint:
    def test_no_reference_ads(self, client: TestClient):
        with patch("server.routes.calibration.REFERENCE_DIR", "/tmp/nonexistent_dir"):
            resp = client.post("/api/calibration/run")
            assert resp.status_code == 200
            data = resp.json()
            assert data["status"] == "no_reference_ads"

    def test_latest_returns_no_results_initially(self, client: TestClient):
        resp = client.get("/api/calibration/latest")
        assert resp.status_code == 200
