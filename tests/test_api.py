"""Tests for API endpoints using FastAPI TestClient."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient


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


def test_get_ads_returns_list(client: TestClient):
    """GET /api/ads should return an empty list when no ads exist."""
    resp = client.get("/api/ads")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_get_pipeline_status(client: TestClient):
    """GET /api/pipeline/status should return a status object."""
    resp = client.get("/api/pipeline/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data


def test_get_config_returns_required_fields(client: TestClient):
    """GET /api/config should return config with models, pipeline, and dimension_weights."""
    resp = client.get("/api/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    assert "pipeline" in data
    assert "dimension_weights" in data
    assert "cost_per_token" in data
    # Verify pipeline sub-fields
    pipeline = data["pipeline"]
    assert "quality_threshold" in pipeline
    assert "max_copy_iterations" in pipeline


def test_health_endpoint(client: TestClient):
    """GET /api/health should return ok status."""
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "nerdy-ad-engine"
