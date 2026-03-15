"""Baseline benchmark script — captures pipeline metrics for A/B comparison.

Usage:
    python scripts/benchmark.py                    # Run 5-ad demo benchmark
    python scripts/benchmark.py --count 10         # Custom count
    python scripts/benchmark.py --compare prev.json # Compare against previous run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config.settings import (
    MODEL_DRAFT, MODEL_REFINE, MODEL_EVAL, MODEL_VISION, MODEL_IMAGE,
    MAX_COPY_ITERATIONS, QUALITY_THRESHOLD, EARLY_STOP_THRESHOLD,
    OUTPUT_DIR,
)
from src.intelligence.brief_factory import BriefFactory
from src.pipeline import AdPipeline
from src.tracking.cost_tracker import CostTracker, PipelineMetrics


def run_benchmark(count: int = 5) -> dict:
    """Run a benchmark and return metrics."""
    CostTracker.reset()
    PipelineMetrics.reset()

    factory = BriefFactory()
    briefs = factory.generate_demo_briefs(count)

    pipeline = AdPipeline(image_mode="lazy")
    tracker = CostTracker()
    metrics = PipelineMetrics()

    start = time.time()
    results = pipeline.run_batch(briefs, save_incremental=False)
    elapsed = time.time() - start

    # Compute metrics
    scores = [r.best_copy.evaluation.weighted_average for r in results]
    costs = [r.total_cost_usd for r in results]
    iterations_used = [len(r.copy_iterations) for r in results]

    # Per-dimension averages
    dim_avgs: dict[str, list[float]] = {}
    for r in results:
        for dim, ds in r.best_copy.evaluation.scores.items():
            dim_avgs.setdefault(dim, []).append(ds.score)

    # Latency percentiles
    latencies = [c.latency_ms for c in tracker.ledger]
    latencies.sort()

    def percentile(data: list[float], p: float) -> float:
        if not data:
            return 0
        idx = int(len(data) * p / 100)
        return round(data[min(idx, len(data) - 1)], 1)

    benchmark = {
        "timestamp": datetime.now().isoformat(),
        "config": {
            "count": count,
            "model_draft": MODEL_DRAFT,
            "model_refine": MODEL_REFINE,
            "model_eval": MODEL_EVAL,
            "model_vision": MODEL_VISION,
            "model_image": MODEL_IMAGE,
            "max_copy_iterations": MAX_COPY_ITERATIONS,
            "quality_threshold": QUALITY_THRESHOLD,
            "early_stop_threshold": EARLY_STOP_THRESHOLD,
        },
        "quality": {
            "mean_score": round(sum(scores) / len(scores), 3) if scores else 0,
            "min_score": round(min(scores), 3) if scores else 0,
            "max_score": round(max(scores), 3) if scores else 0,
            "std_dev": round((sum((s - sum(scores) / len(scores)) ** 2 for s in scores) / len(scores)) ** 0.5, 3) if scores else 0,
            "pass_rate": round(sum(1 for s in scores if s >= QUALITY_THRESHOLD) / len(scores) * 100, 1) if scores else 0,
            "dimension_averages": {
                d: round(sum(v) / len(v), 3) for d, v in dim_avgs.items()
            },
            "weakest_dimensions": {},
        },
        "efficiency": {
            "mean_iterations": round(sum(iterations_used) / len(iterations_used), 2) if iterations_used else 0,
            "iteration_distribution": metrics.iteration_counts,
            "early_stop_rate": metrics.summary()["early_stopping"]["early_stop_rate"],
            "early_stop_exceptional": metrics.early_stop_exceptional,
            "early_stop_threshold": metrics.early_stop_threshold,
            "full_iterations": metrics.full_iterations,
        },
        "cost": {
            "total_cost": round(tracker.total_cost, 6),
            "mean_cost_per_ad": round(sum(costs) / len(costs), 6) if costs else 0,
            "total_tokens": tracker.total_tokens,
            "total_calls": len(tracker.ledger),
            "mean_calls_per_ad": round(len(tracker.ledger) / len(results), 1) if results else 0,
            "cost_by_stage": tracker.cost_by_stage(),
            "cost_by_model": tracker.cost_by_model(),
        },
        "latency": {
            "total_elapsed_s": round(elapsed, 1),
            "mean_per_ad_s": round(elapsed / len(results), 1) if results else 0,
            "p50_call_ms": percentile(latencies, 50),
            "p95_call_ms": percentile(latencies, 95),
            "p99_call_ms": percentile(latencies, 99),
        },
        "eval_reliability": {
            "batch_success_rate": metrics.summary()["eval_mode"]["batch_success_rate"],
            "batched_ok": metrics.eval_batched_ok,
            "batched_fallback": metrics.eval_batched_fallback,
        },
    }

    # Weakest dimension frequency
    weakest_freq: dict[str, int] = {}
    for r in results:
        w = r.best_copy.evaluation.weakest_dimension
        weakest_freq[w] = weakest_freq.get(w, 0) + 1
    benchmark["quality"]["weakest_dimensions"] = weakest_freq

    return benchmark


def compare_benchmarks(current: dict, previous: dict) -> str:
    """Generate a comparison report between two benchmarks."""
    lines = ["=" * 60, "BENCHMARK COMPARISON", "=" * 60, ""]

    def delta(curr: float, prev: float, fmt: str = ".3f", higher_better: bool = True) -> str:
        d = curr - prev
        arrow = "+" if d > 0 else ""
        good = (d > 0) == higher_better
        indicator = "BETTER" if good else "WORSE" if d != 0 else "SAME"
        return f"{curr:{fmt}} (was {prev:{fmt}}, {arrow}{d:{fmt}}) [{indicator}]"

    cq, pq = current["quality"], previous["quality"]
    lines.append("QUALITY:")
    lines.append(f"  Mean Score:   {delta(cq['mean_score'], pq['mean_score'])}")
    lines.append(f"  Pass Rate:    {delta(cq['pass_rate'], pq['pass_rate'], '.1f')}%")
    lines.append(f"  Std Dev:      {delta(cq['std_dev'], pq['std_dev'], '.3f', False)}")

    ce, pe = current["efficiency"], previous["efficiency"]
    lines.append("\nEFFICIENCY:")
    lines.append(f"  Mean Iters:   {delta(ce['mean_iterations'], pe['mean_iterations'], '.2f', False)}")
    lines.append(f"  Early Stop:   {delta(ce['early_stop_rate'], pe['early_stop_rate'], '.1f')}%")

    cc, pc = current["cost"], previous["cost"]
    lines.append("\nCOST:")
    lines.append(f"  Total:        {delta(cc['total_cost'], pc['total_cost'], '.6f', False)}")
    lines.append(f"  Per Ad:       {delta(cc['mean_cost_per_ad'], pc['mean_cost_per_ad'], '.6f', False)}")
    lines.append(f"  Calls/Ad:     {delta(cc['mean_calls_per_ad'], pc['mean_calls_per_ad'], '.1f', False)}")

    cl, pl = current["latency"], previous["latency"]
    lines.append("\nLATENCY:")
    lines.append(f"  Per Ad:       {delta(cl['mean_per_ad_s'], pl['mean_per_ad_s'], '.1f', False)}s")
    lines.append(f"  p95 Call:     {delta(cl['p95_call_ms'], pl['p95_call_ms'], '.0f', False)}ms")

    cr, pr = current["eval_reliability"], previous["eval_reliability"]
    lines.append("\nEVAL RELIABILITY:")
    lines.append(f"  Batch Rate:   {delta(cr['batch_success_rate'], pr['batch_success_rate'], '.1f')}%")

    lines.append("\n" + "=" * 60)

    # Guardrail checks
    guardrails_ok = True
    lines.append("\nGUARDRAIL CHECKS:")
    if cl["p95_call_ms"] > pl["p95_call_ms"] * 1.2:
        lines.append("  WARNING: p95 latency increased by >20%")
        guardrails_ok = False
    else:
        lines.append("  OK: p95 latency within bounds")

    if cc["mean_cost_per_ad"] > pc["mean_cost_per_ad"] * 1.15:
        if cq["mean_score"] <= pq["mean_score"] + 0.3:
            lines.append("  WARNING: Cost per ad increased >15% without significant quality lift")
            guardrails_ok = False
        else:
            lines.append("  OK: Cost increased but quality lift justifies it")
    else:
        lines.append("  OK: Cost per ad within bounds")

    if cq["pass_rate"] < pq["pass_rate"] - 5:
        lines.append("  WARNING: Pass rate dropped by >5 percentage points")
        guardrails_ok = False
    else:
        lines.append("  OK: Pass rate stable or improved")

    lines.append(f"\n{'ALL GUARDRAILS PASSED' if guardrails_ok else 'GUARDRAIL VIOLATIONS DETECTED'}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Pipeline benchmark")
    parser.add_argument("--count", type=int, default=5, help="Number of ads to generate")
    parser.add_argument("--compare", type=str, help="Path to previous benchmark JSON for comparison")
    parser.add_argument("--output", type=str, help="Output path for benchmark JSON")
    args = parser.parse_args()

    print(f"\nRunning benchmark with {args.count} ads...")
    print(f"Models: draft={MODEL_DRAFT}, eval={MODEL_EVAL}")
    print(f"Thresholds: quality={QUALITY_THRESHOLD}, early_stop={EARLY_STOP_THRESHOLD}")
    print(f"Max iterations: {MAX_COPY_ITERATIONS}\n")

    benchmark = run_benchmark(args.count)

    # Save
    output_path = args.output or os.path.join(OUTPUT_DIR, "reports", "benchmark.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(benchmark, f, indent=2, default=str)
    print(f"\nBenchmark saved to {output_path}")

    # Print summary
    q = benchmark["quality"]
    e = benchmark["efficiency"]
    c = benchmark["cost"]
    l = benchmark["latency"]
    r = benchmark["eval_reliability"]
    print(f"\n{'=' * 50}")
    print(f"BENCHMARK RESULTS ({args.count} ads)")
    print(f"{'=' * 50}")
    print(f"  Quality:    {q['mean_score']:.2f} avg | {q['pass_rate']:.0f}% pass | std {q['std_dev']:.3f}")
    print(f"  Efficiency: {e['mean_iterations']:.1f} avg iters | {e['early_stop_rate']:.0f}% early-stopped")
    print(f"  Cost:       ${c['total_cost']:.4f} total | ${c['mean_cost_per_ad']:.5f}/ad | {c['mean_calls_per_ad']:.0f} calls/ad")
    print(f"  Latency:    {l['mean_per_ad_s']:.1f}s/ad | p95={l['p95_call_ms']:.0f}ms")
    print(f"  Eval:       {r['batch_success_rate']:.0f}% batch success")

    # Compare if previous benchmark provided
    if args.compare:
        with open(args.compare) as f:
            previous = json.load(f)
        report = compare_benchmarks(benchmark, previous)
        print(f"\n{report}")

        # Save comparison report
        report_path = output_path.replace(".json", "_comparison.txt")
        with open(report_path, "w") as f:
            f.write(report)
        print(f"\nComparison saved to {report_path}")


if __name__ == "__main__":
    main()
