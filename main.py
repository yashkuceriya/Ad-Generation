"""Main entry point for the Nerdy Autonomous Ad Generation Engine."""

from __future__ import annotations

import argparse
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from src.tracking.langsmith_tracer import get_callbacks as _init_langsmith_check
from src.tracking.cost_tracker import CostTracker
from src.intelligence.brief_factory import BriefFactory
from src.pipeline import AdPipeline
from src.output.formatter import AdFormatter
from src.output.visualizer import AdVisualizer


def main():
    parser = argparse.ArgumentParser(
        description="Nerdy Autonomous Ad Generation Engine — "
        "Generate, evaluate, and iterate Facebook/Instagram ads for Varsity Tutors SAT prep."
    )
    parser.add_argument(
        "--mode", choices=["demo", "batch", "single"],
        default="demo",
        help="demo=5 briefs, batch=50+ briefs, single=1 brief"
    )
    parser.add_argument(
        "--count", type=int, default=50,
        help="Number of briefs for batch mode (default: 50)"
    )
    parser.add_argument(
        "--images", choices=["eager", "lazy", "off"],
        default="lazy",
        help="eager=generate images inline, lazy=on-demand (default), off=skip entirely"
    )
    parser.add_argument(
        "--max-copy-iters", type=int, default=3,
        help="Max copy iterations (default: 3)"
    )
    parser.add_argument(
        "--max-image-iters", type=int, default=3,
        help="Max image iterations (default: 3, hard cap)"
    )

    args = parser.parse_args()

    # LangSmith tracing auto-initializes via get_callbacks()

    # Validate API key
    if not os.getenv("OPENROUTER_API_KEY"):
        print("ERROR: OPENROUTER_API_KEY not set. Copy .env.example to .env and add your key.")
        sys.exit(1)

    print("=" * 60)
    print("  NERDY AUTONOMOUS AD GENERATION ENGINE")
    print("  Varsity Tutors SAT Prep — Facebook/Instagram Ads")
    print("=" * 60)
    print(f"  Mode: {args.mode}")
    print(f"  Images: {args.images}")
    print(f"  Max copy iterations: {args.max_copy_iters}")
    print(f"  Max image iterations: {args.max_image_iters}")

    langsmith_configured = bool(os.getenv("LANGSMITH_API_KEY"))
    print(f"  LangSmith tracing: {'enabled' if langsmith_configured else 'disabled (set LANGSMITH_API_KEY)'}")
    print("=" * 60)

    # Reset cost tracker
    CostTracker.reset()

    # Generate briefs
    factory = BriefFactory()
    if args.mode == "demo":
        briefs = factory.generate_demo_briefs(5)
    elif args.mode == "single":
        briefs = factory.generate_demo_briefs(1)
    else:
        briefs = factory.generate_briefs(args.count)

    # Override iteration settings
    import config.settings as settings
    settings.MAX_COPY_ITERATIONS = args.max_copy_iters
    settings.MAX_IMAGE_ITERATIONS = min(args.max_image_iters, 3)  # Hard cap

    # Determine image mode
    if args.images == "off":
        image_mode = "lazy"  # No images at all
    else:
        image_mode = args.images  # "eager" or "lazy"

    # Run pipeline
    pipeline = AdPipeline(image_mode=image_mode)

    if args.images == "eager" and args.mode == "demo":
        # For demo with eager images, generate images inline
        results = pipeline.run_batch(briefs)
    elif args.images == "off":
        # No images at all
        results = pipeline.run_batch(briefs)
    else:
        # Default: generate text, images on-demand
        results = pipeline.run_batch(briefs)

        # In demo mode with lazy images, auto-generate for top 3 ads
        if args.mode == "demo" and args.images == "lazy" and results:
            print("\n  Generating images for top 3 ads...")
            scored = sorted(results, key=lambda r: r.best_copy.evaluation.weighted_average, reverse=True)
            for r in scored[:3]:
                pipeline.generate_image_for_result(r)

    if not results:
        print("\nNo results generated. Check your API key and network.")
        sys.exit(1)

    # Export results
    print("\nExporting results...")
    formatter = AdFormatter()

    lib_path = formatter.export_ad_library(results)
    print(f"  Ad library: {lib_path}")

    csv_path = formatter.export_best_ads_csv(results)
    print(f"  Best ads CSV: {csv_path}")

    hist_path = formatter.export_iteration_history(results)
    print(f"  Iteration history: {hist_path}")

    report_path = formatter.generate_markdown_report(results)
    print(f"  Report: {report_path}")

    # Generate visualizations
    print("\nGenerating visualizations...")
    viz = AdVisualizer()
    viz_paths = viz.generate_all(results)
    for p in viz_paths:
        if p:
            print(f"  Chart: {p}")

    # Final cost summary
    tracker = CostTracker()
    print(f"\n{'='*60}")
    print("COST SUMMARY")
    print(f"{'='*60}")
    print(f"  Total cost: ${tracker.total_cost:.6f}")
    print(f"  Total tokens: {tracker.total_tokens:,}")
    print(f"  Total API calls: {len(tracker.ledger)}")
    print(f"  Cost by model: {tracker.cost_by_model()}")
    print(f"  Cost by stage: {tracker.cost_by_stage()}")

    ads_with_images = [r for r in results if r.image_iterations]
    ads_without = len(results) - len(ads_with_images)
    if ads_without > 0:
        print(f"\n  {ads_without} ads have deferred images (generate on-demand)")

    print(f"\nDone! Results in output/reports/")


if __name__ == "__main__":
    main()
