"""Factory for generating ad briefs at scale."""

from __future__ import annotations

import itertools
import time
from src.models import AdBrief, AudienceSegment, CampaignGoal
from src.intelligence.competitor_analyzer import CompetitorAnalyzer
from config.brand_guidelines import PRODUCT_OFFERS


TONES = ["empowering", "urgent", "empathetic", "confident", "aspirational"]


def _run_prefix() -> str:
    """Generate a short unique prefix for this run based on timestamp."""
    # Use base-36 of seconds since epoch for compact, unique-per-second IDs
    return f"r{int(time.time()) % 100000:05d}"


class BriefFactory:
    """Generates diverse ad briefs for batch processing."""

    def __init__(self):
        self.analyzer = CompetitorAnalyzer()
        self._prefix = _run_prefix()

    def generate_briefs(self, count: int = 50) -> list[AdBrief]:
        """Generate a diverse set of ad briefs.

        Creates combinations across audience segments, campaign goals,
        product offers, and tones. Attaches competitor intelligence.
        """
        briefs: list[AdBrief] = []
        brief_num = 0

        audiences = list(AudienceSegment)
        goals = list(CampaignGoal)

        # Round-robin across all dimensions for maximum diversity in any subset
        combos = []
        for i in range(count + 10):  # generate enough
            aud = audiences[i % len(audiences)]
            goal = goals[(i // len(audiences)) % len(goals)]
            offer = PRODUCT_OFFERS[(i // (len(audiences) * len(goals))) % len(PRODUCT_OFFERS)]
            tone = TONES[i % len(TONES)]
            combos.append((aud, goal, offer, tone))

        for audience, goal, offer, tone in combos:
            if brief_num >= count:
                break

            brief_num += 1
            competitor_context = self.analyzer.get_patterns(audience.value)

            briefs.append(AdBrief(
                brief_id=f"{self._prefix}_{brief_num:03d}",
                audience_segment=audience,
                product_offer=offer,
                campaign_goal=goal,
                tone=tone,
                competitor_context=competitor_context,
            ))

        # If we need more, cycle through again with slight variations
        while len(briefs) < count:
            base = briefs[len(briefs) % len(combos)]
            brief_num += 1
            briefs.append(AdBrief(
                brief_id=f"{self._prefix}_{brief_num:03d}",
                audience_segment=base.audience_segment,
                product_offer=base.product_offer,
                campaign_goal=base.campaign_goal,
                tone=TONES[brief_num % len(TONES)],
                competitor_context=base.competitor_context,
            ))

        return briefs[:count]

    def generate_custom_brief(self, params: dict) -> list[AdBrief]:
        """Generate a single brief from user-specified parameters."""
        audience = AudienceSegment(params.get("audience", "parents"))
        goal = CampaignGoal(params.get("goal", "awareness"))
        offer = params.get("offer", "SAT prep free trial")
        tone = params.get("tone", "confident")

        competitor_context = self.analyzer.get_patterns(audience.value)

        return [AdBrief(
            brief_id=f"{self._prefix}_c01",
            audience_segment=audience,
            product_offer=offer,
            campaign_goal=goal,
            tone=tone,
            competitor_context=competitor_context,
        )]

    def generate_demo_briefs(self, count: int = 5) -> list[AdBrief]:
        """Generate a small set of diverse briefs for demo/testing. Uses 'demo' prefix for IDs."""
        demo_configs = [
            (AudienceSegment.PARENTS, CampaignGoal.CONVERSION, "1-on-1 SAT tutoring sessions", "urgent"),
            (AudienceSegment.STUDENTS, CampaignGoal.AWARENESS, "Free SAT diagnostic assessment", "empowering"),
            (AudienceSegment.FAMILIES, CampaignGoal.CONVERSION, "SAT prep free trial", "confident"),
            (AudienceSegment.PARENTS, CampaignGoal.AWARENESS, "Personalized SAT study plan", "empathetic"),
            (AudienceSegment.STUDENTS, CampaignGoal.CONVERSION, "SAT score improvement guarantee program", "aspirational"),
        ]

        briefs = []
        for i, (audience, goal, offer, tone) in enumerate(demo_configs[:count]):
            competitor_context = self.analyzer.get_patterns(audience.value)
            briefs.append(AdBrief(
                brief_id=f"demo_{i+1:02d}",
                audience_segment=audience,
                product_offer=offer,
                campaign_goal=goal,
                tone=tone,
                competitor_context=competitor_context,
            ))

        return briefs
