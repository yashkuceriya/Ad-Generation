"""Visualization of quality trends, cost analysis, and iteration effectiveness."""

from __future__ import annotations

import os
import json
from typing import Any

from src.models import AdResult
from config.settings import VISUALIZATIONS_DIR


class AdVisualizer:
    """Generates charts and visualizations for ad pipeline results."""

    def __init__(self):
        os.makedirs(VISUALIZATIONS_DIR, exist_ok=True)

    def generate_all(self, results: list[AdResult]) -> list[str]:
        """Generate all visualizations. Returns list of saved file paths."""
        paths = []
        paths.append(self.quality_improvement_chart(results))
        paths.append(self.dimension_distribution(results))
        paths.append(self.cost_quality_scatter(results))
        paths.append(self.iteration_heatmap(results))
        paths.append(self.score_histogram(results))
        paths.append(self.cost_breakdown(results))
        return [p for p in paths if p]

    def quality_improvement_chart(self, results: list[AdResult]) -> str | None:
        """Line chart: average score per iteration across all ads."""
        try:
            import plotly.graph_objects as go

            iter_scores: dict[int, list[float]] = {}
            for r in results:
                for ci in r.copy_iterations:
                    n = ci.iteration_number
                    iter_scores.setdefault(n, []).append(ci.evaluation.weighted_average)

            iters = sorted(iter_scores.keys())
            avg_scores = [sum(iter_scores[i]) / len(iter_scores[i]) for i in iters]
            counts = [len(iter_scores[i]) for i in iters]

            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=iters, y=avg_scores, mode="lines+markers",
                name="Avg Score",
                line=dict(color="#1A73E8", width=3),
                marker=dict(size=12),
            ))

            for i, (it, avg, cnt) in enumerate(zip(iters, avg_scores, counts)):
                fig.add_annotation(
                    x=it, y=avg,
                    text=f"{avg:.2f}<br>(n={cnt})",
                    showarrow=False, yshift=20,
                )

            fig.add_hline(y=7.0, line_dash="dash", line_color="red",
                         annotation_text="Quality Threshold (7.0)")

            fig.update_layout(
                title="Quality Improvement Across Iterations",
                xaxis_title="Iteration",
                yaxis_title="Average Weighted Score",
                yaxis_range=[0, 10],
                template="plotly_white",
            )

            path = os.path.join(VISUALIZATIONS_DIR, "quality_improvement.html")
            fig.write_html(path)
            return path

        except ImportError:
            return self._fallback_quality_chart(results)

    def dimension_distribution(self, results: list[AdResult]) -> str | None:
        """Box plot: score distribution per dimension (best iterations only)."""
        try:
            import plotly.graph_objects as go

            dim_scores: dict[str, list[float]] = {}
            for r in results:
                best = r.best_copy
                for dim, ds in best.evaluation.scores.items():
                    dim_scores.setdefault(dim, []).append(ds.score)

            fig = go.Figure()
            colors = ["#1A73E8", "#34A853", "#FBBC04", "#EA4335", "#9334E6"]
            for i, (dim, scores) in enumerate(sorted(dim_scores.items())):
                fig.add_trace(go.Box(
                    y=scores,
                    name=dim.replace("_", " ").title(),
                    marker_color=colors[i % len(colors)],
                ))

            fig.update_layout(
                title="Score Distribution by Dimension (Best Iterations)",
                yaxis_title="Score",
                yaxis_range=[0, 10],
                template="plotly_white",
            )

            path = os.path.join(VISUALIZATIONS_DIR, "dimension_distribution.html")
            fig.write_html(path)
            return path

        except ImportError:
            return None

    def cost_quality_scatter(self, results: list[AdResult]) -> str | None:
        """Scatter plot: quality vs cost per ad."""
        try:
            import plotly.graph_objects as go

            scores = [r.best_copy.evaluation.weighted_average for r in results]
            costs = [r.total_cost_usd for r in results]
            labels = [r.brief_id for r in results]

            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=costs, y=scores, mode="markers",
                text=labels,
                marker=dict(
                    size=10,
                    color=scores,
                    colorscale="Viridis",
                    showscale=True,
                    colorbar_title="Score",
                ),
            ))

            fig.add_hline(y=7.0, line_dash="dash", line_color="red")

            fig.update_layout(
                title="Cost vs Quality — Performance Per Dollar",
                xaxis_title="Total Cost (USD)",
                yaxis_title="Best Copy Score",
                yaxis_range=[0, 10],
                template="plotly_white",
            )

            path = os.path.join(VISUALIZATIONS_DIR, "cost_quality.html")
            fig.write_html(path)
            return path

        except ImportError:
            return None

    def iteration_heatmap(self, results: list[AdResult]) -> str | None:
        """Heatmap: per-dimension improvement from iteration 1 to best."""
        try:
            import plotly.graph_objects as go

            dimensions = list(results[0].copy_iterations[0].evaluation.scores.keys()) if results else []
            improvements: dict[str, list[float]] = {d: [] for d in dimensions}

            for r in results:
                if len(r.copy_iterations) < 2:
                    continue
                first = r.copy_iterations[0].evaluation.scores
                best = r.best_copy.evaluation.scores
                for dim in dimensions:
                    diff = best[dim].score - first[dim].score
                    improvements[dim].append(diff)

            if not any(improvements.values()):
                return None

            dim_names = [d.replace("_", " ").title() for d in dimensions]
            avg_improvements = [
                sum(improvements[d]) / max(len(improvements[d]), 1)
                for d in dimensions
            ]

            fig = go.Figure(go.Bar(
                x=dim_names,
                y=avg_improvements,
                marker_color=["#34A853" if v >= 0 else "#EA4335" for v in avg_improvements],
            ))

            fig.update_layout(
                title="Average Score Improvement per Dimension (Iteration 1 → Best)",
                yaxis_title="Score Change",
                template="plotly_white",
            )

            path = os.path.join(VISUALIZATIONS_DIR, "iteration_improvement.html")
            fig.write_html(path)
            return path

        except ImportError:
            return None

    def score_histogram(self, results: list[AdResult]) -> str | None:
        """Histogram: distribution of final best scores."""
        try:
            import plotly.graph_objects as go

            scores = [r.best_copy.evaluation.weighted_average for r in results]

            fig = go.Figure(go.Histogram(
                x=scores, nbinsx=20,
                marker_color="#1A73E8",
            ))

            fig.add_vline(x=7.0, line_dash="dash", line_color="red",
                         annotation_text="Threshold")

            fig.update_layout(
                title="Score Distribution — Best Copy Per Ad",
                xaxis_title="Weighted Average Score",
                yaxis_title="Count",
                template="plotly_white",
            )

            path = os.path.join(VISUALIZATIONS_DIR, "score_histogram.html")
            fig.write_html(path)
            return path

        except ImportError:
            return None

    def cost_breakdown(self, results: list[AdResult]) -> str | None:
        """Pie chart: cost breakdown by pipeline stage."""
        try:
            import plotly.graph_objects as go
            from src.tracking.cost_tracker import CostTracker

            tracker = CostTracker()
            by_stage = tracker.cost_by_stage()

            if not by_stage:
                return None

            fig = go.Figure(go.Pie(
                labels=list(by_stage.keys()),
                values=list(by_stage.values()),
                hole=0.3,
            ))

            fig.update_layout(
                title="Cost Breakdown by Pipeline Stage",
                template="plotly_white",
            )

            path = os.path.join(VISUALIZATIONS_DIR, "cost_breakdown.html")
            fig.write_html(path)
            return path

        except ImportError:
            return None

    def _fallback_quality_chart(self, results: list[AdResult]) -> str | None:
        """Matplotlib fallback for quality improvement chart."""
        try:
            import matplotlib.pyplot as plt

            iter_scores: dict[int, list[float]] = {}
            for r in results:
                for ci in r.copy_iterations:
                    n = ci.iteration_number
                    iter_scores.setdefault(n, []).append(ci.evaluation.weighted_average)

            iters = sorted(iter_scores.keys())
            avg_scores = [sum(iter_scores[i]) / len(iter_scores[i]) for i in iters]

            fig, ax = plt.subplots(figsize=(10, 6))
            ax.plot(iters, avg_scores, "o-", color="#1A73E8", linewidth=2, markersize=10)
            ax.axhline(y=7.0, color="red", linestyle="--", label="Threshold (7.0)")
            ax.set_xlabel("Iteration")
            ax.set_ylabel("Average Weighted Score")
            ax.set_title("Quality Improvement Across Iterations")
            ax.set_ylim(0, 10)
            ax.legend()
            ax.grid(True, alpha=0.3)

            path = os.path.join(VISUALIZATIONS_DIR, "quality_improvement.png")
            fig.savefig(path, dpi=150, bbox_inches="tight")
            plt.close()
            return path

        except ImportError:
            return None
