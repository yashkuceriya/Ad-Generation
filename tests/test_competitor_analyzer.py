"""Tests for competitive intelligence."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.intelligence.competitor_analyzer import CompetitorAnalyzer


def test_get_patterns_parents():
    analyzer = CompetitorAnalyzer()
    patterns = analyzer.get_patterns("parents")
    assert len(patterns) > 0
    assert all(isinstance(p, str) for p in patterns)


def test_get_patterns_students():
    analyzer = CompetitorAnalyzer()
    patterns = analyzer.get_patterns("students")
    assert len(patterns) > 0


def test_get_patterns_families():
    analyzer = CompetitorAnalyzer()
    patterns = analyzer.get_patterns("families")
    assert len(patterns) > 0


def test_get_patterns_unknown_falls_back():
    analyzer = CompetitorAnalyzer()
    patterns = analyzer.get_patterns("aliens")
    assert len(patterns) > 0  # Falls back to families


def test_competitor_summary():
    analyzer = CompetitorAnalyzer()
    summary = analyzer.get_competitor_summary()
    assert "princeton_review" in summary
    assert "kaplan" in summary
    assert "khan_academy" in summary
    assert "chegg" in summary


def test_hook_templates():
    analyzer = CompetitorAnalyzer()
    all_hooks = analyzer.get_hook_templates()
    assert "question" in all_hooks
    assert "stat" in all_hooks
    assert "story" in all_hooks
    assert "fear" in all_hooks

    question_hooks = analyzer.get_hook_templates("question")
    assert isinstance(question_hooks, list)
    assert len(question_hooks) > 0


def test_differentiation_points():
    analyzer = CompetitorAnalyzer()
    points = analyzer.get_differentiation_points()
    assert len(points) > 0
    assert any("1-on-1" in p for p in points)
