# Reference Ads

Place reference ad JSON files here for calibration scoring.

Each file should match the `AdResult` schema from `src/models.py`. Add an optional `_expected_scores` dict to annotate ground-truth expectations for comparison against actual evaluator output.

See `docs/calibration.md` for the full calibration workflow.
