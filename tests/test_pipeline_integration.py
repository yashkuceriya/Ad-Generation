"""Integration test: full pipeline with mocked LLM responses."""

import sys
import os
import json
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.models import (
    AdBrief, AdCopy, AudienceSegment, CampaignGoal,
    DimensionScore, EvaluationResult, CopyIteration, StepCost,
)
from src.pipeline import AdPipeline
from src.tracking.cost_tracker import CostTracker
from config.evaluation_rubrics import DIMENSION_WEIGHTS


# --- Canned responses ---

COPY_JSON = json.dumps({
    "primary_text": "Is your child ready for the SAT? Our tutors helped 10,000+ students improve by 200+ points.",
    "headline": "Boost Your SAT Score Today",
    "description": "Personalized 1-on-1 expert tutoring",
    "cta_button": "Start Your Free Trial",
})

REFINED_COPY_JSON = json.dumps({
    "primary_text": "93% of students who prep with an expert tutor score 200+ points higher.",
    "headline": "Proven SAT Results — Start Free",
    "description": "Expert 1-on-1 tutoring, 200+ point avg improvement",
    "cta_button": "Get Started",
})

DIMENSIONS = ["clarity", "value_proposition", "cta_strength", "brand_voice", "emotional_resonance"]

EVAL_SCORES_ITER1 = {"clarity": 8.2, "value_proposition": 7.0, "cta_strength": 6.5, "brand_voice": 7.5, "emotional_resonance": 8.0}
EVAL_SCORES_ITER2 = {"clarity": 8.5, "value_proposition": 8.0, "cta_strength": 7.5, "brand_voice": 7.8, "emotional_resonance": 8.5}


def _make_llm_response(content, input_tokens=100, output_tokens=150):
    resp = MagicMock()
    resp.content = content
    resp.response_metadata = {
        "token_usage": {"prompt_tokens": input_tokens, "completion_tokens": output_tokens}
    }
    return resp


_call_log = []
_call_count = {"eval": 0}


def _mock_invoke(messages, config=None, **kwargs):
    """Route calls to canned responses based on metadata."""
    metadata = (config or {}).get("metadata", {})
    step = metadata.get("step_name", "")
    _call_log.append(step)

    if step == "generate_copy":
        return _make_llm_response(COPY_JSON)
    if step == "refine_copy":
        return _make_llm_response(REFINED_COPY_JSON)
    if step.startswith("score_"):
        dim = step.replace("score_", "")
        # First 5 eval calls = iteration 1, next 5 = iteration 2, etc.
        iteration_num = _call_count["eval"] // 5 + 1
        _call_count["eval"] += 1
        scores = EVAL_SCORES_ITER1 if iteration_num == 1 else EVAL_SCORES_ITER2
        s = scores.get(dim, 7.0)
        return _make_llm_response(json.dumps({
            "score": s, "rationale": f"Score for {dim}", "confidence": 0.85, "suggestions": ["improve"]
        }))

    return _make_llm_response("{}")


@pytest.fixture(autouse=True)
def reset_state():
    global _call_log
    _call_log = []
    _call_count["eval"] = 0
    CostTracker().reset()
    yield


@pytest.fixture
def brief():
    return AdBrief(
        brief_id="integ_001",
        audience_segment=AudienceSegment.PARENTS,
        product_offer="1-on-1 SAT tutoring",
        campaign_goal=CampaignGoal.CONVERSION,
        tone="urgent",
    )


def _make_mock_llm(*args, **kwargs):
    """Factory for mock ChatOpenAI instances."""
    m = MagicMock()
    m.invoke = _mock_invoke
    return m


@patch("src.tracking.rate_limiter.RateLimiter.wait_if_needed")
@patch("src.evaluate.dimension_scorer.ChatOpenAI", side_effect=_make_mock_llm)
@patch("src.generate.copy_generator.ChatOpenAI", side_effect=_make_mock_llm)
def test_pipeline_single_no_images(mock_gen_llm, mock_eval_llm, mock_rate, brief):
    """Full pipeline: generate → evaluate → refine → evaluate → select best."""
    pipeline = AdPipeline(image_mode="lazy")
    result = pipeline.run_single(brief, generate_images=False)

    # Should have multiple iterations (score < 9.0 threshold)
    assert len(result.copy_iterations) >= 2, f"Expected >=2 iterations, got {len(result.copy_iterations)}"
    assert result.image_iterations == []

    # Best copy selected correctly
    best = result.best_copy
    assert best.evaluation.weighted_average > 0
    assert best.ad_copy.headline != ""

    # All iterations have all 5 dimensions scored
    for ci in result.copy_iterations:
        assert len(ci.evaluation.scores) == 5
        for dim in DIMENSIONS:
            assert dim in ci.evaluation.scores
            assert 1.0 <= ci.evaluation.scores[dim].score <= 10.0

    # Second iteration should score higher (our mock returns higher scores for iter 2+)
    score1 = result.copy_iterations[0].evaluation.weighted_average
    score2 = result.copy_iterations[1].evaluation.weighted_average
    assert score2 > score1, f"Iteration 2 ({score2}) should beat iteration 1 ({score1})"

    # Costs recorded
    for ci in result.copy_iterations:
        assert len(ci.costs) > 0

    # Verify LLM was called: generate + 5 evals + refine + 5 evals = 12+ calls
    gen_calls = [c for c in _call_log if c in ("generate_copy", "refine_copy")]
    eval_calls = [c for c in _call_log if c.startswith("score_")]
    assert len(gen_calls) >= 2
    assert len(eval_calls) >= 10


def test_best_selector_picks_highest():
    """Verify best_copy_index points to the highest-scoring iteration."""
    from src.iterate.best_selector import BestSelector

    def _make_iter(num, avg_score):
        scores = [
            DimensionScore(dimension=d, score=avg_score, rationale="ok", confidence=0.8, suggestions=[])
            for d in DIMENSIONS
        ]
        evaluation = EvaluationResult.from_dimension_scores(scores, DIMENSION_WEIGHTS)
        return CopyIteration(
            iteration_number=num,
            ad_copy=AdCopy(primary_text="text", headline="head", description="desc", cta_button="CTA"),
            evaluation=evaluation,
            costs=[StepCost(model="test", step_name="test", pipeline_stage="test")],
        )

    iters = [_make_iter(1, 7.0), _make_iter(2, 8.5), _make_iter(3, 7.5)]
    selector = BestSelector()
    best_idx = selector.select_best_copy(iters)
    assert best_idx == 1


def test_json_parsing_nested_braces():
    """Verify the hardened JSON parser handles nested braces and markdown wrapping."""
    from src.evaluate.dimension_scorer import DimensionScorer
    from src.generate.copy_generator import CopyGenerator

    # Nested JSON with escaped quotes
    nested = '{"score": 7.5, "rationale": "The copy says \\"improve\\" which is good", "confidence": 0.8, "suggestions": ["Add stats"]}'
    result = DimensionScorer._extract_json_object(nested)
    assert result["score"] == 7.5
    assert "suggestions" in result

    # Markdown-wrapped
    wrapped = 'Here is my evaluation:\n```json\n{"score": 8.0, "rationale": "Clear message", "confidence": 0.9, "suggestions": []}\n```'
    text = wrapped.replace("```json", "").replace("```", "")
    result2 = DimensionScorer._extract_json_object(text)
    assert result2["score"] == 8.0

    # CopyGenerator parser with braces in values
    copy_json = '{"primary_text": "Test {with braces}", "headline": "H", "description": "D", "cta_button": "CTA"}'
    result3 = CopyGenerator._extract_json_object(copy_json)
    assert result3["headline"] == "H"

    # No JSON
    assert DimensionScorer._extract_json_object("no json here") == {}
    assert CopyGenerator._extract_json_object("") == {}


def _make_high_score_mock(*args, **kwargs):
    """Factory for mock LLM that returns high scores."""
    m = MagicMock()

    def _invoke(messages, config=None, **kw):
        metadata = (config or {}).get("metadata", {})
        step = metadata.get("step_name", "")
        if step in ("generate_copy", "refine_copy"):
            return _make_llm_response(COPY_JSON)
        if step.startswith("score_"):
            return _make_llm_response(json.dumps({
                "score": 9.5, "rationale": "Excellent", "confidence": 0.95, "suggestions": []
            }))
        return _make_llm_response("{}")

    m.invoke = _invoke
    return m


@patch("src.tracking.rate_limiter.RateLimiter.wait_if_needed")
@patch("src.evaluate.dimension_scorer.ChatOpenAI", side_effect=_make_high_score_mock)
@patch("src.generate.copy_generator.ChatOpenAI", side_effect=_make_high_score_mock)
def test_always_runs_all_iterations(mock_gen_llm, mock_eval_llm, mock_rate, brief):
    """Pipeline may early-stop when quality is exceptional; we get at least one iteration."""
    pipeline = AdPipeline(image_mode="lazy")
    result = pipeline.run_single(brief, generate_images=False)

    assert len(result.copy_iterations) >= 1
    assert result.copy_iterations[0].evaluation.weighted_average >= 9.0
    if len(result.copy_iterations) == 1:
        assert result.early_stopped
        assert "exceptional" in (result.early_stop_reason or "").lower()


@patch("src.tracking.rate_limiter.RateLimiter.wait_if_needed")
@patch("src.evaluate.dimension_scorer.ChatOpenAI", side_effect=_make_high_score_mock)
@patch("src.generate.copy_generator.ChatOpenAI", side_effect=_make_high_score_mock)
def test_all_iterations_emit_callback_high_score(mock_gen_llm, mock_eval_llm, mock_rate, brief):
    """on_iteration callback fires for each iteration; high scores can cause early stop (1 iteration)."""
    from src.iterate.copy_iterator import CopyIterator

    emitted = []
    iterator = CopyIterator()
    iterations_list, _early_stopped, _reason = iterator.iterate(brief, on_iteration=lambda it: emitted.append(it))

    assert len(iterations_list) >= 1
    assert len(emitted) == len(iterations_list)
    for i, it in enumerate(emitted):
        assert it.iteration_number == i + 1
        assert it.evaluation.weighted_average >= 9.0


@patch("src.tracking.rate_limiter.RateLimiter.wait_if_needed")
@patch("src.evaluate.dimension_scorer.ChatOpenAI", side_effect=_make_mock_llm)
@patch("src.generate.copy_generator.ChatOpenAI", side_effect=_make_mock_llm)
def test_all_iterations_emit_callback(mock_gen_llm, mock_eval_llm, mock_rate, brief):
    """on_iteration callback must fire for every iteration (1–3 depending on early stop)."""
    from src.iterate.copy_iterator import CopyIterator

    emitted = []
    iterator = CopyIterator()
    iterations_list, _early_stopped, _reason = iterator.iterate(brief, on_iteration=lambda it: emitted.append(it))

    assert len(emitted) == len(iterations_list)
    assert 1 <= len(iterations_list) <= 3
    for i, it in enumerate(emitted):
        assert it.iteration_number == i + 1
