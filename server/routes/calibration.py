"""Calibration endpoints — evaluate the engine against reference ads."""

from __future__ import annotations

import json
import os
import threading
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from src.models import AdBrief, AdCopy, AudienceSegment, CampaignGoal
from src.evaluate.copy_evaluator import CopyEvaluator

router = APIRouter()

REFERENCE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "reference_ads",
)

_run_lock = threading.Lock()
_latest_result: dict[str, Any] | None = None
_running = False


class CalibrationResult(BaseModel):
    status: str
    results: list[dict[str, Any]]
    aggregate: dict[str, Any]


def _load_reference_ads() -> list[dict]:
    ads = []
    if not os.path.isdir(REFERENCE_DIR):
        return ads
    for fname in sorted(os.listdir(REFERENCE_DIR)):
        if not fname.endswith(".json"):
            continue
        path = os.path.join(REFERENCE_DIR, fname)
        try:
            with open(path) as f:
                data = json.load(f)
            data["_source_file"] = fname
            ads.append(data)
        except Exception:
            continue
    return ads


def _run_calibration(ref_ads: list[dict]) -> dict[str, Any]:
    evaluator = CopyEvaluator()
    results: list[dict[str, Any]] = []

    for ref in ref_ads:
        brief_data = ref.get("brief", {})
        best_idx = ref.get("best_copy_index", 0)
        iterations = ref.get("copy_iterations", [])
        if not iterations:
            continue

        copy_data = iterations[best_idx].get("ad_copy", {})

        try:
            audience = AudienceSegment(brief_data.get("audience_segment", "parents"))
            goal = CampaignGoal(brief_data.get("campaign_goal", "conversion"))
        except ValueError:
            audience = AudienceSegment.PARENTS
            goal = CampaignGoal.CONVERSION

        brief = AdBrief(
            brief_id=ref.get("brief_id", brief_data.get("brief_id", "calibration")),
            audience_segment=audience,
            product_offer=brief_data.get("product_offer", "SAT prep"),
            campaign_goal=goal,
            tone=brief_data.get("tone", "encouraging"),
            competitor_context=brief_data.get("competitor_context", []),
            subject_focus=brief_data.get("subject_focus", "SAT test prep"),
        )

        ad_copy = AdCopy(
            primary_text=copy_data.get("primary_text", ""),
            headline=copy_data.get("headline", ""),
            description=copy_data.get("description", ""),
            cta_button=copy_data.get("cta_button", "Learn More"),
        )

        evaluation, costs = evaluator.evaluate(ad_copy, brief, iteration=1)

        expected = ref.get("_expected_scores", {})
        deviations = {}
        if expected:
            for dim, expected_score in expected.items():
                actual_score = evaluation.scores.get(dim)
                if actual_score:
                    deviations[dim] = round(actual_score.score - expected_score, 2)

        entry: dict[str, Any] = {
            "source_file": ref.get("_source_file", "unknown"),
            "brief_id": brief.brief_id,
            "headline": ad_copy.headline,
            "weighted_average": evaluation.weighted_average,
            "weakest_dimension": evaluation.weakest_dimension,
            "scores": {d: s.score for d, s in evaluation.scores.items()},
            "total_cost_usd": round(sum(c.cost_usd for c in costs), 6),
        }
        if expected:
            entry["expected_scores"] = expected
            entry["deviations"] = deviations
        results.append(entry)

    avg_score = (
        sum(r["weighted_average"] for r in results) / len(results)
        if results else 0
    )

    return {
        "status": "complete",
        "results": results,
        "aggregate": {
            "count": len(results),
            "avg_weighted_score": round(avg_score, 2),
        },
    }


@router.post("/run")
def run_calibration():
    """Run the evaluator against all reference ads in data/reference_ads/."""
    global _running, _latest_result

    ref_ads = _load_reference_ads()
    if not ref_ads:
        return {
            "status": "no_reference_ads",
            "message": "No reference ad JSON files found in data/reference_ads/",
            "results": [],
            "aggregate": {"count": 0},
        }

    if _running:
        return {"status": "already_running"}

    with _run_lock:
        _running = True
        try:
            result = _run_calibration(ref_ads)
            _latest_result = result
            return result
        finally:
            _running = False


@router.get("/latest")
def get_latest_result():
    """Return the most recent calibration run result."""
    if _latest_result is None:
        return {"status": "no_results", "message": "No calibration run has been executed yet"}
    return _latest_result
