"""Main pipeline orchestrator: ties copy + image loops together."""

from __future__ import annotations

import json
import os
import time

from src.models import AdBrief, AdResult
from src.iterate.copy_iterator import CopyIterator
from src.iterate.image_iterator import ImageIterator
from src.iterate.best_selector import BestSelector
from src.evaluate.compliance_checker import ComplianceChecker
from src.tracking.cost_tracker import CostTracker
from config.settings import OUTPUT_DIR


class AdPipeline:
    """Orchestrates the full ad generation pipeline for a single brief or batch.

    Image generation modes:
    - "eager": Generate images during pipeline run (for demo/single mode)
    - "lazy": Skip images during batch, generate on-demand later via generate_image_for_result()
    """

    def __init__(self, image_mode: str = "lazy"):
        self.copy_iterator = CopyIterator()
        self.image_iterator = ImageIterator()
        self.selector = BestSelector()
        self.compliance_checker = ComplianceChecker()
        self.tracker = CostTracker()
        self.image_mode = image_mode  # "eager" or "lazy"

    def run_single(self, brief: AdBrief, generate_images: bool | None = None) -> AdResult:
        """Run full pipeline for a single brief.

        Args:
            generate_images: Override image_mode for this call. None uses self.image_mode.
        """
        should_gen_images = generate_images if generate_images is not None else (self.image_mode == "eager")

        print(f"\n{'='*60}")
        print(f"Processing brief: {brief.brief_id}")
        print(f"  Audience: {brief.audience_segment.value} | Goal: {brief.campaign_goal.value}")
        print(f"  Offer: {brief.product_offer} | Tone: {brief.tone}")
        print(f"{'='*60}")

        # Phase 1: Copy generation loop (up to 3 iterations, with early-stopping)
        copy_iterations, early_stopped, stop_reason = self.copy_iterator.iterate(brief)
        best_copy_idx = self.selector.select_best_copy(copy_iterations)

        print(f"\n  Best copy: iteration {best_copy_idx + 1} "
              f"(score: {copy_iterations[best_copy_idx].evaluation.weighted_average}/10)"
              f"{f' [Early stopped: {stop_reason}]' if early_stopped else ''}")

        # Phase 1.5: Compliance check (rule-based, instant, zero cost)
        best_copy_obj = copy_iterations[best_copy_idx].ad_copy
        compliance_result = self.compliance_checker.check(best_copy_obj)
        if compliance_result.passes:
            print(f"  Compliance: PASS (score: {compliance_result.score}/10, "
                  f"{len(compliance_result.warnings)} warnings)")
        else:
            print(f"  Compliance: FAIL ({len(compliance_result.errors)} errors, "
                  f"{len(compliance_result.warnings)} warnings)")

        # Phase 2: Image generation (eager or skip for lazy)
        image_iterations = []
        best_image_idx = 0

        if should_gen_images:
            best_copy = copy_iterations[best_copy_idx].ad_copy
            image_iterations = self.image_iterator.iterate(
                ad_copy=best_copy,
                brief=brief,
            )
            best_image_idx = self.selector.select_best_image(image_iterations)

            if image_iterations:
                print(f"  Best image: iteration {best_image_idx + 1} "
                      f"(score: {image_iterations[best_image_idx].evaluation.average_score}/10)")
        else:
            print(f"  Images: deferred (on-demand)")

        # Convert compliance dataclass to Pydantic model for serialization
        from src.models import ComplianceResult as ComplianceResultModel
        from src.models import ComplianceViolation as ComplianceViolationModel
        compliance_model = ComplianceResultModel(
            passes=compliance_result.passes,
            violations=[
                ComplianceViolationModel(
                    severity=v.severity, field=v.field, rule=v.rule,
                    message=v.message, suggestion=v.suggestion,
                )
                for v in compliance_result.violations
            ],
            score=compliance_result.score,
        )

        # Build result with FULL history
        result = AdResult(
            brief_id=brief.brief_id,
            brief=brief,
            copy_iterations=copy_iterations,
            image_iterations=image_iterations,
            best_copy_index=best_copy_idx,
            best_image_index=best_image_idx,
            early_stopped=early_stopped,
            early_stop_reason=stop_reason,
            compliance=compliance_model,
        )
        result.compute_totals()

        print(f"\n  Status: {result.status} | Total cost: ${result.total_cost_usd:.6f}")
        print(f"  Quality/dollar: {result.quality_per_dollar:.2f}")

        return result

    def generate_image_for_result(self, result: AdResult) -> AdResult:
        """On-demand image generation for a completed text-only result.

        Called when user clicks/selects an ad to preview with image.
        Runs full 3-iteration image loop and selects best.
        """
        if result.image_iterations:
            print(f"  Images already generated for {result.brief_id}")
            return result

        best_copy = result.best_copy.ad_copy
        print(f"\n  Generating images for {result.brief_id}...")

        image_iterations = self.image_iterator.iterate(
            ad_copy=best_copy,
            brief=result.brief,
        )
        best_image_idx = self.selector.select_best_image(image_iterations)

        result.image_iterations = image_iterations
        result.best_image_index = best_image_idx
        result.compute_totals()

        if image_iterations:
            print(f"  Best image: iteration {best_image_idx + 1} "
                  f"(score: {image_iterations[best_image_idx].evaluation.average_score}/10)")

        return result

    def run_batch(
        self,
        briefs: list[AdBrief],
        save_incremental: bool = True,
    ) -> list[AdResult]:
        """Run pipeline for a batch of briefs.

        Images are deferred by default (lazy mode). Use generate_image_for_result()
        to generate images for individual ads on demand.
        """
        results: list[AdResult] = []
        total = len(briefs)
        start_time = time.time()

        print(f"\nStarting batch of {total} briefs...")
        print(f"Image mode: {self.image_mode}")

        for i, brief in enumerate(briefs):
            try:
                result = self.run_single(brief)
                results.append(result)

                # Incremental save every 5 briefs
                if save_incremental and (i + 1) % 5 == 0:
                    self._save_checkpoint(results, i + 1)

                elapsed = time.time() - start_time
                avg_per_brief = elapsed / (i + 1)
                remaining = avg_per_brief * (total - i - 1)
                print(f"\n  Progress: {i+1}/{total} | "
                      f"Elapsed: {elapsed:.0f}s | "
                      f"ETA: {remaining:.0f}s")

            except Exception as e:
                print(f"\n  ERROR on brief {brief.brief_id}: {e}")
                # Save what we have so far
                if save_incremental:
                    self._save_checkpoint(results, i + 1)
                continue

        # Final save
        self._save_results(results)

        # Print summary
        self._print_summary(results, time.time() - start_time)

        return results

    def _save_checkpoint(self, results: list[AdResult], count: int) -> None:
        path = os.path.join(OUTPUT_DIR, "reports", f"checkpoint_{count}.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(
                [r.model_dump() for r in results],
                f,
                indent=2,
                default=str,
            )
        print(f"  Checkpoint saved: {path}")

    def _save_results(self, results: list[AdResult]) -> None:
        path = os.path.join(OUTPUT_DIR, "reports", "final_results.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(
                [r.model_dump() for r in results],
                f,
                indent=2,
                default=str,
            )

        # Save cost summary
        cost_path = os.path.join(OUTPUT_DIR, "reports", "cost_summary.json")
        with open(cost_path, "w") as f:
            json.dump(self.tracker.summary(), f, indent=2)

        # Save full cost ledger
        ledger_path = os.path.join(OUTPUT_DIR, "reports", "cost_ledger.json")
        with open(ledger_path, "w") as f:
            json.dump(self.tracker.export_json(), f, indent=2, default=str)

        print(f"\n  Results saved to {OUTPUT_DIR}/reports/")

    def _print_summary(self, results: list[AdResult], elapsed: float) -> None:
        if not results:
            print("\nNo results to summarize.")
            return

        scores = [r.best_copy.evaluation.weighted_average for r in results]
        passing = [s for s in scores if s >= 7.0]

        print(f"\n{'='*60}")
        print("BATCH SUMMARY")
        print(f"{'='*60}")
        print(f"  Total ads: {len(results)}")
        print(f"  Pass rate (>=7.0): {len(passing)}/{len(results)} ({100*len(passing)/len(results):.0f}%)")
        print(f"  Avg score: {sum(scores)/len(scores):.2f}")
        print(f"  Best score: {max(scores):.2f}")
        print(f"  Worst score: {min(scores):.2f}")
        print(f"  Total cost: ${self.tracker.total_cost:.4f}")
        print(f"  Total time: {elapsed:.0f}s")
        print(f"  Cost by model: {self.tracker.cost_by_model()}")
        print(f"  Cost by stage: {self.tracker.cost_by_stage()}")

        # Image cost note
        ads_with_images = [r for r in results if r.image_iterations]
        ads_without = len(results) - len(ads_with_images)
        if ads_without > 0:
            print(f"\n  Images: {len(ads_with_images)} generated, {ads_without} deferred (on-demand)")
            from config.settings import IMAGE_COST_PER_IMAGE, MAX_IMAGE_ITERATIONS
            print(f"  Estimated image cost if all generated: ~${ads_without * IMAGE_COST_PER_IMAGE * MAX_IMAGE_ITERATIONS:.2f}")

        # Show iteration effectiveness
        improved_count = 0
        for r in results:
            if len(r.copy_iterations) > 1:
                first_score = r.copy_iterations[0].evaluation.weighted_average
                best_score = r.best_copy.evaluation.weighted_average
                if best_score > first_score:
                    improved_count += 1

        multi_iter = [r for r in results if len(r.copy_iterations) > 1]
        if multi_iter:
            print(f"\n  Iteration effectiveness:")
            print(f"    Ads with >1 iteration: {len(multi_iter)}")
            print(f"    Improved by iteration: {improved_count}/{len(multi_iter)}")
