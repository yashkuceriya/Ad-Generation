"""Cost tracking for every LLM and API call in the pipeline."""

from __future__ import annotations

import time
import functools
from typing import Any

from src.models import StepCost
from config.settings import COST_PER_TOKEN


class PipelineMetrics:
    """Singleton counters for pipeline-level instrumentation."""

    _instance: PipelineMetrics | None = None

    def __new__(cls) -> PipelineMetrics:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._reset()
        return cls._instance

    @classmethod
    def _reset(cls) -> None:
        inst = cls._instance
        if inst is None:
            return
        # Early-stop tracking
        inst.early_stop_exceptional: int = 0   # Stopped at >= 9.0
        inst.early_stop_threshold: int = 0     # Stopped at >= 7.0 after iter 2+
        inst.full_iterations: int = 0          # Ran all max iterations
        # Iteration distribution
        inst.iteration_counts: dict[int, int] = {}  # {1: n, 2: n, 3: n}
        # Eval mode tracking
        inst.eval_batched_ok: int = 0
        inst.eval_batched_fallback: int = 0
        # Image cache tracking
        inst.image_cache_hits: int = 0
        inst.image_cache_misses: int = 0
        inst.image_force_regenerates: int = 0
        # Total briefs processed
        inst.total_briefs: int = 0

    @classmethod
    def reset(cls) -> None:
        if cls._instance is not None:
            cls._reset()

    def record_early_stop(self, reason: str) -> None:
        if "Exceptional" in reason or ">= 9" in reason:
            self.early_stop_exceptional += 1
        else:
            self.early_stop_threshold += 1

    def record_full_iterations(self) -> None:
        self.full_iterations += 1

    def record_iteration_count(self, count: int) -> None:
        self.iteration_counts[count] = self.iteration_counts.get(count, 0) + 1
        self.total_briefs += 1

    def record_eval_batched(self, success: bool) -> None:
        if success:
            self.eval_batched_ok += 1
        else:
            self.eval_batched_fallback += 1

    def record_image_cache(self, hit: bool, force: bool = False) -> None:
        if force:
            self.image_force_regenerates += 1
        elif hit:
            self.image_cache_hits += 1
        else:
            self.image_cache_misses += 1

    def summary(self) -> dict[str, Any]:
        total_evals = self.eval_batched_ok + self.eval_batched_fallback
        total_images = self.image_cache_hits + self.image_cache_misses + self.image_force_regenerates
        total_stops = self.early_stop_exceptional + self.early_stop_threshold + self.full_iterations
        return {
            "early_stopping": {
                "exceptional": self.early_stop_exceptional,
                "threshold": self.early_stop_threshold,
                "full_iterations": self.full_iterations,
                "total": total_stops,
                "early_stop_rate": round((self.early_stop_exceptional + self.early_stop_threshold) / total_stops * 100, 1) if total_stops else 0,
            },
            "iteration_distribution": self.iteration_counts,
            "eval_mode": {
                "batched_ok": self.eval_batched_ok,
                "batched_fallback": self.eval_batched_fallback,
                "total": total_evals,
                "batch_success_rate": round(self.eval_batched_ok / total_evals * 100, 1) if total_evals else 100,
            },
            "image_cache": {
                "hits": self.image_cache_hits,
                "misses": self.image_cache_misses,
                "force_regenerates": self.image_force_regenerates,
                "total": total_images,
                "hit_rate": round(self.image_cache_hits / total_images * 100, 1) if total_images else 0,
            },
            "total_briefs": self.total_briefs,
        }


class CostTracker:
    """Singleton cost tracker that logs every API call's cost and tokens."""

    _instance: CostTracker | None = None

    def __new__(cls) -> CostTracker:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._ledger: list[StepCost] = []
        return cls._instance

    @classmethod
    def reset(cls) -> None:
        if cls._instance is not None:
            cls._instance._ledger = []

    def log(self, cost: StepCost) -> None:
        self._ledger.append(cost)

    def record(
        self,
        model: str,
        step_name: str,
        pipeline_stage: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float = 0.0,
        iteration: int = 0,
        brief_id: str = "",
    ) -> StepCost:
        pricing = COST_PER_TOKEN.get(model, {"input": 0, "output": 0})

        if "per_image" in pricing:
            cost_usd = pricing["per_image"]
        else:
            cost_usd = (
                input_tokens * pricing.get("input", 0)
                + output_tokens * pricing.get("output", 0)
            )

        entry = StepCost(
            model=model,
            step_name=step_name,
            pipeline_stage=pipeline_stage,
            iteration=iteration,
            brief_id=brief_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=round(latency_ms, 2),
            cost_usd=round(cost_usd, 8),
        )
        self._ledger.append(entry)
        return entry

    @property
    def ledger(self) -> list[StepCost]:
        return list(self._ledger)

    @property
    def total_cost(self) -> float:
        return round(sum(e.cost_usd for e in self._ledger), 6)

    @property
    def total_tokens(self) -> int:
        return sum(e.input_tokens + e.output_tokens for e in self._ledger)

    def cost_by_model(self) -> dict[str, float]:
        result: dict[str, float] = {}
        for e in self._ledger:
            result[e.model] = result.get(e.model, 0) + e.cost_usd
        return {k: round(v, 6) for k, v in result.items()}

    def cost_by_stage(self) -> dict[str, float]:
        result: dict[str, float] = {}
        for e in self._ledger:
            result[e.pipeline_stage] = result.get(e.pipeline_stage, 0) + e.cost_usd
        return {k: round(v, 6) for k, v in result.items()}

    def cost_by_brief(self) -> dict[str, float]:
        result: dict[str, float] = {}
        for e in self._ledger:
            if e.brief_id:
                result[e.brief_id] = result.get(e.brief_id, 0) + e.cost_usd
        return {k: round(v, 6) for k, v in result.items()}

    def costs_for_step(
        self, brief_id: str, pipeline_stage: str, iteration: int
    ) -> list[StepCost]:
        return [
            e
            for e in self._ledger
            if e.brief_id == brief_id
            and e.pipeline_stage == pipeline_stage
            and e.iteration == iteration
        ]

    def summary(self) -> dict[str, Any]:
        return {
            "total_cost_usd": self.total_cost,
            "total_tokens": self.total_tokens,
            "total_calls": len(self._ledger),
            "cost_by_model": self.cost_by_model(),
            "cost_by_stage": self.cost_by_stage(),
        }

    def export_json(self) -> list[dict]:
        return [e.model_dump() for e in self._ledger]


def extract_token_usage(response: Any) -> tuple[int, int]:
    """Extract input/output token counts from a LangChain response."""
    input_tokens = 0
    output_tokens = 0

    if hasattr(response, "response_metadata"):
        meta = response.response_metadata
        usage = meta.get("usage_metadata", {})
        input_tokens = usage.get("prompt_token_count", 0) or usage.get("input_tokens", 0)
        output_tokens = usage.get("candidates_token_count", 0) or usage.get("output_tokens", 0)

    if hasattr(response, "usage_metadata"):
        usage = response.usage_metadata
        input_tokens = usage.get("input_tokens", input_tokens)
        output_tokens = usage.get("output_tokens", output_tokens)

    return input_tokens, output_tokens


def tracked_call(
    step_name: str,
    pipeline_stage: str,
    model_name: str,
    iteration: int = 0,
    brief_id: str = "",
):
    """Decorator to track cost of an LLM call."""

    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            tracker = CostTracker()
            start = time.perf_counter()
            result = await func(*args, **kwargs)
            elapsed_ms = (time.perf_counter() - start) * 1000
            inp, out = extract_token_usage(result)
            tracker.record(
                model=model_name,
                step_name=step_name,
                pipeline_stage=pipeline_stage,
                input_tokens=inp,
                output_tokens=out,
                latency_ms=elapsed_ms,
                iteration=iteration,
                brief_id=brief_id,
            )
            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            tracker = CostTracker()
            start = time.perf_counter()
            result = func(*args, **kwargs)
            elapsed_ms = (time.perf_counter() - start) * 1000
            inp, out = extract_token_usage(result)
            tracker.record(
                model=model_name,
                step_name=step_name,
                pipeline_stage=pipeline_stage,
                input_tokens=inp,
                output_tokens=out,
                latency_ms=elapsed_ms,
                iteration=iteration,
                brief_id=brief_id,
            )
            return result

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator
