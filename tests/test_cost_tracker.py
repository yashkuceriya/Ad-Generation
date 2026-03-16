"""Tests for cost tracking."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.tracking.cost_tracker import CostTracker


def test_cost_tracker_singleton():
    CostTracker.reset()
    t1 = CostTracker()
    t2 = CostTracker()
    assert t1 is t2


def test_record_and_total():
    CostTracker.reset()
    tracker = CostTracker()

    tracker.record(
        model="google/gemini-3-flash-preview",
        step_name="test_step",
        pipeline_stage="test",
        input_tokens=1000,
        output_tokens=500,
        latency_ms=100.0,
        brief_id="test_001",
    )

    assert tracker.total_cost > 0
    assert tracker.total_tokens == 1500
    assert len(tracker.ledger) == 1


def test_cost_by_model():
    CostTracker.reset()
    tracker = CostTracker()

    tracker.record(model="google/gemini-3-flash-preview", step_name="a", pipeline_stage="gen",
                   input_tokens=100, output_tokens=50)
    tracker.record(model="google/gemini-3.1-flash-lite-preview", step_name="b", pipeline_stage="eval",
                   input_tokens=200, output_tokens=100)

    by_model = tracker.cost_by_model()
    assert "google/gemini-3-flash-preview" in by_model
    assert by_model["google/gemini-3-flash-preview"] > 0


def test_cost_by_stage():
    CostTracker.reset()
    tracker = CostTracker()

    tracker.record(model="google/gemini-3-flash-preview", step_name="a", pipeline_stage="generation",
                   input_tokens=100, output_tokens=50)
    tracker.record(model="google/gemini-3-flash-preview", step_name="b", pipeline_stage="evaluation",
                   input_tokens=200, output_tokens=100)

    by_stage = tracker.cost_by_stage()
    assert "generation" in by_stage
    assert "evaluation" in by_stage


def test_cost_by_brief():
    CostTracker.reset()
    tracker = CostTracker()

    tracker.record(model="google/gemini-3-flash-preview", step_name="a", pipeline_stage="gen",
                   input_tokens=100, output_tokens=50, brief_id="b1")
    tracker.record(model="google/gemini-3-flash-preview", step_name="b", pipeline_stage="gen",
                   input_tokens=200, output_tokens=100, brief_id="b2")

    by_brief = tracker.cost_by_brief()
    assert "b1" in by_brief
    assert "b2" in by_brief


def test_summary():
    CostTracker.reset()
    tracker = CostTracker()

    tracker.record(model="google/gemini-3-flash-preview", step_name="test", pipeline_stage="test",
                   input_tokens=500, output_tokens=200)

    summary = tracker.summary()
    assert "total_cost_usd" in summary
    assert "total_tokens" in summary
    assert "total_calls" in summary
    assert summary["total_calls"] == 1


def test_export_json():
    CostTracker.reset()
    tracker = CostTracker()

    tracker.record(model="google/gemini-3-flash-preview", step_name="test", pipeline_stage="test",
                   input_tokens=100, output_tokens=50)

    exported = tracker.export_json()
    assert len(exported) == 1
    assert exported[0]["model"] == "google/gemini-3-flash-preview"


def test_image_cost():
    CostTracker.reset()
    tracker = CostTracker()

    tracker.record(model="google/gemini-3.1-flash-image-preview", step_name="gen_image",
                   pipeline_stage="image_generation")

    assert tracker.total_cost == 0.07  # per_image pricing from COST_PER_TOKEN
