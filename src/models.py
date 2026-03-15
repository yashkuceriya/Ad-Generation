"""Core data models for the ad generation pipeline."""

from __future__ import annotations

from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime


class AudienceSegment(str, Enum):
    PARENTS = "parents"
    STUDENTS = "students"
    FAMILIES = "families"


class CampaignGoal(str, Enum):
    AWARENESS = "awareness"
    CONVERSION = "conversion"


class AdBrief(BaseModel):
    brief_id: str
    audience_segment: AudienceSegment
    product_offer: str
    campaign_goal: CampaignGoal
    tone: str
    competitor_context: list[str] = Field(default_factory=list)
    subject_focus: str = "SAT test prep"


class AdCopy(BaseModel):
    primary_text: str = Field(description="Main copy above image, stops the scroll")
    headline: str = Field(description="Bold text below image, 5-8 words max")
    description: str = Field(description="Secondary text below headline")
    cta_button: str = Field(description="CTA button text: Learn More, Sign Up, Get Started, etc.")


class DimensionScore(BaseModel):
    dimension: str
    score: float = Field(ge=1.0, le=10.0)
    rationale: str
    confidence: float = Field(ge=0.0, le=1.0)
    suggestions: list[str] = Field(default_factory=list)


class EvaluationResult(BaseModel):
    scores: dict[str, DimensionScore]
    weighted_average: float
    weakest_dimension: str
    passes_threshold: bool

    @classmethod
    def from_dimension_scores(
        cls,
        dimension_scores: list[DimensionScore],
        weights: dict[str, float],
        threshold: float = 7.0,
    ) -> EvaluationResult:
        scores = {ds.dimension: ds for ds in dimension_scores}
        total_weight = sum(weights.get(d, 0.2) for d in scores)
        weighted_avg = sum(
            scores[d].score * weights.get(d, 0.2) for d in scores
        ) / total_weight

        weakest = min(scores.values(), key=lambda ds: ds.score)

        return cls(
            scores=scores,
            weighted_average=round(weighted_avg, 2),
            weakest_dimension=weakest.dimension,
            passes_threshold=weighted_avg >= threshold,
        )


class ImageEvaluationResult(BaseModel):
    brand_consistency: float = Field(ge=1.0, le=10.0)
    engagement_potential: float = Field(ge=1.0, le=10.0)
    text_image_alignment: float = Field(ge=1.0, le=10.0)
    average_score: float = Field(ge=1.0, le=10.0)
    rationale: str
    suggestions: list[str] = Field(default_factory=list)

    @classmethod
    def compute(
        cls,
        brand_consistency: float,
        engagement_potential: float,
        text_image_alignment: float,
        rationale: str,
        suggestions: list[str] | None = None,
    ) -> ImageEvaluationResult:
        avg = round((brand_consistency + engagement_potential + text_image_alignment) / 3, 2)
        return cls(
            brand_consistency=brand_consistency,
            engagement_potential=engagement_potential,
            text_image_alignment=text_image_alignment,
            average_score=avg,
            rationale=rationale,
            suggestions=suggestions or [],
        )


class StepCost(BaseModel):
    model: str
    step_name: str
    pipeline_stage: str
    iteration: int = 0
    brief_id: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class CopyIteration(BaseModel):
    iteration_number: int
    ad_copy: AdCopy
    evaluation: EvaluationResult
    refinement_feedback: str | None = None
    costs: list[StepCost] = Field(default_factory=list)

    @property
    def total_cost(self) -> float:
        return sum(c.cost_usd for c in self.costs)


class ImageIteration(BaseModel):
    iteration_number: int
    image_path: str
    image_prompt: str
    evaluation: ImageEvaluationResult
    refinement_feedback: str | None = None
    costs: list[StepCost] = Field(default_factory=list)

    @property
    def total_cost(self) -> float:
        return sum(c.cost_usd for c in self.costs)


class AdStatus(str, Enum):
    """Ad readiness lifecycle."""
    ITERATING = "iterating"
    GENERATED = "generated"                # Copy complete, pending evaluation
    EVALUATOR_PASS = "evaluator_pass"      # Score >= threshold
    COMPLIANCE_PASS = "compliance_pass"    # Evaluator pass + compliance pass
    HUMAN_APPROVED = "human_approved"      # Manually approved
    EXPERIMENT_READY = "experiment_ready"  # Approved + variants ready
    BELOW_THRESHOLD = "below_threshold"
    REJECTED = "rejected"                  # Explicitly rejected by reviewer
    # Legacy alias kept for backward compat when loading old data
    PUBLISHED = "published"


class ComplianceViolation(BaseModel):
    """A single compliance issue found in the ad."""
    severity: str  # "error" or "warning"
    field: str
    rule: str
    message: str
    suggestion: str = ""


class ComplianceResult(BaseModel):
    """Result of compliance checking an ad."""
    passes: bool
    violations: list[ComplianceViolation] = Field(default_factory=list)
    score: float = 10.0

    @property
    def errors(self) -> list[ComplianceViolation]:
        return [v for v in self.violations if v.severity == "error"]

    @property
    def warnings(self) -> list[ComplianceViolation]:
        return [v for v in self.violations if v.severity == "warning"]


class DiversityIssue(BaseModel):
    """A single diversity concern found across ads."""
    severity: str  # "error" or "warning"
    field: str
    rule: str
    message: str
    similar_to: str
    similarity: float = 0.0


class DiversityResult(BaseModel):
    """Result of diversity checking an ad against the batch."""
    is_diverse: bool
    issues: list[DiversityIssue] = Field(default_factory=list)
    diversity_score: float = 10.0
    most_similar_id: str | None = None
    most_similar_score: float = 0.0

    @property
    def errors(self) -> list[DiversityIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> list[DiversityIssue]:
        return [i for i in self.issues if i.severity == "warning"]


class ABVariant(BaseModel):
    """An A/B test variant of a winning ad."""
    variant_type: str  # "hook_variant" or "cta_variant"
    variant_hypothesis: str
    ad_copy: AdCopy
    costs: list[StepCost] = Field(default_factory=list)


class AdResult(BaseModel):
    brief_id: str
    brief: AdBrief
    copy_iterations: list[CopyIteration]
    image_iterations: list[ImageIteration] = Field(default_factory=list)
    best_copy_index: int = 0
    best_image_index: int = 0
    total_cost_usd: float = 0.0
    quality_per_dollar: float = 0.0
    status: str = AdStatus.ITERATING.value
    early_stopped: bool = False
    early_stop_reason: str | None = None
    compliance: ComplianceResult | None = None
    diversity: DiversityResult | None = None
    variants: list[ABVariant] = Field(default_factory=list)
    approved_by: str | None = None
    approved_at: str | None = None
    rejection_reason: str | None = None
    approval_notes: str | None = None

    @property
    def best_copy(self) -> CopyIteration:
        return self.copy_iterations[self.best_copy_index]

    @property
    def best_image(self) -> ImageIteration | None:
        if self.image_iterations:
            return self.image_iterations[self.best_image_index]
        return None

    def compute_totals(self, quality_threshold: float = 7.0) -> None:
        all_costs = []
        for ci in self.copy_iterations:
            all_costs.extend(ci.costs)
        for ii in self.image_iterations:
            all_costs.extend(ii.costs)
        self.total_cost_usd = round(sum(c.cost_usd for c in all_costs), 6)
        best_score = self.best_copy.evaluation.weighted_average
        if self.total_cost_usd > 0:
            self.quality_per_dollar = round(best_score / self.total_cost_usd, 2)
        else:
            self.quality_per_dollar = 0.0

        # Preserve human decisions — don't override these statuses
        preserved = {
            AdStatus.HUMAN_APPROVED.value,
            AdStatus.EXPERIMENT_READY.value,
            AdStatus.REJECTED.value,
        }
        if self.status in preserved:
            return

        # Compute readiness status through the pipeline
        if best_score >= quality_threshold:
            # Treat legacy "published" as evaluator_pass
            if (
                self.compliance is not None
                and self.compliance.passes
            ):
                self.status = AdStatus.COMPLIANCE_PASS.value
            else:
                self.status = AdStatus.EVALUATOR_PASS.value
        else:
            self.status = AdStatus.BELOW_THRESHOLD.value
