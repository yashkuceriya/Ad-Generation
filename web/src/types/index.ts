export interface AdBrief {
  brief_id: string;
  audience_segment: string;
  product_offer: string;
  campaign_goal: string;
  tone: string;
  competitor_context: string[];
  subject_focus: string;
}

export interface AdCopy {
  primary_text: string;
  headline: string;
  description: string;
  cta_button: string;
}

export interface DimensionScore {
  dimension: string;
  score: number;
  rationale: string;
  confidence: number;
  suggestions: string[];
}

export interface EvaluationResult {
  scores: Record<string, DimensionScore>;
  weighted_average: number;
  weakest_dimension: string;
  passes_threshold: boolean;
}

export interface ImageEvaluationResult {
  brand_consistency: number;
  engagement_potential: number;
  text_image_alignment: number;
  average_score: number;
  rationale: string;
  suggestions: string[];
}

export interface StepCost {
  model: string;
  step_name: string;
  pipeline_stage: string;
  iteration: number;
  brief_id: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost_usd: number;
  timestamp: string;
}

export interface CopyIteration {
  iteration_number: number;
  ad_copy: AdCopy;
  evaluation: EvaluationResult;
  refinement_feedback: string | null;
  costs: StepCost[];
}

export interface ImageIteration {
  iteration_number: number;
  image_path: string;
  image_prompt: string;
  image_url?: string;
  evaluation: ImageEvaluationResult;
  refinement_feedback: string | null;
  costs: StepCost[];
}

export interface ComplianceViolation {
  severity: 'error' | 'warning';
  field: string;
  rule: string;
  message: string;
  suggestion: string;
}

export interface ComplianceResult {
  passes: boolean;
  violations: ComplianceViolation[];
  score: number;
}

export interface DiversityIssue {
  severity: 'error' | 'warning';
  field: string;
  rule: string;
  message: string;
  similar_to: string;
  similarity: number;
}

export interface DiversityResult {
  is_diverse: boolean;
  issues: DiversityIssue[];
  diversity_score: number;
  most_similar_id: string | null;
  most_similar_score: number;
}

export interface ABVariant {
  variant_type: 'hook_variant' | 'cta_variant';
  variant_hypothesis: string;
  ad_copy: AdCopy;
  costs: StepCost[];
}

export interface AdResult {
  brief_id: string;
  brief: AdBrief;
  copy_iterations: CopyIteration[];
  image_iterations: ImageIteration[];
  best_copy_index: number;
  best_image_index: number;
  total_cost_usd: number;
  quality_per_dollar: number;
  status: 'iterating' | 'generated' | 'evaluator_pass' | 'compliance_pass' | 'human_approved' | 'experiment_ready' | 'below_threshold' | 'rejected' | 'published';
  early_stopped: boolean;
  early_stop_reason: string | null;
  compliance: ComplianceResult | null;
  diversity: DiversityResult | null;
  variants: ABVariant[];
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  approval_notes: string | null;
}

export interface PipelineStatus {
  status: string;
  current_brief_index: number;
  total_briefs: number;
  current_phase: string;
  current_brief_id: string;
  elapsed_seconds: number | null;
  error: string | null;
  completed_ads: number;
  completed_run_ads: number;
}

export interface ParseTelemetry {
  json_ok: number;
  json_extract_fallback: number;
  regex_fallback: number;
  default_fallback: number;
}

export interface PipelineMetricsData {
  early_stopping: {
    exceptional: number;
    threshold: number;
    full_iterations: number;
    total: number;
    early_stop_rate: number;
  };
  iteration_distribution: Record<string, number>;
  eval_mode: {
    batched_ok: number;
    batched_fallback: number;
    total: number;
    batch_success_rate: number;
  };
  image_cache: {
    hits: number;
    misses: number;
    force_regenerates: number;
    total: number;
    hit_rate: number;
  };
  total_briefs: number;
}

export interface CostSummary {
  total_cost_usd: number;
  total_tokens: number;
  total_calls: number;
  cost_by_model: Record<string, number>;
  cost_by_stage: Record<string, number>;
  parse_telemetry?: ParseTelemetry;
  pipeline_metrics?: PipelineMetricsData;
}

export interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

export interface TrustSignals {
  status: string;
  total_ads: number;
  signals: {
    score_distribution: {
      mean: number;
      std_dev: number;
      min: number;
      max: number;
    };
    evaluator_confidence: {
      average: number;
      low_confidence_count: number;
      total_evaluations: number;
    };
    compliance: {
      checked: number;
      pass_rate: number | null;
    };
    score_consistency: {
      avg_iteration_range: number;
      multi_iteration_ads: number;
    };
    dimension_agreement: {
      dimension_averages: Record<string, number>;
      dimension_spread: number;
    };
    readiness_status: Record<string, number>;
  };
  needs_review: Array<{
    brief_id: string;
    score: number;
    status: string;
    reasons: string[];
  }>;
}

export interface Presets {
  audiences: string[];
  goals: string[];
  offers: string[];
  tones: string[];
  ctas: string[];
}
