"""Creative diversity checker — detects near-duplicate and converging ad copy.

Rule-based, zero LLM cost, instant execution.
Uses string similarity (difflib) to flag when the engine produces repetitive output.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from difflib import SequenceMatcher

from src.models import AdCopy


# Similarity thresholds (0.0 = completely different, 1.0 = identical)
HEADLINE_SIM_THRESHOLD = 0.80       # Headlines are short — 80% match is near-duplicate
PRIMARY_TEXT_SIM_THRESHOLD = 0.70    # Primary text is longer — 70% is still too similar
HOOK_SIM_THRESHOLD = 0.75           # First line (hook) must be distinct
CTA_DIVERSITY_MIN = 2               # At least 2 different CTAs across batch
STRUCTURAL_SIM_THRESHOLD = 0.85     # Overall copy structure similarity


@dataclass
class DiversityIssue:
    """A single diversity concern found across ads."""
    severity: str     # "error" (near-duplicate) or "warning" (pattern convergence)
    field: str        # "headline", "primary_text", "hook", "cta_button", "structure"
    rule: str         # Short rule name
    message: str      # Human-readable explanation
    similar_to: str   # brief_id of the similar ad
    similarity: float = 0.0  # 0-1 similarity score


@dataclass
class DiversityResult:
    """Result of diversity checking an ad against the existing batch."""
    is_diverse: bool                               # True if no errors
    issues: list[DiversityIssue] = field(default_factory=list)
    diversity_score: float = 10.0                  # 10 = fully unique, deducted per issue
    most_similar_id: str | None = None             # brief_id of most similar ad
    most_similar_score: float = 0.0                # similarity to that ad

    @property
    def errors(self) -> list[DiversityIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[DiversityIssue]:
        return [i for i in self.issues if i.severity == "warning"]


def _similarity(a: str, b: str) -> float:
    """Compute string similarity ratio between two texts."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _extract_hook(text: str) -> str:
    """Extract the first line (hook) from primary text."""
    lines = text.strip().split('\n')
    return lines[0].strip() if lines else ""


def _normalize(text: str) -> str:
    """Normalize text for structural comparison (remove punctuation, extra spaces)."""
    import re
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text


class DiversityChecker:
    """Checks ad copy diversity against existing batch.

    Pure rule-based — no LLM calls, zero cost, instant execution.
    Catches near-duplicates, converging hooks, and lack of CTA variety.
    """

    def check(self, ad_copy: AdCopy, brief_id: str,
              existing: list[tuple[str, AdCopy]]) -> DiversityResult:
        """Check an ad's copy against all existing ads.

        Args:
            ad_copy: The new ad copy to check.
            brief_id: The brief_id of the new ad.
            existing: List of (brief_id, AdCopy) pairs for comparison.

        Returns:
            DiversityResult with issues and overall diversity score.
        """
        issues: list[DiversityIssue] = []
        max_sim = 0.0
        max_sim_id: str | None = None

        for other_id, other_copy in existing:
            if other_id == brief_id:
                continue

            # 1. Headline similarity
            h_sim = _similarity(ad_copy.headline, other_copy.headline)
            if h_sim >= HEADLINE_SIM_THRESHOLD:
                severity = "error" if h_sim >= 0.95 else "warning"
                issues.append(DiversityIssue(
                    severity=severity,
                    field="headline",
                    rule="similar_headline",
                    message=f"Headline {h_sim:.0%} similar to {other_id}: "
                            f'"{other_copy.headline[:40]}..."',
                    similar_to=other_id,
                    similarity=h_sim,
                ))

            # 2. Hook (first line of primary text)
            hook_a = _extract_hook(ad_copy.primary_text)
            hook_b = _extract_hook(other_copy.primary_text)
            hook_sim = _similarity(hook_a, hook_b)
            if hook_sim >= HOOK_SIM_THRESHOLD:
                severity = "error" if hook_sim >= 0.95 else "warning"
                issues.append(DiversityIssue(
                    severity=severity,
                    field="hook",
                    rule="similar_hook",
                    message=f"Opening hook {hook_sim:.0%} similar to {other_id}: "
                            f'"{hook_b[:50]}..."',
                    similar_to=other_id,
                    similarity=hook_sim,
                ))

            # 3. Full primary text
            pt_sim = _similarity(ad_copy.primary_text, other_copy.primary_text)
            if pt_sim >= PRIMARY_TEXT_SIM_THRESHOLD:
                severity = "error" if pt_sim >= 0.90 else "warning"
                issues.append(DiversityIssue(
                    severity=severity,
                    field="primary_text",
                    rule="similar_primary_text",
                    message=f"Primary text {pt_sim:.0%} similar to {other_id}",
                    similar_to=other_id,
                    similarity=pt_sim,
                ))

            # 4. Structural similarity (normalized copy without punctuation)
            norm_a = _normalize(f"{ad_copy.headline} {ad_copy.primary_text}")
            norm_b = _normalize(f"{other_copy.headline} {other_copy.primary_text}")
            struct_sim = _similarity(norm_a, norm_b)
            if struct_sim >= STRUCTURAL_SIM_THRESHOLD:
                issues.append(DiversityIssue(
                    severity="error",
                    field="structure",
                    rule="structural_duplicate",
                    message=f"Overall copy structure {struct_sim:.0%} similar to {other_id} — likely a near-duplicate",
                    similar_to=other_id,
                    similarity=struct_sim,
                ))

            # Track most similar ad
            overall_sim = (h_sim * 0.3 + hook_sim * 0.3 + pt_sim * 0.4)
            if overall_sim > max_sim:
                max_sim = overall_sim
                max_sim_id = other_id

        # 5. CTA diversity check (across entire batch including this ad)
        all_ctas = {copy.cta_button.strip().lower() for _, copy in existing}
        all_ctas.add(ad_copy.cta_button.strip().lower())
        if len(existing) >= 3 and len(all_ctas) < CTA_DIVERSITY_MIN:
            issues.append(DiversityIssue(
                severity="warning",
                field="cta_button",
                rule="low_cta_diversity",
                message=f"Only {len(all_ctas)} unique CTA(s) across {len(existing) + 1} ads — "
                        "consider varying CTAs for A/B testing",
                similar_to="batch",
                similarity=0.0,
            ))

        # Calculate diversity score
        score = 10.0
        for issue in issues:
            if issue.severity == "error":
                score -= 2.0
            else:
                score -= 0.5
        score = max(0.0, round(score, 1))

        return DiversityResult(
            is_diverse=not any(i.severity == "error" for i in issues),
            issues=issues,
            diversity_score=score,
            most_similar_id=max_sim_id,
            most_similar_score=round(max_sim, 3),
        )

    def check_batch(self, ads: list[tuple[str, AdCopy]]) -> dict[str, DiversityResult]:
        """Check diversity across an entire batch of ads.

        Returns dict mapping brief_id → DiversityResult.
        """
        results: dict[str, DiversityResult] = {}
        for i, (brief_id, ad_copy) in enumerate(ads):
            # Compare against all other ads (not just earlier ones)
            others = [(bid, copy) for bid, copy in ads if bid != brief_id]
            results[brief_id] = self.check(ad_copy, brief_id, others)
        return results
