"""Cost tracking endpoints."""

from fastapi import APIRouter

from src.tracking.cost_tracker import CostTracker, PipelineMetrics
from src.evaluate.dimension_scorer import DimensionScorer

router = APIRouter()


@router.get("/summary")
def cost_summary():
    tracker = CostTracker()
    data = tracker.summary()
    data["parse_telemetry"] = DimensionScorer.parse_telemetry()
    data["pipeline_metrics"] = PipelineMetrics().summary()
    return data


@router.get("/ledger")
def cost_ledger():
    tracker = CostTracker()
    return tracker.export_json()


@router.post("/reset-telemetry")
def reset_telemetry():
    """Reset parse telemetry counters for a clean calibration run."""
    DimensionScorer._parse_ok = 0
    DimensionScorer._parse_fallback_json_extract = 0
    DimensionScorer._parse_fallback_regex = 0
    DimensionScorer._parse_fallback_default = 0
    return {"status": "reset", "telemetry": DimensionScorer.parse_telemetry()}
