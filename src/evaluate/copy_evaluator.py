"""Orchestrates 5-dimension ad copy evaluation.

Uses batched scoring (single LLM call for all 5 dimensions) for speed.
Falls back to sequential per-dimension scoring if batched call fails.
"""

from __future__ import annotations

import logging

from src.models import AdBrief, AdCopy, EvaluationResult, StepCost
from src.evaluate.batched_scorer import BatchedScorer
from src.evaluate.dimension_scorer import DimensionScorer
from src.tracking.cost_tracker import PipelineMetrics
from config.evaluation_rubrics import DIMENSION_WEIGHTS, DIMENSION_RUBRICS

logger = logging.getLogger(__name__)


class CopyEvaluator:
    """Evaluates ad copy across all 5 quality dimensions."""

    def __init__(self):
        self.batched_scorer = BatchedScorer()
        self._fallback_scorer = None  # Lazy-init only if needed

    @property
    def fallback_scorer(self) -> DimensionScorer:
        if self._fallback_scorer is None:
            self._fallback_scorer = DimensionScorer()
        return self._fallback_scorer

    def evaluate(
        self,
        ad_copy: AdCopy,
        brief: AdBrief,
        iteration: int = 1,
    ) -> tuple[EvaluationResult, list[StepCost]]:
        """Evaluate ad copy on all dimensions. Returns (evaluation, costs)."""
        metrics = PipelineMetrics()
        try:
            result = self._evaluate_batched(ad_copy, brief, iteration)
            metrics.record_eval_batched(True)
            return result
        except Exception as e:
            logger.warning("Batched eval failed (%s), falling back to sequential", e)
            metrics.record_eval_batched(False)
            return self._evaluate_sequential(ad_copy, brief, iteration)

    def _evaluate_batched(
        self,
        ad_copy: AdCopy,
        brief: AdBrief,
        iteration: int,
    ) -> tuple[EvaluationResult, list[StepCost]]:
        """Single LLM call for all 5 dimensions."""
        scores, cost = self.batched_scorer.score_all(
            ad_copy=ad_copy,
            brief=brief,
            iteration=iteration,
        )

        evaluation = EvaluationResult.from_dimension_scores(
            dimension_scores=scores,
            weights=DIMENSION_WEIGHTS,
        )

        return evaluation, [cost]

    def _evaluate_sequential(
        self,
        ad_copy: AdCopy,
        brief: AdBrief,
        iteration: int,
    ) -> tuple[EvaluationResult, list[StepCost]]:
        """Fallback: one LLM call per dimension (5 total)."""
        all_scores = []
        all_costs = []

        for dimension in DIMENSION_RUBRICS:
            dim_score, cost = self.fallback_scorer.score(
                ad_copy=ad_copy,
                brief=brief,
                dimension=dimension,
                iteration=iteration,
            )
            all_scores.append(dim_score)
            all_costs.append(cost)

        evaluation = EvaluationResult.from_dimension_scores(
            dimension_scores=all_scores,
            weights=DIMENSION_WEIGHTS,
        )

        return evaluation, all_costs
