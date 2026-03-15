"""In-memory state store for pipeline runs and ad results."""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from typing import Any, Literal

from src.models import AdResult


class RunStore:
    """Singleton in-memory store for pipeline state."""

    _instance: RunStore | None = None
    _init_lock = threading.Lock()
    _lock = threading.Lock()

    def __new__(cls) -> RunStore:
        with cls._init_lock:
            if cls._instance is None:
                inst = super().__new__(cls)
                inst._results: dict[str, AdResult] = {}
                inst._run_results: dict[str, AdResult] = {}
                inst.run_status: str = "idle"
                inst.current_brief_index: int = 0
                inst.total_briefs: int = 0
                inst.current_phase: str = ""
                inst.current_brief_id: str = ""
                inst.started_at: datetime | None = None
                inst.error: str | None = None
                inst._stop_requested: bool = False
                cls._instance = inst
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        with cls._lock:
            if cls._instance:
                cls._instance._results = {}
                cls._instance._run_results = {}
                cls._instance.run_status = "idle"
                cls._instance.current_brief_index = 0
                cls._instance.total_briefs = 0
                cls._instance.current_phase = ""
                cls._instance.current_brief_id = ""
                cls._instance.started_at = None
                cls._instance.error = None
                cls._instance._stop_requested = False

    def start_run(self, total_briefs: int) -> None:
        with self._lock:
            self._run_results = {}
            self.run_status = "running"
            self.total_briefs = total_briefs
            self.current_brief_index = 0
            self.current_phase = ""
            self.current_brief_id = ""
            self.started_at = datetime.now()
            self.error = None
            self._stop_requested = False

    def add_result(self, result: AdResult) -> None:
        with self._lock:
            self._results[result.brief_id] = result
            self._run_results[result.brief_id] = result

    def update_result(self, result: AdResult) -> None:
        """Update an existing result in-place (e.g. after manual refinement)."""
        with self._lock:
            self._results[result.brief_id] = result
            if result.brief_id in self._run_results:
                self._run_results[result.brief_id] = result

    def get_result(self, brief_id: str) -> AdResult | None:
        with self._lock:
            return self._results.get(brief_id)

    def get_all_results(self) -> list[AdResult]:
        with self._lock:
            return list(self._results.values())

    def get_run_results(self) -> list[AdResult]:
        """Get only results from the current/last run."""
        with self._lock:
            return list(self._run_results.values())

    def request_stop(self) -> None:
        self._stop_requested = True

    @property
    def should_stop(self) -> bool:
        return self._stop_requested

    def load_existing_results(self) -> int:
        """Load results from previous runs if available."""
        results_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "output", "reports", "final_results.json",
        )
        if not os.path.exists(results_path):
            return 0

        try:
            with open(results_path) as f:
                data = json.load(f)
            with self._lock:
                for item in data:
                    result = AdResult.model_validate(item)
                    # Recompute status in case it was saved as "iterating"
                    if result.copy_iterations:
                        result.compute_totals()
                    self._results[result.brief_id] = result
                self._run_results = dict(self._results)
            return len(data)
        except Exception as e:
            print(f"  Warning: Could not load existing results: {e}")
            return 0

    def get_status(self) -> dict[str, Any]:
        with self._lock:
            elapsed = None
            if self.started_at:
                elapsed = (datetime.now() - self.started_at).total_seconds()

            return {
                "status": self.run_status,
                "current_brief_index": self.current_brief_index,
                "total_briefs": self.total_briefs,
                "current_phase": self.current_phase,
                "current_brief_id": self.current_brief_id,
                "elapsed_seconds": elapsed,
                "error": self.error,
                "completed_ads": len(self._results),
                "completed_run_ads": len(self._run_results),
            }
