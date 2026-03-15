"""Competitive intelligence from edtech ad landscape."""

from __future__ import annotations


# Extracted from Meta Ad Library research and public marketing analysis.
# In a production system, this would be live-scraped.
COMPETITOR_PATTERNS = {
    "princeton_review": {
        "name": "Princeton Review",
        "hooks": [
            "Score guarantee anchors (1400+, 1500+ guaranteed)",
            "Specific improvement numbers (+180 points)",
            "Risk reversal: money-back guarantee",
        ],
        "ctas": ["Enroll Now", "See Score Guarantees"],
        "emotional_angle": "aspiration + fear mitigation via guarantees",
        "copy_patterns": [
            "Leads with specific score targets",
            "Premium positioning justified by outcomes",
            "Parent-targeted enrollment urgency",
        ],
    },
    "kaplan": {
        "name": "Kaplan",
        "hooks": [
            "General score improvement guarantee",
            "Authority — decades of experience",
            "Breadth of test coverage",
        ],
        "ctas": ["Start Prep Today", "Get Started"],
        "emotional_angle": "authority + safety — brand trust and track record",
        "copy_patterns": [
            "Higher score guaranteed or money back",
            "Structured study plans emphasis",
            "Brand heritage and trust signals",
        ],
    },
    "khan_academy": {
        "name": "Khan Academy",
        "hooks": [
            "100% free — eliminates cost barrier",
            "Official SAT practice partner with College Board",
            "Partnership credibility",
        ],
        "ctas": ["Start Practicing Free"],
        "emotional_angle": "aspiration + accessibility — democratizing test prep",
        "copy_patterns": [
            "Free access as primary differentiator",
            "Official partnership as trust signal",
            "Equity and accessibility messaging",
        ],
    },
    "chegg": {
        "name": "Chegg",
        "hooks": [
            "Get unstuck — instant homework help",
            "Step-by-step solutions",
            "Broader academic support beyond test prep",
        ],
        "ctas": ["Try Chegg Free"],
        "emotional_angle": "relief from academic stress — immediate pain resolution",
        "copy_patterns": [
            "Convenience and speed emphasis",
            "Subscription model promotion",
            "Less SAT-specific, more general academic",
        ],
    },
}

# Cross-competitor patterns that Varsity Tutors should learn from
WINNING_PATTERNS = {
    "parents": [
        "Princeton Review leads with score guarantees — counter with personalized 1-on-1 advantage",
        "Kaplan uses brand authority — counter with modern, technology-enabled approach",
        "Khan Academy offers free — counter with expert human tutors (not just content)",
        "Use specific numbers: score improvements, student count, tutor qualifications",
        "Parent testimonials outperform expert claims for SAT prep",
    ],
    "students": [
        "Students respond to transformation stories (before/after scores)",
        "Chegg captures 'get unstuck' moment — position SAT prep as confidence-builder",
        "Peer social proof works better than authority for this audience",
        "Quick, visible progress messaging beats long-term promises",
        "Test anxiety acknowledgment followed by empowerment",
    ],
    "families": [
        "Comparison-shoppers need clear differentiation from Princeton Review and Kaplan",
        "Free trial reduces risk — key when competing against Khan Academy's free model",
        "1-on-1 personalization is the strongest differentiator vs all competitors",
        "ROI messaging: cost per score point improvement",
        "Reviews and ratings as decision-making aid",
    ],
}

HOOK_TEMPLATES = {
    "question": [
        "Is your child's SAT score holding them back?",
        "What if {outcome} was possible in just {timeframe}?",
        "Still deciding between test prep options?",
    ],
    "stat": [
        "Students who prep with expert tutors score {points}+ points higher.",
        "{percentage}% of our students hit their target score.",
        "Our students average a {points}-point SAT improvement.",
    ],
    "story": [
        "My daughter went from a {before} to a {after} in {weeks} weeks.",
        "I was scoring {before} and thought I'd never reach {target}. Then I found Varsity Tutors.",
    ],
    "fear": [
        "The SAT is {months} months away. Is your student ready?",
        "Every point matters for {college}. Don't leave it to chance.",
        "Test day is coming. Are they prepared — or just hoping?",
    ],
    "disqualifier": [
        "This isn't for students who just want to skim practice tests.",
        "If you're serious about a 1400+ score, read this.",
    ],
}


class CompetitorAnalyzer:
    """Provides competitive intelligence for ad generation context."""

    def get_patterns(self, audience_segment: str) -> list[str]:
        """Get competitor patterns relevant to the target audience."""
        return WINNING_PATTERNS.get(audience_segment, WINNING_PATTERNS["families"])

    def get_competitor_summary(self) -> dict:
        """Get full competitor analysis."""
        return COMPETITOR_PATTERNS

    def get_hook_templates(self, hook_type: str | None = None) -> dict | list:
        """Get hook templates, optionally filtered by type."""
        if hook_type:
            return HOOK_TEMPLATES.get(hook_type, [])
        return HOOK_TEMPLATES

    def get_differentiation_points(self) -> list[str]:
        """Key ways Varsity Tutors differentiates from competitors."""
        return [
            "1-on-1 expert human tutors (vs Princeton Review's classes, Khan's content)",
            "Personalized learning plan adapted in real-time (vs Kaplan's structured curriculum)",
            "Technology-enabled matching to the right tutor (vs generic assignment)",
            "Flexible scheduling — learn anytime (vs fixed class schedules)",
            "Free diagnostic to show where you stand (vs requiring upfront commitment)",
            "Results-focused: track improvement session by session",
        ]
