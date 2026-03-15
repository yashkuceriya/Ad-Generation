"""Pipeline control endpoints."""

from __future__ import annotations

import json
import os

from fastapi import APIRouter, HTTPException
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
def run_history():
    """Return list of past pipeline runs."""
    path = os.path.join(REPORTS_DIR, "run_history.json")
    if not os.path.exists(path):
        return []
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
