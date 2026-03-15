"""Platform compliance checker for ad copy — rule-based, no LLM calls."""

from __future__ import annotations
from dataclasses import dataclass, field
from src.models import AdCopy

# Facebook/Meta ad platform limits
# https://www.facebook.com/business/help/1842243959498498
HEADLINE_RECOMMENDED_MAX = 40      # Characters (recommended, not hard limit)
HEADLINE_HARD_MAX = 255            # Hard limit before truncation
PRIMARY_TEXT_PREVIEW_MAX = 125     # Characters shown before "See more"
PRIMARY_TEXT_HARD_MAX = 2200       # Absolute max
DESCRIPTION_RECOMMENDED_MAX = 30   # Characters (recommended)
DESCRIPTION_HARD_MAX = 255         # Hard limit

# Meta's approved CTA buttons (subset most relevant for education)
VALID_CTA_BUTTONS = {
    "Learn More", "Sign Up", "Get Started", "Book Now",
    "Apply Now", "Contact Us", "Download", "Get Offer",
    "Get Quote", "Subscribe", "Shop Now", "Watch More",
    "Send Message", "Get Directions", "Call Now",
}

# Words/phrases that could get ads rejected or limited
PROHIBITED_PATTERNS = [
    # Absolute guarantees without disclaimers
    "guaranteed score", "guarantee your score", "guaranteed results",
    "100% guaranteed", "money back guarantee",
    # Misleading urgency
    "last chance ever", "final opportunity ever",
    # Discriminatory targeting language
    "for white", "for black", "for asian", "for hispanic",
    # Financial claims without basis
    "earn money", "get rich", "make money fast",
    # Health/medical claims
    "cure", "diagnose", "treat disease",
    # Profanity (basic check)
    "damn", "hell", "crap",
]

# Patterns that trigger warnings (not rejections)
WARNING_PATTERNS = [
    # Claims that should have disclaimers
    ("average improvement", "Consider adding 'results may vary' disclaimer"),
    ("score increase", "Consider specifying this is an average, not guaranteed"),
    ("all students", "Absolute claims may be flagged — consider 'most students' or specific %"),
    ("never fail", "Avoid absolute negative claims"),
    ("best in", "Superlative claims may need substantiation"),
    ("#1", "Ranking claims require third-party verification"),
]


@dataclass
class ComplianceViolation:
    """A single compliance issue found in the ad."""
    severity: str  # "error" (would be rejected) or "warning" (might underperform)
    field: str     # Which field: "headline", "primary_text", "description", "cta_button"
    rule: str      # Short rule name
    message: str   # Human-readable explanation
    suggestion: str = ""  # How to fix it


@dataclass
class ComplianceResult:
    """Result of compliance checking an ad."""
    passes: bool                               # True if no errors (warnings OK)
    violations: list[ComplianceViolation] = field(default_factory=list)
    score: float = 10.0                        # 10 = perfect, deducted per violation

    @property
    def errors(self) -> list[ComplianceViolation]:
        return [v for v in self.violations if v.severity == "error"]

    @property
    def warnings(self) -> list[ComplianceViolation]:
        return [v for v in self.violations if v.severity == "warning"]


class ComplianceChecker:
    """Validates ad copy against Meta/Facebook platform rules.

    Pure rule-based — no LLM calls, zero cost, instant execution.
    Run after copy generation to catch issues before publishing.
    """

    def check(self, ad_copy: AdCopy) -> ComplianceResult:
        """Run all compliance checks on ad copy."""
        violations: list[ComplianceViolation] = []

        # Character limit checks
        violations.extend(self._check_character_limits(ad_copy))

        # CTA validation
        violations.extend(self._check_cta(ad_copy))

        # Prohibited content
        violations.extend(self._check_prohibited_content(ad_copy))

        # Warning patterns
        violations.extend(self._check_warning_patterns(ad_copy))

        # Structural checks
        violations.extend(self._check_structure(ad_copy))

        # Calculate score: start at 10, deduct per violation
        score = 10.0
        for v in violations:
            if v.severity == "error":
                score -= 2.0
            else:
                score -= 0.5
        score = max(0.0, round(score, 1))

        return ComplianceResult(
            passes=not any(v.severity == "error" for v in violations),
            violations=violations,
            score=score,
        )

    def _check_character_limits(self, copy: AdCopy) -> list[ComplianceViolation]:
        violations = []

        # Headline
        if len(copy.headline) > HEADLINE_HARD_MAX:
            violations.append(ComplianceViolation(
                severity="error",
                field="headline",
                rule="headline_too_long",
                message=f"Headline is {len(copy.headline)} chars (hard max: {HEADLINE_HARD_MAX})",
                suggestion=f"Shorten to under {HEADLINE_HARD_MAX} characters",
            ))
        elif len(copy.headline) > HEADLINE_RECOMMENDED_MAX:
            violations.append(ComplianceViolation(
                severity="warning",
                field="headline",
                rule="headline_over_recommended",
                message=f"Headline is {len(copy.headline)} chars (recommended max: {HEADLINE_RECOMMENDED_MAX})",
                suggestion=f"Headlines under {HEADLINE_RECOMMENDED_MAX} chars perform better — consider shortening",
            ))

        # Primary text
        if len(copy.primary_text) > PRIMARY_TEXT_HARD_MAX:
            violations.append(ComplianceViolation(
                severity="error",
                field="primary_text",
                rule="primary_text_too_long",
                message=f"Primary text is {len(copy.primary_text)} chars (max: {PRIMARY_TEXT_HARD_MAX})",
                suggestion=f"Shorten to under {PRIMARY_TEXT_HARD_MAX} characters",
            ))
        elif len(copy.primary_text) > PRIMARY_TEXT_PREVIEW_MAX:
            # This isn't an error — it's expected. But note the fold point.
            pass  # Normal for primary text to be longer than preview

        # Description
        if len(copy.description) > DESCRIPTION_HARD_MAX:
            violations.append(ComplianceViolation(
                severity="error",
                field="description",
                rule="description_too_long",
                message=f"Description is {len(copy.description)} chars (max: {DESCRIPTION_HARD_MAX})",
                suggestion=f"Shorten to under {DESCRIPTION_HARD_MAX} characters",
            ))
        elif len(copy.description) > DESCRIPTION_RECOMMENDED_MAX:
            violations.append(ComplianceViolation(
                severity="warning",
                field="description",
                rule="description_over_recommended",
                message=f"Description is {len(copy.description)} chars (recommended: {DESCRIPTION_RECOMMENDED_MAX})",
                suggestion=f"Shorter descriptions show fully without truncation",
            ))

        # Empty fields
        if not copy.headline.strip():
            violations.append(ComplianceViolation(
                severity="error", field="headline",
                rule="empty_headline", message="Headline is empty",
            ))
        if not copy.primary_text.strip():
            violations.append(ComplianceViolation(
                severity="error", field="primary_text",
                rule="empty_primary_text", message="Primary text is empty",
            ))

        return violations

    def _check_cta(self, copy: AdCopy) -> list[ComplianceViolation]:
        violations = []
        cta = copy.cta_button.strip()

        if not cta:
            violations.append(ComplianceViolation(
                severity="error", field="cta_button",
                rule="empty_cta", message="CTA button text is empty",
                suggestion="Use one of: " + ", ".join(sorted(VALID_CTA_BUTTONS)),
            ))
        elif cta not in VALID_CTA_BUTTONS:
            # Check case-insensitive match
            matched = next((v for v in VALID_CTA_BUTTONS if v.lower() == cta.lower()), None)
            if matched:
                violations.append(ComplianceViolation(
                    severity="warning", field="cta_button",
                    rule="cta_case_mismatch",
                    message=f"CTA '{cta}' should be '{matched}' (case mismatch)",
                    suggestion=f"Use exact text: '{matched}'",
                ))
            else:
                violations.append(ComplianceViolation(
                    severity="warning", field="cta_button",
                    rule="non_standard_cta",
                    message=f"CTA '{cta}' is not a standard Meta button option",
                    suggestion="Standard options: " + ", ".join(sorted(VALID_CTA_BUTTONS)),
                ))
        return violations

    def _check_prohibited_content(self, copy: AdCopy) -> list[ComplianceViolation]:
        violations = []
        full_text = f"{copy.primary_text} {copy.headline} {copy.description}".lower()

        for pattern in PROHIBITED_PATTERNS:
            if pattern.lower() in full_text:
                # Determine which field contains it
                field = "primary_text"
                if pattern.lower() in copy.headline.lower():
                    field = "headline"
                elif pattern.lower() in copy.description.lower():
                    field = "description"

                violations.append(ComplianceViolation(
                    severity="error",
                    field=field,
                    rule="prohibited_content",
                    message=f"Contains prohibited phrase: '{pattern}'",
                    suggestion="Remove or rephrase this content to comply with Meta ad policies",
                ))
        return violations

    def _check_warning_patterns(self, copy: AdCopy) -> list[ComplianceViolation]:
        violations = []
        full_text = f"{copy.primary_text} {copy.headline} {copy.description}".lower()

        for pattern, suggestion in WARNING_PATTERNS:
            if pattern.lower() in full_text:
                field = "primary_text"
                if pattern.lower() in copy.headline.lower():
                    field = "headline"
                elif pattern.lower() in copy.description.lower():
                    field = "description"

                violations.append(ComplianceViolation(
                    severity="warning",
                    field=field,
                    rule="content_warning",
                    message=f"Contains pattern that may trigger review: '{pattern}'",
                    suggestion=suggestion,
                ))
        return violations

    def _check_structure(self, copy: AdCopy) -> list[ComplianceViolation]:
        violations = []

        # Check for excessive caps (>50% uppercase suggests shouting)
        for field_name, text in [("headline", copy.headline), ("primary_text", copy.primary_text)]:
            if len(text) > 10:
                alpha_chars = [c for c in text if c.isalpha()]
                if alpha_chars:
                    upper_ratio = sum(1 for c in alpha_chars if c.isupper()) / len(alpha_chars)
                    if upper_ratio > 0.5:
                        violations.append(ComplianceViolation(
                            severity="warning",
                            field=field_name,
                            rule="excessive_caps",
                            message=f"{field_name.replace('_', ' ').title()} is {upper_ratio:.0%} uppercase — may appear as shouting",
                            suggestion="Use normal sentence case for better engagement",
                        ))

        # Check for excessive emoji
        import re
        emoji_pattern = re.compile(
            "[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
            "\U0001F1E0-\U0001F1FF\U00002702-\U000027B0\U0001F900-\U0001F9FF"
            "\U0001FA00-\U0001FA6F\U0001FA70-\U0001FAFF\U00002600-\U000026FF]+",
            flags=re.UNICODE,
        )
        emoji_count = len(emoji_pattern.findall(copy.primary_text))
        if emoji_count > 4:
            violations.append(ComplianceViolation(
                severity="warning",
                field="primary_text",
                rule="excessive_emoji",
                message=f"Primary text has {emoji_count} emoji clusters — may reduce engagement",
                suggestion="Use 1-2 emoji as visual anchors, not decoration",
            ))

        # Check headline doesn't repeat primary text hook
        if copy.primary_text and copy.headline:
            hook = copy.primary_text.split('\n')[0].strip().lower()
            headline_lower = copy.headline.strip().lower()
            # Simple check: if first 20 chars of hook match headline start
            if len(hook) >= 20 and len(headline_lower) >= 15:
                if hook[:20] == headline_lower[:20]:
                    violations.append(ComplianceViolation(
                        severity="warning",
                        field="headline",
                        rule="headline_repeats_hook",
                        message="Headline appears to repeat the primary text hook",
                        suggestion="Headlines should complement, not repeat, the primary text",
                    ))

        return violations
