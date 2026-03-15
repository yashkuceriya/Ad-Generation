"""Selects the best iteration from history — may not be the last one."""

from __future__ import annotations

from src.models import CopyIteration, ImageIteration


class BestSelector:
    """Picks the best version across all iterations based on scores."""

    @staticmethod
    def select_best_copy(iterations: list[CopyIteration]) -> int:
        """Returns the index of the best copy iteration.

        Selection criteria:
        1. Highest weighted average score
        2. Tiebreaker: highest average confidence across dimensions
        """
        if not iterations:
            return 0

        best_idx = 0
        best_score = -1.0
        best_confidence = -1.0

        for idx, it in enumerate(iterations):
            score = it.evaluation.weighted_average
            avg_confidence = sum(
                ds.confidence for ds in it.evaluation.scores.values()
            ) / max(len(it.evaluation.scores), 1)

            if score > best_score or (score == best_score and avg_confidence > best_confidence):
                best_idx = idx
                best_score = score
                best_confidence = avg_confidence

        return best_idx

    @staticmethod
    def select_best_image(iterations: list[ImageIteration]) -> int:
        """Returns the index of the best image iteration.

        Selection criteria: highest average score across 3 image dimensions.
        """
        if not iterations:
            return 0

        best_idx = 0
        best_score = -1.0

        for idx, it in enumerate(iterations):
            if it.evaluation.average_score > best_score:
                best_idx = idx
                best_score = it.evaluation.average_score

        return best_idx
