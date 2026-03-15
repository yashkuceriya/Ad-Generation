"""Output formatting and export for ad results."""

from __future__ import annotations

import csv
import json
import os

from src.models import AdResult
from config.settings import OUTPUT_DIR, REPORTS_DIR


class AdFormatter:
    """Formats and exports ad generation results."""

    def __init__(self):
        os.makedirs(REPORTS_DIR, exist_ok=True)

    def export_ad_library(self, results: list[AdResult], filename: str = "ad_library.json") -> str:
        """Export full ad library with all iterations as JSON."""
        path = os.path.join(REPORTS_DIR, filename)
        data = [r.model_dump() for r in results]
        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)
        return path

    def export_best_ads_csv(self, results: list[AdResult], filename: str = "best_ads.csv") -> str:
        """Export flat CSV with one row per ad (best version only)."""
        path = os.path.join(REPORTS_DIR, filename)

        with open(path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "brief_id", "audience", "campaign_goal", "product_offer", "tone",
                "primary_text", "headline", "description", "cta_button",
                "weighted_score", "clarity", "value_prop", "cta_strength",
                "brand_voice", "emotional_resonance",
                "iterations_used", "best_iteration", "total_cost_usd",
                "quality_per_dollar", "image_path", "image_score",
            ])

            for r in results:
                best = r.best_copy
                scores = best.evaluation.scores

                image_path = ""
                image_score = ""
                if r.best_image:
                    image_path = r.best_image.image_path
                    image_score = str(r.best_image.evaluation.average_score)

                writer.writerow([
                    r.brief_id,
                    r.brief.audience_segment.value,
                    r.brief.campaign_goal.value,
                    r.brief.product_offer,
                    r.brief.tone,
                    best.ad_copy.primary_text,
                    best.ad_copy.headline,
                    best.ad_copy.description,
                    best.ad_copy.cta_button,
                    best.evaluation.weighted_average,
                    scores.get("clarity", {}).score if "clarity" in scores else "",
                    scores.get("value_proposition", {}).score if "value_proposition" in scores else "",
                    scores.get("cta_strength", {}).score if "cta_strength" in scores else "",
                    scores.get("brand_voice", {}).score if "brand_voice" in scores else "",
                    scores.get("emotional_resonance", {}).score if "emotional_resonance" in scores else "",
                    len(r.copy_iterations),
                    r.best_copy_index + 1,
                    r.total_cost_usd,
                    r.quality_per_dollar,
                    image_path,
                    image_score,
                ])

        return path

    def export_iteration_history(self, results: list[AdResult], filename: str = "iteration_history.json") -> str:
        """Export detailed iteration history for every ad."""
        path = os.path.join(REPORTS_DIR, filename)

        history = []
        for r in results:
            ad_history = {
                "brief_id": r.brief_id,
                "audience": r.brief.audience_segment.value,
                "campaign_goal": r.brief.campaign_goal.value,
                "best_copy_iteration": r.best_copy_index + 1,
                "best_image_iteration": r.best_image_index + 1 if r.image_iterations else None,
                "copy_iterations": [],
                "image_iterations": [],
            }

            for ci in r.copy_iterations:
                ad_history["copy_iterations"].append({
                    "iteration": ci.iteration_number,
                    "ad_copy": ci.ad_copy.model_dump(),
                    "weighted_score": ci.evaluation.weighted_average,
                    "dimension_scores": {
                        dim: {"score": ds.score, "rationale": ds.rationale}
                        for dim, ds in ci.evaluation.scores.items()
                    },
                    "weakest_dimension": ci.evaluation.weakest_dimension,
                    "refinement_feedback": ci.refinement_feedback,
                    "cost": ci.total_cost,
                })

            for ii in r.image_iterations:
                ad_history["image_iterations"].append({
                    "iteration": ii.iteration_number,
                    "image_path": ii.image_path,
                    "prompt": ii.image_prompt,
                    "scores": {
                        "brand_consistency": ii.evaluation.brand_consistency,
                        "engagement_potential": ii.evaluation.engagement_potential,
                        "text_image_alignment": ii.evaluation.text_image_alignment,
                        "average": ii.evaluation.average_score,
                    },
                    "rationale": ii.evaluation.rationale,
                    "refinement_feedback": ii.refinement_feedback,
                    "cost": ii.total_cost,
                })

            history.append(ad_history)

        with open(path, "w") as f:
            json.dump(history, f, indent=2, default=str)

        return path

    def generate_markdown_report(self, results: list[AdResult], filename: str = "report.md") -> str:
        """Generate a markdown summary report."""
        path = os.path.join(REPORTS_DIR, filename)

        scores = [r.best_copy.evaluation.weighted_average for r in results]
        passing = [s for s in scores if s >= 7.0]
        costs = [r.total_cost_usd for r in results]

        from src.tracking.cost_tracker import CostTracker
        tracker = CostTracker()

        lines = [
            "# Autonomous Ad Generation — Results Report\n",
            f"**Total ads generated:** {len(results)}",
            f"**Pass rate (>=7.0):** {len(passing)}/{len(results)} ({100*len(passing)/max(len(results),1):.0f}%)",
            f"**Average score:** {sum(scores)/max(len(scores),1):.2f}",
            f"**Best score:** {max(scores):.2f}" if scores else "",
            f"**Worst score:** {min(scores):.2f}" if scores else "",
            f"**Total cost:** ${sum(costs):.4f}",
            f"**Avg cost per ad:** ${sum(costs)/max(len(costs),1):.6f}",
            "",
            "## Cost Breakdown\n",
            f"By model: {json.dumps(tracker.cost_by_model(), indent=2)}",
            f"By stage: {json.dumps(tracker.cost_by_stage(), indent=2)}",
            "",
            "## Top 5 Ads\n",
        ]

        sorted_results = sorted(results, key=lambda r: r.best_copy.evaluation.weighted_average, reverse=True)
        for r in sorted_results[:5]:
            best = r.best_copy
            lines.extend([
                f"### {r.brief_id} — Score: {best.evaluation.weighted_average}/10\n",
                f"**Audience:** {r.brief.audience_segment.value} | **Goal:** {r.brief.campaign_goal.value}",
                f"**Primary Text:** {best.ad_copy.primary_text}",
                f"**Headline:** {best.ad_copy.headline}",
                f"**Description:** {best.ad_copy.description}",
                f"**CTA:** {best.ad_copy.cta_button}",
                f"**Iterations used:** {len(r.copy_iterations)} | **Best iteration:** {r.best_copy_index + 1}",
                "",
            ])

        lines.extend([
            "## Iteration Effectiveness\n",
        ])

        improved = 0
        regressed = 0
        for r in results:
            if len(r.copy_iterations) > 1:
                first = r.copy_iterations[0].evaluation.weighted_average
                best = r.best_copy.evaluation.weighted_average
                if best > first:
                    improved += 1
                elif best < first:
                    regressed += 1

        multi = [r for r in results if len(r.copy_iterations) > 1]
        lines.append(f"Ads with multiple iterations: {len(multi)}")
        lines.append(f"Improved: {improved} | Regressed: {regressed} | Same: {len(multi) - improved - regressed}")

        with open(path, "w") as f:
            f.write("\n".join(lines))

        return path
