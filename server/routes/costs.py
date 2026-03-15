"""Cost tracking endpoints."""

from fastapi import APIRouter

from src.tracking.cost_tracker import CostTracker, PipelineMetrics
from src.evaluate.dimension_scorer import DimensionScorer
from src.models import StepCost

router = APIRouter()

_db_loaded = False


def _ensure_db_loaded():
    """Load cost ledger from DB into in-memory tracker on first access."""
    global _db_loaded
    if _db_loaded:
        return
    _db_loaded = True

    tracker = CostTracker()
    if tracker.ledger:
        return  # already has data from a current run

    try:
        from server.database import load_cost_ledger_from_db, load_parse_telemetry_from_db

        entries = load_cost_ledger_from_db()
        if entries:
            for e in entries:
                tracker.log(StepCost(**e))
            print(f"  [Costs] Loaded {len(entries)} ledger entries from DB")

        telemetry = load_parse_telemetry_from_db()
        if telemetry:
            DimensionScorer._parse_ok = telemetry.get("json_ok", 0)
            DimensionScorer._parse_fallback_json_extract = telemetry.get("json_extract", 0)
            DimensionScorer._parse_fallback_regex = telemetry.get("regex_fallback", 0)
            DimensionScorer._parse_fallback_default = telemetry.get("default_fallback", 0)
            print(f"  [Costs] Loaded parse telemetry from DB")
    except Exception as e:
        print(f"  [Costs] DB load warning: {e}")


@router.get("/summary")
def cost_summary():
    _ensure_db_loaded()
    tracker = CostTracker()
    data = tracker.summary()
    data["parse_telemetry"] = DimensionScorer.parse_telemetry()
    data["pipeline_metrics"] = PipelineMetrics().summary()
    return data


@router.get("/ledger")
def cost_ledger():
    _ensure_db_loaded()
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
