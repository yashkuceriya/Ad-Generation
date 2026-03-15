"""Tests for brief generation factory."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.intelligence.brief_factory import BriefFactory


def test_generate_demo_briefs():
    factory = BriefFactory()
    briefs = factory.generate_demo_briefs(5)
    assert len(briefs) == 5
    assert all(b.brief_id.startswith("demo_") for b in briefs)
    assert all(len(b.competitor_context) > 0 for b in briefs)


def test_generate_batch_briefs():
    factory = BriefFactory()
    briefs = factory.generate_briefs(50)
    assert len(briefs) == 50

    # All have unique IDs
    ids = [b.brief_id for b in briefs]
    assert len(set(ids)) == 50


def test_briefs_have_diversity():
    factory = BriefFactory()
    briefs = factory.generate_briefs(30)

    audiences = set(b.audience_segment for b in briefs)
    goals = set(b.campaign_goal for b in briefs)
    tones = set(b.tone for b in briefs)

    assert len(audiences) >= 2
    assert len(goals) >= 2
    assert len(tones) >= 2


def test_brief_has_competitor_context():
    factory = BriefFactory()
    briefs = factory.generate_demo_briefs(1)
    assert len(briefs[0].competitor_context) > 0
