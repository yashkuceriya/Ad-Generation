"""Background pipeline runner with SSE event broadcasting."""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime

from src.models import (
    AdBrief, AdResult, CopyIteration, ImageIteration,
    ComplianceResult as ComplianceResultModel,
    ComplianceViolation as ComplianceViolationModel,
    DiversityResult as DiversityResultModel,
    DiversityIssue as DiversityIssueModel,
)
from config.settings import REPORTS_DIR
from src.iterate.copy_iterator import CopyIterator
from src.iterate.image_iterator import ImageIterator
from src.iterate.best_selector import BestSelector
from src.evaluate.compliance_checker import ComplianceChecker
from src.evaluate.diversity_checker import DiversityChecker
from src.tracking.cost_tracker import CostTracker, PipelineMetrics
from src.tracking.rate_limiter import RateLimiter
from src.intelligence.brief_factory import BriefFactory
from server.state import RunStore
from server.sse import SSEBroadcaster


class BackgroundRunner:
    """Runs the ad pipeline in a background thread with SSE progress."""

    def __init__(self):
        self.store = RunStore()
        self.broadcaster = SSEBroadcaster()
        self.copy_iterator = CopyIterator()
        self.image_iterator = ImageIterator()
        self.selector = BestSelector()
        self.compliance_checker = ComplianceChecker()
        self.diversity_checker = DiversityChecker()
        self.tracker = CostTracker()
        self._thread: threading.Thread | None = None

    def start(
        self,
        mode: str = "demo",
        count: int = 5,
        image_mode: str = "lazy",
        custom_brief: dict | None = None,
    ) -> None:
        if self.store.run_status == "running":
            return

        CostTracker.reset()
        PipelineMetrics.reset()
        RateLimiter.reset()
        self.tracker = CostTracker()

        factory = BriefFactory()
        if mode == "custom" and custom_brief:
            briefs = factory.generate_custom_brief(custom_brief)
        elif mode == "single":
            briefs = factory.generate_demo_briefs(1)
        elif mode == "demo":
            briefs = factory.generate_demo_briefs(min(count, 5))
        else:
            briefs = factory.generate_briefs(count)

        self.store.start_run(len(briefs))

        self._thread = threading.Thread(
            target=self._run,
            args=(briefs, image_mode),
            daemon=True,
        )
        self._thread.start()

        self.broadcaster.broadcast_sync("pipeline_started", {
            "total_briefs": len(briefs),
            "mode": mode,
            "image_mode": image_mode,
        })

    def _run(self, briefs: list[AdBrief], image_mode: str) -> None:
        try:
            for i, brief in enumerate(briefs):
                if self.store.should_stop:
                    self.store.run_status = "stopped"
                    self.broadcaster.broadcast_sync("pipeline_stopped", {
                        "completed": i,
                        "total": len(briefs),
                    })
                    return

                self.store.current_brief_index = i
                self.store.current_brief_id = brief.brief_id
                self.store.current_phase = "copy_generation"

                self.broadcaster.broadcast_sync("brief_started", {
                    "brief_id": brief.brief_id,
                    "index": i,
                    "total": len(briefs),
                    "audience": brief.audience_segment.value,
                    "goal": brief.campaign_goal.value,
                    "offer": brief.product_offer,
                    "tone": brief.tone,
                })

                result = self._run_single(brief, image_mode)

                self.broadcaster.broadcast_sync("brief_complete", {
                    "brief_id": brief.brief_id,
                    "index": i,
                    "total": len(briefs),
                    "score": result.best_copy.evaluation.weighted_average,
                    "cost": result.total_cost_usd,
                    "iterations_used": len(result.copy_iterations),
                    "has_image": bool(result.image_iterations),
                    "status": result.status,
                    "early_stopped": result.early_stopped,
                    "early_stop_reason": result.early_stop_reason,
                })

            self.store.run_status = "completed"
            results = self.store.get_run_results()
            scores = [r.best_copy.evaluation.weighted_average for r in results]
            elapsed = (datetime.now() - self.store.started_at).total_seconds()

            # Persist results and run metadata to disk
            self._persist_results(results, scores, elapsed)

            passing_statuses = {"published", "evaluator_pass", "compliance_pass", "human_approved", "experiment_ready"}
            passed = sum(1 for r in results if r.status in passing_statuses)
            self.broadcaster.broadcast_sync("pipeline_complete", {
                "total_ads": len(results),
                "avg_score": round(sum(scores) / len(scores), 2) if scores else 0,
                "pass_rate": round(passed / len(results) * 100) if results else 0,
                "published": passed,
                "below_threshold": len(results) - passed,
                "total_cost": self.tracker.total_cost,
                "elapsed_seconds": elapsed,
            })

        except Exception as e:
            self.store.run_status = "error"
            self.store.error = str(e)
            self.broadcaster.broadcast_sync("pipeline_error", {
                "error": str(e),
                "brief_id": self.store.current_brief_id,
            })

    def _run_single(self, brief: AdBrief, image_mode: str) -> AdResult:
        # Create a live result object that gets updated incrementally
        result = AdResult(
            brief_id=brief.brief_id,
            brief=brief,
            copy_iterations=[],
            image_iterations=[],
            best_copy_index=0,
            best_image_index=0,
        )
        # Store immediately so frontend can fetch in-progress data
        self.store.add_result(result)

        def on_copy_iteration(iteration: CopyIteration) -> None:
            self.store.current_phase = f"copy_iteration_{iteration.iteration_number}"
            # result.copy_iterations is the same list the iterator appends to
            result.best_copy_index = self.selector.select_best_copy(result.copy_iterations)
            result.compute_totals()
            # Send full score breakdown so frontend can update radar chart live
            dim_scores = {dim: ds.score for dim, ds in iteration.evaluation.scores.items()}
            self.broadcaster.broadcast_sync("copy_iteration_complete", {
                "brief_id": brief.brief_id,
                "iteration": iteration.iteration_number,
                "score": iteration.evaluation.weighted_average,
                "weakest_dimension": iteration.evaluation.weakest_dimension,
                "headline": iteration.ad_copy.headline,
                "dimension_scores": dim_scores,
                "total_copy_iterations": len(result.copy_iterations),
                "best_copy_index": result.best_copy_index,
            })

        def on_image_iteration(iteration: ImageIteration) -> None:
            self.store.current_phase = f"image_iteration_{iteration.iteration_number}"
            result.best_image_index = self.selector.select_best_image(result.image_iterations)
            result.compute_totals()
            self.broadcaster.broadcast_sync("image_iteration_complete", {
                "brief_id": brief.brief_id,
                "iteration": iteration.iteration_number,
                "score": iteration.evaluation.average_score,
                "brand_consistency": iteration.evaluation.brand_consistency,
                "engagement_potential": iteration.evaluation.engagement_potential,
                "text_image_alignment": iteration.evaluation.text_image_alignment,
                "rationale": iteration.evaluation.rationale[:150] if iteration.evaluation.rationale else "",
                "total_image_iterations": len(result.image_iterations),
            })

        # Pass result's lists to iterators so they append directly — enables live fetching
        _, early_stopped, stop_reason = self.copy_iterator.iterate(
            brief,
            on_iteration=on_copy_iteration,
            iterations=result.copy_iterations,
        )
        result.early_stopped = early_stopped
        result.early_stop_reason = stop_reason

        # Compliance check (rule-based, instant, zero cost)
        self.store.current_phase = "compliance_check"
        best_copy = result.copy_iterations[result.best_copy_index].ad_copy
        compliance = self.compliance_checker.check(best_copy)
        result.compliance = ComplianceResultModel(
            passes=compliance.passes,
            violations=[
                ComplianceViolationModel(
                    severity=v.severity, field=v.field, rule=v.rule,
                    message=v.message, suggestion=v.suggestion,
                )
                for v in compliance.violations
            ],
            score=compliance.score,
        )
        # Recompute totals after compliance so status reflects compliance_pass
        result.compute_totals()

        self.broadcaster.broadcast_sync("compliance_complete", {
            "brief_id": brief.brief_id,
            "passes": compliance.passes,
            "score": compliance.score,
            "errors": len(compliance.errors),
            "warnings": len(compliance.warnings),
            "status": result.status,
        })

        # Diversity check (rule-based, instant, zero cost)
        self.store.current_phase = "diversity_check"
        all_results = self.store.get_all_results()
        existing_copies = [
            (r.brief_id, r.copy_iterations[r.best_copy_index].ad_copy)
            for r in all_results
            if r.brief_id != brief.brief_id and r.copy_iterations
        ]
        if existing_copies:
            diversity = self.diversity_checker.check(best_copy, brief.brief_id, existing_copies)
            result.diversity = DiversityResultModel(
                is_diverse=diversity.is_diverse,
                issues=[
                    DiversityIssueModel(
                        severity=issue.severity, field=issue.field, rule=issue.rule,
                        message=issue.message, similar_to=issue.similar_to,
                        similarity=issue.similarity,
                    )
                    for issue in diversity.issues
                ],
                diversity_score=diversity.diversity_score,
                most_similar_id=diversity.most_similar_id,
                most_similar_score=diversity.most_similar_score,
            )
            self.broadcaster.broadcast_sync("diversity_complete", {
                "brief_id": brief.brief_id,
                "is_diverse": diversity.is_diverse,
                "score": diversity.diversity_score,
                "issues": len(diversity.issues),
                "most_similar_id": diversity.most_similar_id,
                "most_similar_score": diversity.most_similar_score,
            })

        if image_mode == "eager":
            self.store.current_phase = "image_generation"
            best_copy = result.copy_iterations[result.best_copy_index].ad_copy
            self.image_iterator.iterate(
                ad_copy=best_copy,
                brief=brief,
                on_iteration=on_image_iteration,
                iterations=result.image_iterations,
            )

        result.compute_totals()
        return result

    def _persist_results(
        self, results: list[AdResult], scores: list[float], elapsed: float,
    ) -> None:
        """Write run results, cost artifacts, and summary report to disk."""
        try:
            os.makedirs(REPORTS_DIR, exist_ok=True)

            all_results = self.store.get_all_results()
            results_path = os.path.join(REPORTS_DIR, "final_results.json")
            tmp_path = results_path + ".tmp"
            with open(tmp_path, "w") as f:
                json.dump(
                    [r.model_dump() for r in all_results],
                    f,
                    indent=2,
                    default=str,
                )
            os.replace(tmp_path, results_path)  # atomic on most filesystems

            # Append to run_history.json
            history_path = os.path.join(REPORTS_DIR, "run_history.json")
            history: list[dict] = []
            if os.path.exists(history_path):
                try:
                    with open(history_path) as f:
                        history = json.load(f)
                except (json.JSONDecodeError, OSError):
                    pass

            history.append({
                "timestamp": datetime.now().isoformat(),
                "total_ads": len(results),
                "avg_score": round(sum(scores) / len(scores), 2) if scores else 0,
                "pass_rate": round(
                    sum(1 for s in scores if s >= 7.0) / len(scores) * 100
                ) if scores else 0,
                "total_cost": self.tracker.total_cost,
                "elapsed_seconds": round(elapsed, 1),
                "brief_ids": [r.brief_id for r in results],
            })

            tmp_history = history_path + ".tmp"
            with open(tmp_history, "w") as f:
                json.dump(history, f, indent=2, default=str)
            os.replace(tmp_history, history_path)  # atomic

            # Cost summary and ledger (matches CLI output)
            cost_summary_path = os.path.join(REPORTS_DIR, "cost_summary.json")
            with open(cost_summary_path, "w") as f:
                json.dump(self.tracker.summary(), f, indent=2, default=str)

            cost_ledger_path = os.path.join(REPORTS_DIR, "cost_ledger.json")
            with open(cost_ledger_path, "w") as f:
                json.dump(self.tracker.export_json(), f, indent=2, default=str)

            # Human-readable markdown summary
            from src.output.formatter import AdFormatter
            formatter = AdFormatter()
            formatter.generate_markdown_report(results)
            formatter.export_iteration_history(results)

            print(f"  [Runner] Persisted {len(all_results)} results + cost/report artifacts to {REPORTS_DIR}")
        except Exception as e:
            print(f"  [Runner] Warning: failed to persist results: {e}")
