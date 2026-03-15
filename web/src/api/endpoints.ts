import api from './client';
import { getClientId } from './clientId';
import type { AdResult, PipelineStatus, CostSummary, StepCost, Presets, ComplianceResult, DiversityResult, TrustSignals } from '../types';

export const getAds = (params?: { sort_by?: string; min_score?: number; audience?: string }) =>
  api.get<AdResult[]>('/ads', { params: { ...params, client_id: getClientId() } });

export const getAd = (briefId: string) =>
  api.get<AdResult>(`/ads/${briefId}`, { params: { client_id: getClientId() } });

export const generateImage = (briefId: string, forceRegenerate = false) =>
  api.post(`/ads/${briefId}/generate-image`, {
    client_id: getClientId(),
    force_regenerate: forceRegenerate,
  });

export const startPipeline = (mode: string, count: number, imageMode: string, customBrief?: { audience: string; goal: string; offer: string; tone: string }) =>
  api.post('/pipeline/run', { mode, count, image_mode: imageMode, custom_brief: customBrief });

export const stopPipeline = () =>
  api.post('/pipeline/stop');

export const getPipelineStatus = () =>
  api.get<PipelineStatus>('/pipeline/status');

export const getCostSummary = () =>
  api.get<CostSummary>('/costs/summary');

export const getCostLedger = () =>
  api.get<StepCost[]>('/costs/ledger');

export const getPresets = () =>
  api.get<Presets>('/briefs/presets');

export interface RunHistoryEntry {
  timestamp: string;
  total_ads: number;
  avg_score: number;
  pass_rate: number;
  total_cost: number;
  elapsed_seconds: number;
  brief_ids: string[];
}

export const getRunHistory = () =>
  api.get<RunHistoryEntry[]>('/pipeline/history');

export const refineAd = (briefId: string, instruction: string) =>
  api.post(`/ads/${briefId}/refine`, {
    instruction,
    client_id: getClientId(),
  });

export const checkCompliance = (briefId: string) =>
  api.post<ComplianceResult>(`/ads/${briefId}/compliance`);

export const checkDiversity = (briefId: string) =>
  api.post<DiversityResult>(`/ads/${briefId}/diversity`);

export const generateVariants = (briefId: string) =>
  api.post(`/ads/${briefId}/variants`);

export const getConfig = () =>
  api.get<EngineConfig>('/config');

export const updateModels = (models: Partial<Record<string, string>>) =>
  api.patch('/config/models', models);

export const updatePipeline = (settings: Partial<{ max_copy_iterations: number; max_image_iterations: number; quality_threshold: number; early_stop_threshold: number }>) =>
  api.patch('/config/pipeline', settings);

export const approveAd = (briefId: string, approvedBy: string, notes?: string) =>
  api.post(`/ads/${briefId}/approve`, { approved_by: approvedBy, notes: notes || '' });

export const rejectAd = (briefId: string, rejectedBy: string, reason: string) =>
  api.post(`/ads/${briefId}/reject`, { rejected_by: rejectedBy, reason });

export const markExperimentReady = (briefId: string) =>
  api.post(`/ads/${briefId}/mark-experiment-ready`);

export const getTrustSignals = () =>
  api.get<TrustSignals>('/trust');

export interface EngineConfig {
  models: Record<string, string>;
  temperatures: Record<string, number>;
  max_output_tokens: number;
  pipeline: {
    max_copy_iterations: number;
    max_image_iterations: number;
    quality_threshold: number;
    early_stop_threshold: number;
  };
  dimension_weights: Record<string, number>;
  cost_per_token: Record<string, { input: number; output: number; per_image?: number }>;
  brand: {
    name: string;
    voice: string;
    principles: string[];
  };
  available_models: {
    text: string[];
    vision: string[];
    image: string[];
  };
  image_generation_enabled: boolean;
  image_cost_per_image: number;
}
