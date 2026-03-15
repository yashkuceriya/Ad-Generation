"""Image generation feedback loop: generate → evaluate → refine (max 3x), select best."""

from __future__ import annotations

from typing import Callable

from src.models import AdBrief, AdCopy, ImageIteration, ImageEvaluationResult
from src.generate.image_generator import ImageGenerator
from src.evaluate.image_evaluator import ImageEvaluator
from config.settings import MAX_IMAGE_ITERATIONS


class ImageIterator:
    """Runs image generation loop with full history and best-selection."""

    def __init__(self):
        self.generator = ImageGenerator()
        self.evaluator = ImageEvaluator()

    def iterate(
        self,
        ad_copy: AdCopy,
        brief: AdBrief,
        max_iterations: int = MAX_IMAGE_ITERATIONS,
        on_iteration: Callable[[ImageIteration], None] | None = None,
        iterations: list[ImageIteration] | None = None,
    ) -> list[ImageIteration]:
        """Run up to max_iterations of image generate→evaluate→refine.

        Returns ALL iterations. Caller picks the best via best_selector.
        Hard-capped at 3 iterations.
        Pass `iterations` to use an external list (for live progress updates).
        """
        max_iterations = min(max_iterations, 3)  # Hard cap at 3
        if iterations is None:
            iterations = []
        feedback: str | None = None
        suggestions: list[str] | None = None
        prev_scores: dict | None = None

        for i in range(1, max_iterations + 1):
            print(f"  [Image] Iteration {i}/{max_iterations}...")

            # Generate image
            image_path, prompt_used, gen_cost = self.generator.generate(
                ad_copy=ad_copy,
                brief=brief,
                iteration=i,
                max_iterations=max_iterations,
                feedback=feedback,
                suggestions=suggestions,
                prev_scores=prev_scores,
            )

            # Evaluate image
            evaluation, eval_cost = self.evaluator.evaluate(
                image_path=image_path,
                ad_copy=ad_copy,
                iteration=i,
                brief_id=brief.brief_id,
            )

            iteration = ImageIteration(
                iteration_number=i,
                image_path=image_path,
                image_prompt=prompt_used,
                evaluation=evaluation,
                refinement_feedback=None,
                costs=[gen_cost, eval_cost],
            )

            print(f"    Image score: {evaluation.average_score}/10 "
                  f"(brand: {evaluation.brand_consistency}, "
                  f"engage: {evaluation.engagement_potential}, "
                  f"align: {evaluation.text_image_alignment})")

            # Build feedback for next iteration with full score context
            if i < max_iterations:
                feedback = evaluation.rationale
                suggestions = evaluation.suggestions
                prev_scores = {
                    "brand_consistency": evaluation.brand_consistency,
                    "engagement_potential": evaluation.engagement_potential,
                    "text_image_alignment": evaluation.text_image_alignment,
                    "average_score": evaluation.average_score,
                }
                iteration.refinement_feedback = feedback

            iterations.append(iteration)

            if on_iteration:
                on_iteration(iteration)

        return iterations
