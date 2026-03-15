"""In-memory state store for pipeline runs and ad results, with optional PostgreSQL persistence."""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from typing import Any

from src.models import AdResult
from server.database import (
    db_available, init_db, get_session,
    AdResultRow, RunHistoryRow, CostLedgerRow,
)


class RunStore:
    """Singleton in-memory store with DB persistence when DATABASE_URL is set."""

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
                inst._db_ready: bool = False
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

    def _init_db(self) -> None:
        """Initialize DB connection if not already done."""
        if not self._db_ready and db_available():
            self._db_ready = init_db()
            if self._db_ready:
                print("  PostgreSQL connected — persistence enabled")
            else:
                print("  PostgreSQL connection failed — falling back to in-memory")

    def _persist_result(self, result: AdResult) -> None:
        """Write a single result to DB."""
        if not self._db_ready:
            return
        session = get_session()
        if not session:
            return
        try:
            data = result.model_dump(mode="json")
            best_score = result.best_copy.evaluation.weighted_average
            row = session.get(AdResultRow, result.brief_id)
            if row:
                row.data = data
                row.weighted_average = best_score
                row.status = result.status
                row.total_cost_usd = result.total_cost_usd
                row.early_stopped = result.early_stopped
                row.updated_at = datetime.utcnow()
            else:
                row = AdResultRow(
                    brief_id=result.brief_id,
                    data=data,
                    weighted_average=best_score,
                    status=result.status,
                    total_cost_usd=result.total_cost_usd,
                    early_stopped=result.early_stopped,
                )
                session.add(row)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"  DB persist error: {e}")
        finally:
            session.close()

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
        self._persist_result(result)

    def update_result(self, result: AdResult) -> None:
        """Update an existing result in-place (e.g. after manual refinement)."""
        with self._lock:
            self._results[result.brief_id] = result
            if result.brief_id in self._run_results:
                self._run_results[result.brief_id] = result
        self._persist_result(result)

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

    def save_run_history(self, elapsed: float) -> None:
        """Save run summary to DB."""
        if not self._db_ready:
            return
        session = get_session()
        if not session:
            return
        try:
            results = self.get_run_results()
            scores = [
                r.best_copy.evaluation.weighted_average for r in results
            ]
            costs = [r.total_cost_usd for r in results]
            row = RunHistoryRow(
                total_ads=len(results),
                avg_score=round(sum(scores) / len(scores), 2) if scores else 0,
                pass_rate=round(sum(1 for s in scores if s >= 7.0) / len(scores) * 100, 1) if scores else 0,
                total_cost=round(sum(costs), 6),
                elapsed_seconds=round(elapsed, 1),
                brief_ids=[r.brief_id for r in results],
            )
            session.add(row)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"  DB run history error: {e}")
        finally:
            session.close()

    def load_existing_results(self) -> int:
        """Load results from DB first, then fall back to JSON file."""
        self._init_db()

        # Try DB first
        if self._db_ready:
            loaded = self._load_from_db()
            if loaded > 0:
                return loaded

        # Fall back to JSON file
        return self._load_from_json()

    def _load_from_db(self) -> int:
        session = get_session()
        if not session:
            return 0
        try:
            rows = session.query(AdResultRow).all()
            with self._lock:
                for row in rows:
                    result = AdResult.model_validate(row.data)
                    if result.copy_iterations:
                        result.compute_totals()
                    self._results[result.brief_id] = result
                self._run_results = dict(self._results)
            return len(rows)
        except Exception as e:
            print(f"  DB load error: {e}")
            return 0
        finally:
            session.close()

    def _load_from_json(self) -> int:
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
                    if result.copy_iterations:
                        result.compute_totals()
                    self._results[result.brief_id] = result
                self._run_results = dict(self._results)

            # If DB is available, seed it from JSON
            if self._db_ready:
                for result in self._results.values():
                    self._persist_result(result)
                print(f"  Seeded DB with {len(self._results)} results from JSON")

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
                "db_connected": self._db_ready,
            }
