"""Core feedback loop: generate → evaluate → refine → repeat.

Supports early-stopping when quality thresholds are met:
- EARLY_STOP_THRESHOLD (9.0): Exceptional quality, no further iteration needed.
- QUALITY_THRESHOLD (7.0): Good enough — stop if already passing to save API calls.
"""

from __future__ import annotations

from typing import Callable

from src.models import AdBrief, AdCopy, CopyIteration, EvaluationResult
from src.generate.copy_generator import CopyGenerator
from src.evaluate.copy_evaluator import CopyEvaluator
from src.tracking.cost_tracker import PipelineMetrics
from config.settings import (
    MAX_COPY_ITERATIONS,
    QUALITY_THRESHOLD,
    EARLY_STOP_THRESHOLD,
)


class CopyIterator:
    """Runs the copy generation feedback loop with full history preservation."""

    def __init__(self):
        self.generator = CopyGenerator()
        self.evaluator = CopyEvaluator()

    def iterate(
        self,
        brief: AdBrief,
        max_iterations: int = MAX_COPY_ITERATIONS,
        on_iteration: Callable[[CopyIteration], None] | None = None,
        iterations: list[CopyIteration] | None = None,
    ) -> tuple[list[CopyIteration], bool, str | None]:
        """Run up to max_iterations of generate→evaluate→refine.

        Returns (iterations, early_stopped, early_stop_reason).
        Pass `iterations` to use an external list (for live progress updates).
        """
        if iterations is None:
            iterations = []
        feedback: str | None = None
        previous_copy: AdCopy | None = None
        early_stopped = False
        early_stop_reason: str | None = None

        for i in range(1, max_iterations + 1):
            print(f"  [Copy] Iteration {i}/{max_iterations}...")

            # Generate
            ad_copy, gen_costs = self.generator.generate(
                brief=brief,
                iteration=i,
                feedback=feedback,
                previous_copy=previous_copy,
            )

            # Evaluate
            evaluation, eval_costs = self.evaluator.evaluate(
                ad_copy=ad_copy,
                brief=brief,
                iteration=i,
            )

            all_costs = gen_costs + eval_costs

            iteration = CopyIteration(
                iteration_number=i,
                ad_copy=ad_copy,
                evaluation=evaluation,
                refinement_feedback=None,
                costs=all_costs,
            )

            score = evaluation.weighted_average
            print(f"    Score: {score}/10 "
                  f"(weakest: {evaluation.weakest_dimension} @ "
                  f"{evaluation.scores[evaluation.weakest_dimension].score})")

            iterations.append(iteration)

            if on_iteration:
                on_iteration(iteration)

            # Early-stop: exceptional quality — no point iterating further
            if score >= EARLY_STOP_THRESHOLD:
                early_stopped = True
                early_stop_reason = f"Exceptional quality ({score:.1f} >= {EARLY_STOP_THRESHOLD})"
                print(f"    [Early Stop] {early_stop_reason}")
                break

            # Early-stop: already passing threshold after iteration 2+
            # (always run at least 2 iterations to give refinement a chance)
            if i >= 2 and score >= QUALITY_THRESHOLD:
                early_stopped = True
                early_stop_reason = f"Quality threshold met ({score:.1f} >= {QUALITY_THRESHOLD})"
                print(f"    [Early Stop] {early_stop_reason}")
                break

            # Build refinement feedback for next iteration (if not last)
            if i < max_iterations:
                feedback = self.generator.build_refinement_prompt(
                    previous_copy=ad_copy,
                    evaluation=evaluation,
                )
                iteration.refinement_feedback = feedback
                previous_copy = ad_copy

        # Record pipeline metrics
        metrics = PipelineMetrics()
        metrics.record_iteration_count(len(iterations))
        if early_stopped and early_stop_reason:
            metrics.record_early_stop(early_stop_reason)
        else:
            metrics.record_full_iterations()

        return iterations, early_stopped, early_stop_reason
