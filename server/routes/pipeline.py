"""Pipeline control endpoints."""

from __future__ import annotations

import json
import os

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from server.state import RunStore
from server.runner import BackgroundRunner
from config.settings import REPORTS_DIR

router = APIRouter()
_runner = BackgroundRunner()


class CustomBrief(BaseModel):
    audience: str = ""
    goal: str = ""
    offer: str = ""
    tone: str = ""


class RunRequest(BaseModel):
    mode: str = "demo"
    count: int = 5
    image_mode: str = "lazy"
    custom_brief: CustomBrief | None = None


@router.post("/run")
def start_pipeline(req: RunRequest):
    store = RunStore()
    if store.run_status == "running":
        raise HTTPException(400, "Pipeline is already running")

    kwargs: dict = dict(mode=req.mode, count=req.count, image_mode=req.image_mode)
    if req.custom_brief is not None:
        kwargs["custom_brief"] = req.custom_brief.model_dump()

    _runner.start(**kwargs)
    return {"status": "started", "mode": req.mode, "count": req.count}


@router.post("/stop")
def stop_pipeline():
    store = RunStore()
    if store.run_status != "running":
        raise HTTPException(400, "Pipeline is not running")

    store.request_stop()
    return {"status": "stopping"}


@router.get("/status")
def pipeline_status():
    store = RunStore()
    return store.get_status()


@router.get("/history")
def run_history(client_id: str | None = Query(None)):
    """Return list of past pipeline runs, optionally filtered by client_id."""
    # Try DB first
    try:
        from server.database import load_run_history_from_db, db_available
        if db_available():
            entries = load_run_history_from_db(client_id=client_id)
            if entries:
                return entries
    except Exception:
        pass

    # Fall back to JSON file (no client_id filtering available here)
    path = os.path.join(REPORTS_DIR, "run_history.json")
    if not os.path.exists(path):
        return []
    try:
        with open(path) as f:
            history = json.load(f)
        # Best-effort filter on JSON data if client_id provided
        if client_id and history:
            history = [h for h in history if h.get("client_id", "") == client_id]
        return history
    except (json.JSONDecodeError, OSError):
        return []
