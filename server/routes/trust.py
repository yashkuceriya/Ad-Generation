"""Evaluator trust center — surfaces reliability and calibration signals."""

from __future__ import annotations
from fastapi import APIRouter, Query
from server.state import RunStore

router = APIRouter()


@router.get("")
def get_trust_signals(client_id: str | None = Query(None)):
    """Return evaluator trust signals for the trust center UI."""
    store = RunStore()
    results = store.get_all_results()

    # Filter by client_id if provided — but fall back to all results if filter yields nothing
    # (legacy ads don't have client_id in their data blob)
    if client_id and results:
        from server.database import get_session, AdResultRow
        session = get_session()
        if session:
            try:
                rows = session.query(AdResultRow.brief_id, AdResultRow.data).all()
                client_brief_ids = set()
                for row in rows:
                    data = row.data if isinstance(row.data, dict) else {}
                    if data.get("client_id", "") == client_id:
                        client_brief_ids.add(row.brief_id)
                if client_brief_ids:  # only filter if we found matching ads
                    results = [r for r in results if r.brief_id in client_brief_ids]
            except Exception:
                pass
            finally:
                session.close()

    if not results:
        return {"status": "no_data", "signals": {}}

    # Only consider results with completed iterations
    completed = [r for r in results if r.copy_iterations]
    if not completed:
        return {"status": "no_data", "signals": {}}

    # 1. Score distribution analysis
    scores = [r.best_copy.evaluation.weighted_average for r in completed]
    avg_score = sum(scores) / len(scores)
    score_std = (sum((s - avg_score) ** 2 for s in scores) / len(scores)) ** 0.5

    # 2. Evaluator confidence analysis
    all_confidences = []
    for r in completed:
        for dim_score in r.best_copy.evaluation.scores.values():
            all_confidences.append(dim_score.confidence)
    avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0
    low_confidence_count = sum(1 for c in all_confidences if c < 0.6)

    # 3. Compliance pass rate
    compliance_checked = [r for r in completed if r.compliance is not None]
    compliance_pass_rate = (
        sum(1 for r in compliance_checked if r.compliance.passes) / len(compliance_checked)
        if compliance_checked else None
    )

    # 4. Score consistency (are re-evaluations stable?)
    iteration_score_variance = []
    for r in completed:
        if len(r.copy_iterations) > 1:
            iter_scores = [ci.evaluation.weighted_average for ci in r.copy_iterations]
            iter_range = max(iter_scores) - min(iter_scores)
            iteration_score_variance.append(iter_range)
    avg_score_range = sum(iteration_score_variance) / len(iteration_score_variance) if iteration_score_variance else 0

    # 5. Dimension agreement (do dimensions agree with each other?)
    dimension_averages = {}
    for r in completed:
        for dim, ds in r.best_copy.evaluation.scores.items():
            dimension_averages.setdefault(dim, []).append(ds.score)
    dim_avgs = {d: round(sum(s) / len(s), 2) for d, s in dimension_averages.items()}
    dim_spread = max(dim_avgs.values()) - min(dim_avgs.values()) if dim_avgs else 0

    # 6. Readiness pipeline status counts
    status_counts = {}
    for r in completed:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1

    # 7. Escalation signals (ads that might need human review)
    needs_review = []
    for r in completed:
        reasons = []
        best = r.best_copy
        # Low confidence on any dimension
        for dim, ds in best.evaluation.scores.items():
            if ds.confidence < 0.5:
                reasons.append(f"Low confidence on {dim}: {ds.confidence:.2f}")
        # Borderline score (within 0.5 of threshold)
        if 6.5 <= best.evaluation.weighted_average < 7.5:
            reasons.append(f"Borderline score: {best.evaluation.weighted_average}")
        # Big iteration variance
        if len(r.copy_iterations) > 1:
            scores_list = [ci.evaluation.weighted_average for ci in r.copy_iterations]
            if max(scores_list) - min(scores_list) > 2.0:
                reasons.append(f"High iteration variance: {max(scores_list) - min(scores_list):.1f}")
        # Compliance warnings
        if r.compliance and not r.compliance.passes:
            reasons.append(f"Compliance failure: {len(r.compliance.errors)} errors")

        if reasons:
            needs_review.append({
                "brief_id": r.brief_id,
                "score": best.evaluation.weighted_average,
                "status": r.status,
                "reasons": reasons,
            })

    return {
        "status": "ok",
        "total_ads": len(completed),
        "signals": {
            "score_distribution": {
                "mean": round(avg_score, 2),
                "std_dev": round(score_std, 2),
                "min": round(min(scores), 2),
                "max": round(max(scores), 2),
            },
            "evaluator_confidence": {
                "average": round(avg_confidence, 3),
                "low_confidence_count": low_confidence_count,
                "total_evaluations": len(all_confidences),
            },
            "compliance": {
                "checked": len(compliance_checked),
                "pass_rate": round(compliance_pass_rate, 3) if compliance_pass_rate is not None else None,
            },
            "score_consistency": {
                "avg_iteration_range": round(avg_score_range, 2),
                "multi_iteration_ads": len(iteration_score_variance),
            },
            "dimension_agreement": {
                "dimension_averages": dim_avgs,
                "dimension_spread": round(dim_spread, 2),
            },
            "readiness_status": status_counts,
        },
        "needs_review": needs_review[:20],
    }
