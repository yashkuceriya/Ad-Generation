"""Extract reusable insights from completed ad results."""

from __future__ import annotations

from collections import defaultdict

from src.models import AdResult


def extract_insights(results: list[AdResult]) -> list[dict]:
    """Analyze completed ad results and extract reusable insights.

    Insight types:
    - winning_pattern: Best-scoring ad patterns per audience+goal
    - weak_dimension: Dimensions that consistently score below 7.0
    - refinement_tip: What refinement feedback improved scores
    - top_performer: Best headline/primary_text combo per audience
    """
    if not results:
        return []

    insights: list[dict] = []

    # Group results by audience+goal
    by_segment: dict[tuple[str, str], list[AdResult]] = defaultdict(list)
    for r in results:
        if not r.copy_iterations:
            continue
        audience = r.brief.audience_segment.value
        goal = r.brief.campaign_goal.value
        by_segment[(audience, goal)].append(r)

    # 1. winning_pattern — best-scoring ad per audience+goal
    for (audience, goal), segment_results in by_segment.items():
        best_result = max(
            segment_results,
            key=lambda r: r.copy_iterations[r.best_copy_index].evaluation.weighted_average,
        )
        best_copy = best_result.copy_iterations[best_result.best_copy_index]
        best_ad = best_copy.ad_copy
        score = best_copy.evaluation.weighted_average

        # Determine headline pattern (first few words as a hint)
        headline_words = best_ad.headline.split()
        pattern_hint = " ".join(headline_words[:3]) + "..." if len(headline_words) > 3 else best_ad.headline

        insights.append({
            "audience_segment": audience,
            "campaign_goal": goal,
            "dimension": "",
            "insight_type": "winning_pattern",
            "insight_text": (
                f"For {audience} + {goal}, headlines using '{pattern_hint}' "
                f"pattern scored {score}/10"
            ),
            "evidence": {
                "headline": best_ad.headline,
                "cta_button": best_ad.cta_button,
                "score": score,
                "brief_id": best_result.brief_id,
            },
            "avg_score_impact": score,
        })

    # 2. weak_dimension — dimensions consistently scoring below 7.0
    dimension_scores: dict[str, list[float]] = defaultdict(list)
    for r in results:
        if not r.copy_iterations:
            continue
        best_copy = r.copy_iterations[r.best_copy_index]
        for dim_name, dim_score in best_copy.evaluation.scores.items():
            dimension_scores[dim_name].append(dim_score.score)

    for dim_name, scores in dimension_scores.items():
        avg = sum(scores) / len(scores)
        if avg < 7.0:
            insights.append({
                "audience_segment": "",
                "campaign_goal": "",
                "dimension": dim_name,
                "insight_type": "weak_dimension",
                "insight_text": (
                    f"The '{dim_name}' dimension averages {avg:.1f}/10 "
                    f"— focus on improvement"
                ),
                "evidence": {
                    "avg_score": round(avg, 2),
                    "sample_count": len(scores),
                    "min_score": min(scores),
                    "max_score": max(scores),
                },
                "avg_score_impact": round(avg, 2),
            })

    # 3. refinement_tip — note what refinement feedback improved scores
    for r in results:
        if len(r.copy_iterations) < 2:
            continue
        audience = r.brief.audience_segment.value
        goal = r.brief.campaign_goal.value

        for i in range(1, len(r.copy_iterations)):
            prev = r.copy_iterations[i - 1]
            curr = r.copy_iterations[i]
            delta = curr.evaluation.weighted_average - prev.evaluation.weighted_average
            feedback = curr.refinement_feedback

            if delta > 0 and feedback:
                # Truncate long feedback for the insight text
                short_feedback = feedback[:100] + "..." if len(feedback) > 100 else feedback
                insights.append({
                    "audience_segment": audience,
                    "campaign_goal": goal,
                    "dimension": "",
                    "insight_type": "refinement_tip",
                    "insight_text": (
                        f"Refinement '{short_feedback}' improved scores by "
                        f"+{delta:.1f}"
                    ),
                    "evidence": {
                        "feedback": feedback[:500],
                        "delta": round(delta, 2),
                        "from_score": prev.evaluation.weighted_average,
                        "to_score": curr.evaluation.weighted_average,
                        "brief_id": r.brief_id,
                    },
                    "avg_score_impact": round(delta, 2),
                })

    # 4. top_performer — best headline/primary_text combo per audience
    by_audience: dict[str, list[AdResult]] = defaultdict(list)
    for r in results:
        if not r.copy_iterations:
            continue
        by_audience[r.brief.audience_segment.value].append(r)

    for audience, audience_results in by_audience.items():
        best_result = max(
            audience_results,
            key=lambda r: r.copy_iterations[r.best_copy_index].evaluation.weighted_average,
        )
        best_copy = best_result.copy_iterations[best_result.best_copy_index]
        best_ad = best_copy.ad_copy
        score = best_copy.evaluation.weighted_average

        insights.append({
            "audience_segment": audience,
            "campaign_goal": best_result.brief.campaign_goal.value,
            "dimension": "",
            "insight_type": "top_performer",
            "insight_text": (
                f"Top performer for {audience}: headline '{best_ad.headline}' "
                f"with score {score}/10"
            ),
            "evidence": {
                "headline": best_ad.headline,
                "primary_text": best_ad.primary_text[:200],
                "cta_button": best_ad.cta_button,
                "score": score,
                "brief_id": best_result.brief_id,
            },
            "avg_score_impact": score,
        })

    return insights
