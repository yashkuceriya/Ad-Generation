"""Cost tracking endpoints."""

from fastapi import APIRouter, Query

from src.tracking.cost_tracker import CostTracker, PipelineMetrics
from src.evaluate.dimension_scorer import DimensionScorer
from src.models import StepCost

router = APIRouter()

_db_loaded = False


def _extract_costs_from_results() -> list[dict]:
    """Extract StepCost entries from stored ad results (fallback when DB ledger is empty)."""
    try:
        from server.state import RunStore
        store = RunStore()
        results = store.get_all_results()
        costs: list[dict] = []
        for r in results:
            for ci in (r.copy_iterations or []):
                for c in (ci.costs or []):
                    entry = c.model_dump()
                    if not entry.get("brief_id"):
                        entry["brief_id"] = r.brief_id
                    costs.append(entry)
            for ii in (r.image_iterations or []):
                for c in (ii.costs or []):
                    entry = c.model_dump()
                    if not entry.get("brief_id"):
                        entry["brief_id"] = r.brief_id
                    costs.append(entry)
        return costs
    except Exception as e:
        print(f"  [Costs] Extract from results warning: {e}")
        return []


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
        else:
            # DB ledger empty — backfill from ad results
            entries = _extract_costs_from_results()
            if entries:
                for e in entries:
                    tracker.log(StepCost(**e))
                print(f"  [Costs] Backfilled {len(entries)} entries from ad results")
                # Also persist to DB for next restart
                from server.database import save_cost_ledger_to_db
                save_cost_ledger_to_db(entries)

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
def cost_summary(client_id: str | None = Query(None)):
    _ensure_db_loaded()
    tracker = CostTracker()

    if client_id:
        # Build summary from DB entries filtered by client_id
        from server.database import load_cost_ledger_from_db
        filtered_entries = load_cost_ledger_from_db(client_id=client_id)
        total_cost = round(sum(e.get("cost_usd", 0) for e in filtered_entries), 6)
        total_tokens = sum(e.get("input_tokens", 0) + e.get("output_tokens", 0) for e in filtered_entries)
        cost_by_model: dict[str, float] = {}
        cost_by_stage: dict[str, float] = {}
        for e in filtered_entries:
            m = e.get("model", "")
            cost_by_model[m] = cost_by_model.get(m, 0) + e.get("cost_usd", 0)
            s = e.get("pipeline_stage", "")
            cost_by_stage[s] = cost_by_stage.get(s, 0) + e.get("cost_usd", 0)
        data = {
            "total_cost_usd": total_cost,
            "total_tokens": total_tokens,
            "total_calls": len(filtered_entries),
            "cost_by_model": {k: round(v, 6) for k, v in cost_by_model.items()},
            "cost_by_stage": {k: round(v, 6) for k, v in cost_by_stage.items()},
        }
    else:
        data = tracker.summary()

    data["parse_telemetry"] = DimensionScorer.parse_telemetry()
    data["pipeline_metrics"] = PipelineMetrics().summary()

    # Add image generation costs (not tracked in cost ledger)
    from server.database import get_session, ImageRow
    from sqlalchemy import func
    from config.settings import IMAGE_COST_PER_IMAGE

    session = get_session()
    if session:
        try:
            query = session.query(func.count(ImageRow.id))
            if client_id:
                query = query.filter(ImageRow.client_id == client_id)
            img_count = query.scalar() or 0
            session.close()
        except Exception:
            img_count = 0
            session.close()
    else:
        img_count = 0

    image_total = round(img_count * IMAGE_COST_PER_IMAGE, 4)
    data["image_costs"] = {"count": img_count, "cost_per_image": IMAGE_COST_PER_IMAGE, "total_cost": image_total}
    data["total_cost_usd"] = round(data["total_cost_usd"] + image_total, 6)
    data["cost_by_stage"]["Image Generation"] = image_total

    return data


@router.get("/ledger")
def cost_ledger(client_id: str | None = Query(None)):
    _ensure_db_loaded()

    if client_id:
        from server.database import load_cost_ledger_from_db
        return load_cost_ledger_from_db(client_id=client_id)

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


@router.post("/backfill")
def backfill_costs():
    """One-time backfill: extract cost data from stored ad results into the cost ledger."""
    from server.state import RunStore
    from server.database import save_cost_ledger_to_db, db_available

    store = RunStore()
    results = store.get_all_results()
    if not results:
        return {"status": "no_results", "entries": 0}

    # Extract all StepCost entries from ad results
    all_costs: list[dict] = []
    for r in results:
        for ci in (r.copy_iterations or []):
            for c in (ci.costs or []):
                entry = c.model_dump()
                if not entry.get("brief_id"):
                    entry["brief_id"] = r.brief_id
                all_costs.append(entry)
        for ii in (r.image_iterations or []):
            for c in (ii.costs or []):
                entry = c.model_dump()
                if not entry.get("brief_id"):
                    entry["brief_id"] = r.brief_id
                all_costs.append(entry)

    if not all_costs:
        return {"status": "no_costs", "entries": 0}

    # Load into in-memory tracker
    tracker = CostTracker()
    if not tracker.ledger:
        for e in all_costs:
            tracker.log(StepCost(**e))

    # Save to DB
    db_saved = False
    if db_available():
        db_saved = save_cost_ledger_to_db(all_costs)

    total_cost = sum(e.get("cost_usd", 0) for e in all_costs)
    return {
        "status": "backfilled",
        "entries": len(all_costs),
        "total_cost_usd": round(total_cost, 6),
        "db_saved": db_saved,
        "briefs_processed": len(results),
    }
