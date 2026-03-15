import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import MuiTooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import BalanceRoundedIcon from '@mui/icons-material/BalanceRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import RadarRoundedIcon from '@mui/icons-material/RadarRounded';
// BubbleChartRoundedIcon removed — no longer used
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AttachMoneyRoundedIcon from '@mui/icons-material/AttachMoneyRounded';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, Cell,
  CartesianGrid,
  LineChart, Line,
} from 'recharts';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import BiotechRoundedIcon from '@mui/icons-material/BiotechRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import { getAds, getCostSummary } from '../api/endpoints';
import api from '../api/client';
import { useSSE } from '../api/useSSE';
import AnimatedNumber from '../components/AnimatedNumber';
import type { AdResult, SSEEvent, ImageIteration } from '../types';

const getTooltipStyle = (isDark: boolean) => ({
  background: isDark ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)',
  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
  borderRadius: 10,
  color: isDark ? '#E2E8F0' : '#1E293B',
  backdropFilter: 'blur(10px)',
  fontSize: '0.82rem',
});

const DIMS = ['clarity', 'value_proposition', 'cta_strength', 'brand_voice', 'emotional_resonance'];
const DIM_LABELS: Record<string, string> = {
  clarity: 'Clarity', value_proposition: 'Value Prop', cta_strength: 'CTA',
  brand_voice: 'Brand Voice', emotional_resonance: 'Emotion',
};
const AUDIENCE_COLORS: Record<string, string> = { parents: '#F26522', students: '#10B981', families: '#F59E0B' };
const GOAL_COLORS: Record<string, string> = { conversion: '#F26522', awareness: '#10B981', consideration: '#F59E0B', engagement: '#EF4444' };

const IMG_DIMS = ['brand_consistency', 'engagement_potential', 'text_image_alignment'];
const IMG_DIM_LABELS: Record<string, string> = {
  brand_consistency: 'Brand', engagement_potential: 'Engagement', text_image_alignment: 'Alignment',
};
const IMG_DIM_COLORS: Record<string, string> = {
  brand_consistency: '#F26522', engagement_potential: '#10B981', text_image_alignment: '#F59E0B',
};

export default function Analysis() {
  usePageTitle('Evaluation');
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const tooltipStyle = useMemo(() => getTooltipStyle(isDark), [isDark]);
  const subtleBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const subtleBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const gridStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)';
  const faintBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const [ads, setAds] = useState<AdResult[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try { setFetchError(null); const res = await getAds(); setAds(res.data); }
    catch { setFetchError('Failed to load ads for analysis'); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  const handleEvent = useCallback((e: SSEEvent) => {
    if (['brief_complete', 'pipeline_complete'].includes(e.type)) refresh();
  }, [refresh]);
  useSSE(handleEvent);

  // === Compute analytics (all hooks run unconditionally; useMemos handle empty ads) ===
  const safeAds = useMemo(() => ads ?? [], [ads]);

  // Per-audience dimension radar comparison
  const audienceRadarData = useMemo(() => DIMS.map(d => {
    const entry: Record<string, string | number> = { dimension: DIM_LABELS[d] };
    Object.keys(AUDIENCE_COLORS).forEach(seg => {
      const segAds = safeAds.filter(a => a.brief.audience_segment === seg);
      const scores = segAds.map(a => a.copy_iterations[a.best_copy_index].evaluation.scores[d]?.score || 0);
      entry[seg] = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
    });
    return entry;
  }), [safeAds]);

  // Score & Cost by Audience (horizontal bar)
  const audienceStats = useMemo(() => Object.entries(AUDIENCE_COLORS).map(([seg, color]) => {
    const segAds = safeAds.filter(a => a.brief.audience_segment === seg);
    const avgScore = segAds.length ? segAds.reduce((s, a) => s + a.copy_iterations[a.best_copy_index].evaluation.weighted_average, 0) / segAds.length : 0;
    const avgCost = segAds.length ? segAds.reduce((s, a) => s + (a.total_cost_usd || 0), 0) / segAds.length : 0;
    return { segment: seg, avgScore: +avgScore.toFixed(2), avgCost: +avgCost.toFixed(5), count: segAds.length, color };
  }), [safeAds]);

  // Iteration efficiency: how much does each iteration improve score?
  const iterDeltas = useMemo(() => {
    const deltas: { iter: string; avgDelta: number; count: number }[] = [];
    const maxIters = safeAds.length ? Math.max(...safeAds.map(a => a.copy_iterations.length)) : 0;
    for (let i = 1; i < maxIters; i++) {
      const d = safeAds
        .filter(a => a.copy_iterations.length > i)
        .map(a => a.copy_iterations[i].evaluation.weighted_average - a.copy_iterations[i - 1].evaluation.weighted_average);
      if (d.length) {
        deltas.push({
          iter: `${i} → ${i + 1}`,
          avgDelta: Number((d.reduce((a, b) => a + b, 0) / d.length).toFixed(3)),
          count: d.length,
        });
      }
    }
    return deltas;
  }, [safeAds]);

  // Marginal cost per iteration: how much $ does each extra iteration cost vs score lift?
  const marginalCostData = useMemo(() => {
    const data: { iter: string; avgCost: number; avgLift: number; avgEfficiency: number; count: number }[] = [];
    const maxIters = safeAds.length ? Math.max(...safeAds.map(a => a.copy_iterations.length)) : 0;
    for (let i = 1; i < maxIters; i++) {
      const eligible = safeAds.filter(a => a.copy_iterations.length > i);
      if (!eligible.length) continue;
      const costs: number[] = [];
      const lifts: number[] = [];
      eligible.forEach(a => {
        const curCost = a.copy_iterations[i].costs.reduce((s, c) => s + c.cost_usd, 0);
        const scoreLift = a.copy_iterations[i].evaluation.weighted_average - a.copy_iterations[i - 1].evaluation.weighted_average;
        costs.push(curCost);
        lifts.push(scoreLift);
      });
      const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
      const avgLift = lifts.reduce((a, b) => a + b, 0) / lifts.length;
      data.push({
        iter: `Iter ${i + 1}`,
        avgCost: Number((avgCost * 1000).toFixed(3)), // in millicents for readability
        avgLift: Number(avgLift.toFixed(3)),
        avgEfficiency: avgCost > 0 ? Number((avgLift / (avgCost * 1000)).toFixed(2)) : 0,
        count: eligible.length,
      });
    }
    return data;
  }, [safeAds]);

  // Diversity analysis across ads
  const diversityStats = useMemo(() => {
    const withDiversity = safeAds.filter(a => a.diversity);
    if (!withDiversity.length) return null;
    const scores = withDiversity.map(a => a.diversity!.diversity_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const issueCount = withDiversity.reduce((s, a) => s + a.diversity!.issues.length, 0);
    const errorCount = withDiversity.reduce((s, a) => s + a.diversity!.issues.filter(i => i.severity === 'error').length, 0);
    const diverseCount = withDiversity.filter(a => a.diversity!.is_diverse).length;
    // Most common similar pairs
    const pairCounts: Record<string, number> = {};
    withDiversity.forEach(a => {
      if (a.diversity!.most_similar_id) {
        const pair = [a.brief_id, a.diversity!.most_similar_id].sort().join('↔');
        pairCounts[pair] = (pairCounts[pair] || 0) + 1;
      }
    });
    const topPairs = Object.entries(pairCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { avgScore, issueCount, errorCount, diverseCount, total: withDiversity.length, topPairs };
  }, [safeAds]);

  // Campaign goal comparison
  const goalStats = useMemo(() => {
    const goalStats: Record<string, { count: number; avgScore: number; avgCost: number }> = {};
    safeAds.forEach(a => {
      const g = a.brief.campaign_goal;
      if (!goalStats[g]) goalStats[g] = { count: 0, avgScore: 0, avgCost: 0 };
      goalStats[g].count++;
      goalStats[g].avgScore += a.copy_iterations[a.best_copy_index].evaluation.weighted_average;
      goalStats[g].avgCost += a.total_cost_usd;
    });
    Object.values(goalStats).forEach(s => { s.avgScore /= s.count; s.avgCost /= s.count; });
    return goalStats;
  }, [safeAds]);

  // Dimension correlation: which dimensions are most correlated with high overall scores?
  const dimCorrelations = useMemo(() => DIMS.map(d => {
    const pairs = safeAds.map(a => {
      const best = a.copy_iterations[a.best_copy_index];
      return { dim: best.evaluation.scores[d]?.score || 0, overall: best.evaluation.weighted_average };
    });
    const n = pairs.length;
    if (n < 2) return { dim: d, label: DIM_LABELS[d], correlation: 0 };
    const meanX = pairs.reduce((s, p) => s + p.dim, 0) / n;
    const meanY = pairs.reduce((s, p) => s + p.overall, 0) / n;
    const num = pairs.reduce((s, p) => s + (p.dim - meanX) * (p.overall - meanY), 0);
    const denX = Math.sqrt(pairs.reduce((s, p) => s + (p.dim - meanX) ** 2, 0));
    const denY = Math.sqrt(pairs.reduce((s, p) => s + (p.overall - meanY) ** 2, 0));
    const r = denX && denY ? num / (denX * denY) : 0;
    return { dim: d, label: DIM_LABELS[d], correlation: Number(r.toFixed(3)) };
  }).sort((a, b) => b.correlation - a.correlation), [safeAds]);

  // Best and worst ads
  const { bestAd, worstAd, bestScore, worstScore } = useMemo(() => {
    if (safeAds.length === 0) return { bestAd: null, worstAd: null, bestScore: 0, worstScore: 0 };
    const sorted = [...safeAds].sort((a, b) =>
      b.copy_iterations[b.best_copy_index].evaluation.weighted_average -
      a.copy_iterations[a.best_copy_index].evaluation.weighted_average
    );
    const bestAd = sorted[0];
    const worstAd = sorted[sorted.length - 1];
    const bestScore = bestAd.copy_iterations[bestAd.best_copy_index].evaluation.weighted_average;
    const worstScore = worstAd.copy_iterations[worstAd.best_copy_index].evaluation.weighted_average;
    return { bestAd, worstAd, bestScore, worstScore };
  }, [safeAds]);

  if (fetchError) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={800} gutterBottom>Analysis</Typography>
        <Alert severity="error" sx={{ borderRadius: '12px' }}
          action={<Button color="inherit" size="small" onClick={refresh}>Retry</Button>}
        >
          {fetchError}
        </Alert>
      </Box>
    );
  }

  if (ads === null) {
    return (
      <Box>
        <Skeleton variant="rounded" height={100} animation="wave" sx={{ mb: 3.5, borderRadius: '20px' }} />
        <Grid container spacing={3}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid size={{ xs: 12, md: 6 }} key={i}>
              <Skeleton variant="rounded" height={280} animation="wave" sx={{ borderRadius: '12px' }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (ads.length === 0) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={800} gutterBottom>Analysis</Typography>
        <Paper sx={{ py: 10, textAlign: 'center' }}>
          <InsightsRoundedIcon sx={{ fontSize: 48, color: 'rgba(242,101,34,0.15)', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No ads to analyze yet</Typography>
          <Typography variant="body2" color="text.secondary">Run the pipeline to generate ads first</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          mb: 3.5, p: 3.5, borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(242,101,34,0.06) 0%, rgba(16,185,129,0.03) 100%)',
          border: '1px solid rgba(242,101,34,0.1)',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,101,34,0.06), transparent 70%)' }} />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #F26522, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <InsightsRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Cross-Ad Analysis</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Deep insights across {ads.length} generated ads · Identify patterns, strengths, and opportunities
          </Typography>
        </Box>
      </Box>

      {/* Key Insights Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{
            p: 0, overflow: 'hidden',
            background: isDark
              ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0.04) 100%)'
              : 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #10B981, #059669)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
                }}>
                  <EmojiEventsRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
                </Box>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#10B981', fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                  BEST PERFORMING AD
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#10B981', lineHeight: 1.1 }}>
                <AnimatedNumber value={bestScore} decimals={1} suffix="/10" />
              </Typography>
              <Typography variant="body2" noWrap sx={{ mt: 1, fontSize: '0.8rem', fontWeight: 600, color: isDark ? '#E2E8F0' : '#1E293B' }}>
                {bestAd!.copy_iterations[bestAd!.best_copy_index].ad_copy.headline}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                <Chip label={bestAd!.brief.audience_segment} size="small" sx={{ fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(16,185,129,0.15)', color: '#10B981', textTransform: 'capitalize' }} />
                <Chip label={bestAd!.brief.campaign_goal} size="small" sx={{ fontSize: '0.65rem', fontWeight: 600, bgcolor: 'rgba(16,185,129,0.08)', color: '#10B981', textTransform: 'capitalize' }} />
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{
            p: 0, overflow: 'hidden',
            background: isDark
              ? 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.04) 100%)'
              : 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 100%)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
                }}>
                  <TrendingUpRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
                </Box>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#F59E0B', fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                  NEEDS IMPROVEMENT
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#F59E0B', lineHeight: 1.1 }}>
                <AnimatedNumber value={worstScore} decimals={1} suffix="/10" />
              </Typography>
              <Typography variant="body2" noWrap sx={{ mt: 1, fontSize: '0.8rem', fontWeight: 600, color: isDark ? '#E2E8F0' : '#1E293B' }}>
                {worstAd!.copy_iterations[worstAd!.best_copy_index].ad_copy.headline}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                <Chip label={worstAd!.brief.audience_segment} size="small" sx={{ fontSize: '0.65rem', fontWeight: 700, bgcolor: 'rgba(245,158,11,0.15)', color: '#F59E0B', textTransform: 'capitalize' }} />
                <Chip label={worstAd!.brief.campaign_goal} size="small" sx={{ fontSize: '0.65rem', fontWeight: 600, bgcolor: 'rgba(245,158,11,0.08)', color: '#F59E0B', textTransform: 'capitalize' }} />
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{
            p: 0, overflow: 'hidden',
            background: isDark
              ? 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.04) 100%)'
              : 'linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(99,102,241,0.02) 100%)',
            border: '1px solid rgba(139,92,246,0.2)',
          }}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                }}>
                  <BalanceRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
                </Box>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#8B5CF6', fontSize: '0.65rem', letterSpacing: '0.08em' }}>
                  SCORE SPREAD
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={800} sx={{ color: '#8B5CF6', lineHeight: 1.1 }}>
                <AnimatedNumber value={bestScore - worstScore} decimals={1} suffix=" pts" />
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, fontSize: '0.8rem', fontWeight: 600, color: isDark ? '#E2E8F0' : '#1E293B' }}>
                Range: {worstScore.toFixed(1)} — {bestScore.toFixed(1)}
              </Typography>
              <Box sx={{ mt: 1.5 }}>
                <Chip
                  label={bestScore - worstScore < 1 ? 'Very consistent quality' : bestScore - worstScore < 2 ? 'Good consistency' : 'High variance — review outliers'}
                  size="small"
                  sx={{
                    fontSize: '0.65rem', fontWeight: 700,
                    bgcolor: bestScore - worstScore < 1 ? 'rgba(16,185,129,0.15)' : bestScore - worstScore < 2 ? 'rgba(139,92,246,0.15)' : 'rgba(239,68,68,0.15)',
                    color: bestScore - worstScore < 1 ? '#10B981' : bestScore - worstScore < 2 ? '#8B5CF6' : '#EF4444',
                  }}
                />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Audience Comparison Radar */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{
            p: 3, height: '100%',
            border: `1px solid ${faintBorder}`,
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.04)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <RadarRoundedIcon sx={{ fontSize: 20, color: '#F26522' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                Audience Dimension Comparison
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '0.72rem' }}>
              Average scores per dimension, broken down by audience segment
            </Typography>
            {/* Custom legend with colored dots */}
            <Box sx={{ display: 'flex', gap: 2, mb: 1, justifyContent: 'center' }}>
              {Object.entries(AUDIENCE_COLORS).map(([seg, color]) => (
                <Box key={seg} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, boxShadow: `0 0 6px ${color}60` }} />
                  <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize', color: isDark ? '#CBD5E1' : '#475569' }}>{seg}</Typography>
                </Box>
              ))}
            </Box>
            <ResponsiveContainer width="100%" height={370}>
              <RadarChart data={audienceRadarData} cx="50%" cy="50%" outerRadius="78%">
                <PolarGrid stroke={faintBorder} strokeWidth={1} />
                <PolarAngleAxis dataKey="dimension" tick={{ fill: isDark ? '#94A3B8' : '#475569', fontSize: 12, fontWeight: 700 }} />
                <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#64748B', fontSize: 9 }} tickCount={6} axisLine={false} />
                {Object.entries(AUDIENCE_COLORS).map(([seg, color]) => (
                  <Radar key={seg} name={seg} dataKey={seg} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2.5} dot={{ r: 4, fill: color, strokeWidth: 2, stroke: isDark ? '#1E293B' : '#FFFFFF' }} />
                ))}
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Score & Cost by Audience */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{
            p: 3, height: '100%',
            border: `1px solid ${faintBorder}`,
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.04)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <LeaderboardRoundedIcon sx={{ fontSize: 20, color: '#F26522' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                Score & Cost by Audience
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.72rem' }}>
              Average quality score and cost per audience segment
            </Typography>
            <ResponsiveContainer width="100%" height={330}>
              <BarChart data={audienceStats} layout="vertical" margin={{ top: 5, right: 60, bottom: 5, left: 10 }}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 10]} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="segment" tick={{ fill: isDark ? '#CBD5E1' : '#475569', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={((v: unknown, name: unknown) => [Number(v).toFixed(2), String(name)]) as never}
                  labelFormatter={((label: unknown) => `${label} (${audienceStats.find(a => a.segment === String(label))?.count ?? 0} ads)`) as never}
                />
                <Bar dataKey="avgScore" name="Avg Score" radius={[0, 6, 6, 0]} barSize={32}
                  label={(((props: Record<string, unknown>) => {
                    const x = Number(props.x ?? 0);
                    const y = Number(props.y ?? 0);
                    const width = Number(props.width ?? 0);
                    const height = Number(props.height ?? 0);
                    const value = Number(props.value ?? 0);
                    const index = Number(props.index ?? 0);
                    const cost = audienceStats[index]?.avgCost ?? 0;
                    return (
                      <text x={x + width + 4} y={y + height / 2} dy={0} textAnchor="start" fontSize={11} fontWeight={700} fill={isDark ? '#CBD5E1' : '#475569'}>
                        {value.toFixed(1)} · ${cost.toFixed(4)}
                      </text>
                    );
                  }) as never)}
                >
                  {audienceStats.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Iteration Efficiency */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{
            p: 3, height: '100%',
            border: `1px solid ${faintBorder}`,
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.04)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <TimelineRoundedIcon sx={{ fontSize: 20, color: '#F26522' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                Iteration Efficiency
              </Typography>
            </Box>
            <MuiTooltip title="Shows average score improvement when moving from one iteration to the next. Positive values mean later iterations are improving quality." arrow>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontSize: '0.72rem', cursor: 'help', borderBottom: `1px dashed ${faintBorder}`, pb: 0.25, width: 'fit-content' }}>
                Average score change per iteration step. Are later iterations worth the cost?
              </Typography>
            </MuiTooltip>
            {iterDeltas.length === 0 ? (
              <Box sx={{ py: 5, textAlign: 'center' }}>
                <Box sx={{
                  width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 2,
                  background: isDark ? 'rgba(242,101,34,0.08)' : 'rgba(242,101,34,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <SpeedRoundedIcon sx={{ fontSize: 28, color: 'rgba(242,101,34,0.3)' }} />
                </Box>
                <Typography variant="body2" color="text.secondary" fontWeight={600}>Single-iteration ads</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', mt: 0.5, display: 'block' }}>Run with multiple iterations to see efficiency data</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {iterDeltas.map((d, idx) => {
                  const positive = d.avgDelta >= 0;
                  const color = positive ? '#10B981' : '#EF4444';
                  const matchingCost = marginalCostData.find(m => m.iter === `Iter ${idx + 2}`);
                  return (
                    <Box key={d.iter}>
                      {/* Before/After comparison boxes */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <Box sx={{
                          flex: 1, p: 1.5, borderRadius: '10px', textAlign: 'center',
                          bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                          border: `1px solid ${subtleBorder}`,
                        }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem', letterSpacing: '0.05em', fontWeight: 600 }}>
                            ITER {d.iter.split(' → ')[0]}
                          </Typography>
                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.9rem', color: isDark ? '#CBD5E1' : '#475569' }}>
                            Baseline
                          </Typography>
                        </Box>
                        <Box sx={{
                          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                          background: positive ? 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))' : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <ArrowForwardRoundedIcon sx={{ fontSize: 16, color }} />
                        </Box>
                        <Box sx={{
                          flex: 1, p: 1.5, borderRadius: '10px', textAlign: 'center',
                          bgcolor: positive ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                          border: `1px solid ${positive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem', letterSpacing: '0.05em', fontWeight: 600 }}>
                            ITER {d.iter.split(' → ')[1]}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            {positive ? (
                              <TrendingUpRoundedIcon sx={{ fontSize: 16, color }} />
                            ) : (
                              <TrendingDownRoundedIcon sx={{ fontSize: 16, color }} />
                            )}
                            <Typography variant="body2" fontWeight={800} sx={{ color, fontSize: '1rem' }}>
                              {positive ? '+' : ''}{d.avgDelta.toFixed(3)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      {/* Progress bar and meta */}
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(Math.abs(d.avgDelta) * 50, 100)}
                        sx={{
                          height: 8, borderRadius: 4,
                          bgcolor: subtleBg,
                          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 },
                        }}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                          {d.count} ad{d.count !== 1 ? 's' : ''} measured
                        </Typography>
                        {matchingCost && (
                          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: '#64748B' }}>
                            Avg cost: ${(matchingCost.avgCost / 1000).toFixed(5)}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Dimension Impact / Correlation */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{
            p: 3, height: '100%',
            border: `1px solid ${faintBorder}`,
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.04)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <LeaderboardRoundedIcon sx={{ fontSize: 20, color: '#F26522' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                Dimension Impact on Overall Score
              </Typography>
            </Box>
            <MuiTooltip title="Pearson correlation between each dimension score and the overall weighted average. Higher correlation means this dimension is more predictive of total ad quality." arrow>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontSize: '0.72rem', cursor: 'help', borderBottom: `1px dashed ${faintBorder}`, pb: 0.25, width: 'fit-content' }}>
                Correlation between each dimension and the weighted average. Higher = more predictive.
              </Typography>
            </MuiTooltip>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {dimCorrelations.map((d, i) => {
                const barColor = i === 0 ? '#10B981' : i === 1 ? '#34D399' : i === 2 ? '#6EE7B7' : i === 3 ? '#94A3B8' : '#CBD5E1';
                const RankIcon = i === 0 ? WorkspacePremiumRoundedIcon : i === 1 ? MilitaryTechRoundedIcon : i === 2 ? StarRoundedIcon : null;
                const rankBg = i === 0 ? 'linear-gradient(135deg, #FFD700, #FFA000)' : i === 1 ? 'linear-gradient(135deg, #C0C0C0, #9E9E9E)' : i === 2 ? 'linear-gradient(135deg, #CD7F32, #A0522D)' : '';
                const DIM_DESCRIPTIONS: Record<string, string> = {
                  clarity: 'How clear and understandable the ad message is',
                  value_proposition: 'How well the ad communicates unique value',
                  cta_strength: 'How compelling the call-to-action is',
                  brand_voice: 'How well the ad matches the brand tone',
                  emotional_resonance: 'How effectively the ad evokes emotion',
                };
                return (
                  <Box key={d.dim}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {RankIcon ? (
                          <Box sx={{
                            width: 26, height: 26, borderRadius: '8px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', background: rankBg,
                            boxShadow: i === 0 ? '0 2px 8px rgba(255,215,0,0.4)' : undefined,
                          }}>
                            <RankIcon sx={{ fontSize: 16, color: 'white' }} />
                          </Box>
                        ) : (
                          <Box sx={{ width: 26, height: 26, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: subtleBg, border: `1px solid ${subtleBorder}` }}>
                            <Typography variant="caption" fontWeight={800} sx={{ fontSize: '0.65rem', color: '#64748B' }}>{i + 1}</Typography>
                          </Box>
                        )}
                        <Box>
                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem', lineHeight: 1.2 }}>{d.label}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', lineHeight: 1.2 }}>
                            {DIM_DESCRIPTIONS[d.dim] || ''}
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="subtitle1" fontWeight={800} sx={{ color: barColor, fontSize: '1.05rem', minWidth: 55, textAlign: 'right' }}>
                        r={d.correlation.toFixed(2)}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.max(d.correlation * 100, 0)}
                      sx={{
                        height: 10, borderRadius: 5,
                        bgcolor: subtleBg,
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 5,
                          background: i === 0
                            ? 'linear-gradient(90deg, #10B981, #34D399)'
                            : i === 1
                            ? 'linear-gradient(90deg, #34D399, #6EE7B7)'
                            : i === 2
                            ? 'linear-gradient(90deg, #6EE7B7, #A7F3D0)'
                            : `linear-gradient(90deg, ${barColor}, ${barColor}80)`,
                        },
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>

        {/* Campaign Goal Performance */}
        <Grid size={12}>
          <Paper sx={{
            p: 3,
            border: `1px solid ${faintBorder}`,
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.04)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <CampaignRoundedIcon sx={{ fontSize: 20, color: '#F26522' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                Performance by Campaign Goal
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5, fontSize: '0.72rem' }}>
              Compare average quality scores and cost efficiency across different campaign objectives
            </Typography>
            <Grid container spacing={2.5}>
              {(() => {
                const goalEntries = Object.entries(goalStats);
                const maxScore = goalEntries.length ? Math.max(...goalEntries.map(([, s]) => s.avgScore)) : 0;
                return goalEntries.map(([goal, stats]) => {
                  const color = GOAL_COLORS[goal] || '#F26522';
                  const isBest = stats.avgScore === maxScore && goalEntries.length > 1;
                  const scorePerDollar = stats.avgCost > 0 ? stats.avgScore / stats.avgCost : 0;
                  const progressPct = stats.avgScore * 10;
                  return (
                    <Grid size={{ xs: 6, md: 3 }} key={goal}>
                      <Paper
                        sx={{
                          p: 0, overflow: 'hidden',
                          background: isDark
                            ? `linear-gradient(160deg, ${color}18 0%, ${color}06 100%)`
                            : `linear-gradient(160deg, ${color}10 0%, ${color}03 100%)`,
                          border: isBest ? `2px solid ${color}40` : `1px solid ${color}20`,
                          transition: 'all 0.25s ease',
                          '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 6px 24px ${color}18` },
                        }}
                      >
                        {isBest && (
                          <Box sx={{ bgcolor: color, py: 0.3, textAlign: 'center' }}>
                            <Typography variant="caption" fontWeight={800} sx={{ color: 'white', fontSize: '0.55rem', letterSpacing: '0.1em' }}>
                              TOP PERFORMER
                            </Typography>
                          </Box>
                        )}
                        <Box sx={{ p: 2.5, textAlign: 'center' }}>
                          <Typography variant="caption" fontWeight={700} sx={{ color, fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            {goal}
                          </Typography>
                          {/* Circular progress ring */}
                          <Box sx={{ position: 'relative', display: 'inline-flex', mt: 1.5, mb: 1 }}>
                            <CircularProgress
                              variant="determinate"
                              value={100}
                              size={72}
                              thickness={4}
                              sx={{ color: subtleBg, position: 'absolute' }}
                            />
                            <CircularProgress
                              variant="determinate"
                              value={progressPct}
                              size={72}
                              thickness={4}
                              sx={{ color, '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }}
                            />
                            <Box sx={{
                              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Typography variant="h5" fontWeight={800} sx={{ color, fontSize: '1.15rem' }}>
                                <AnimatedNumber value={stats.avgScore} decimals={1} />
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', fontWeight: 600, display: 'block' }}>
                              {stats.count} ad{stats.count !== 1 ? 's' : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mt: 0.5 }}>
                              <AttachMoneyRoundedIcon sx={{ fontSize: 13, color: '#64748B' }} />
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                                ${stats.avgCost.toFixed(4)} avg
                              </Typography>
                            </Box>
                            <MuiTooltip title="Quality score points per dollar spent — higher is more efficient" arrow>
                              <Chip
                                label={`${scorePerDollar.toFixed(0)} pts/$`}
                                size="small"
                                sx={{
                                  mt: 1, fontSize: '0.62rem', fontWeight: 700, height: 20,
                                  bgcolor: `${color}12`, color, border: `1px solid ${color}25`,
                                  cursor: 'help',
                                }}
                              />
                            </MuiTooltip>
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>
                  );
                });
              })()}
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* ========== MARGINAL COST & DIVERSITY ========== */}
      {(marginalCostData.length > 0 || diversityStats) && (
        <Grid container spacing={2.5} sx={{ mt: 0.5, mb: 3 }}>
          {/* Marginal Cost per Iteration */}
          {marginalCostData.length > 0 && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>
                  Marginal Cost of Improvement
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontSize: '0.7rem' }}>
                  Cost per iteration vs score lift — is spending more on iterations worth it?
                </Typography>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={marginalCostData} barGap={8}>
                    <CartesianGrid stroke={gridStroke} />
                    <XAxis dataKey="iter" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      yAxisId="cost"
                      orientation="left"
                      tick={{ fill: '#F26522', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'Cost (m$)', angle: -90, position: 'insideLeft', style: { fill: '#F26522', fontSize: 10 } }}
                    />
                    <YAxis
                      yAxisId="lift"
                      orientation="right"
                      tick={{ fill: '#10B981', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      label={{ value: 'Score Lift', angle: 90, position: 'insideRight', style: { fill: '#10B981', fontSize: 10 } }}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: '0.7rem' }} />
                    <Bar yAxisId="cost" dataKey="avgCost" name="Avg Cost (m$)" fill="#F26522" radius={[4, 4, 0, 0]} barSize={28} />
                    <Bar yAxisId="lift" dataKey="avgLift" name="Avg Score Lift" fill="#10B981" radius={[4, 4, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
                <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {marginalCostData.map(d => (
                    <Chip
                      key={d.iter}
                      label={`${d.iter}: ${d.avgLift >= 0 ? '+' : ''}${d.avgLift.toFixed(3)} pts / $${(d.avgCost / 1000).toFixed(5)}`}
                      size="small"
                      sx={{
                        fontSize: '0.65rem', fontWeight: 600,
                        bgcolor: d.avgLift > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: d.avgLift > 0 ? '#10B981' : '#EF4444',
                        border: `1px solid ${d.avgLift > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}
                    />
                  ))}
                </Box>
              </Paper>
            </Grid>
          )}

          {/* Creative Diversity */}
          {diversityStats && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>
                  Creative Diversity
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontSize: '0.7rem' }}>
                  How unique is each ad? Detects near-duplicates and convergent copy patterns.
                </Typography>
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid size={4}>
                    <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: '10px', bgcolor: diversityStats.avgScore >= 8 ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)' }}>
                      <Typography variant="h4" fontWeight={800} sx={{ color: diversityStats.avgScore >= 8 ? '#10B981' : '#F59E0B' }}>
                        {diversityStats.avgScore.toFixed(1)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Avg Score</Typography>
                    </Box>
                  </Grid>
                  <Grid size={4}>
                    <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: '10px', bgcolor: 'rgba(16,185,129,0.06)' }}>
                      <Typography variant="h4" fontWeight={800} sx={{ color: '#10B981' }}>
                        {diversityStats.diverseCount}/{diversityStats.total}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Unique</Typography>
                    </Box>
                  </Grid>
                  <Grid size={4}>
                    <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: '10px', bgcolor: diversityStats.errorCount > 0 ? 'rgba(239,68,68,0.06)' : 'rgba(16,185,129,0.06)' }}>
                      <Typography variant="h4" fontWeight={800} sx={{ color: diversityStats.errorCount > 0 ? '#EF4444' : '#10B981' }}>
                        {diversityStats.errorCount}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>Duplicates</Typography>
                    </Box>
                  </Grid>
                </Grid>
                {diversityStats.topPairs.length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.65rem', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
                      MOST SIMILAR PAIRS
                    </Typography>
                    {diversityStats.topPairs.map(([pair]) => {
                      const [a, b] = pair.split('↔');
                      const adA = safeAds.find(ad => ad.brief_id === a);
                      const adB = safeAds.find(ad => ad.brief_id === b);
                      const sim = adA?.diversity?.most_similar_score || adB?.diversity?.most_similar_score || 0;
                      return (
                        <Box key={pair} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                          <Chip label={a.replace('brief_', '#')} size="small" sx={{ fontSize: '0.6rem', fontWeight: 700, height: 20 }} />
                          <Typography variant="caption" color="text.secondary">↔</Typography>
                          <Chip label={b.replace('brief_', '#')} size="small" sx={{ fontSize: '0.6rem', fontWeight: 700, height: 20 }} />
                          <Chip
                            label={`${(sim * 100).toFixed(0)}% similar`}
                            size="small"
                            sx={{
                              fontSize: '0.6rem', fontWeight: 600, height: 20, ml: 'auto',
                              bgcolor: sim > 0.5 ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                              color: sim > 0.5 ? '#EF4444' : '#F59E0B',
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                )}
                {diversityStats.issueCount === 0 && (
                  <Box sx={{ py: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      All ads are sufficiently unique
                    </Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* ========== IMAGE ITERATION ANALYSIS ========== */}
      <ImageIterationAnalysis ads={ads} navigate={navigate} />

      {/* ========== CALIBRATION WORKBENCH ========== */}
      <CalibrationWorkbench ads={ads} />
    </Box>
  );
}

// ── Image Iteration Analysis Section ──────────────────────────────────
function ImageIterationAnalysis({ ads, navigate }: { ads: AdResult[]; navigate: (p: string) => void }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const tooltipStyle = useMemo(() => getTooltipStyle(isDark), [isDark]);
  const subtleBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const subtleBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const gridStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)';
  const faintBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const faintIcon = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const faintBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const { adsWithImages, allImages, accepted, rejected, avgAccepted, avgRejected, onDemandCount, hasMultiIteration } = useMemo(() => {
    const adsWithIterations = ads.filter(a => a.image_iterations.length > 0);
    const allImages: (ImageIteration & { briefId: string; isBest: boolean })[] = [];
    adsWithIterations.forEach(a => {
      a.image_iterations.forEach((img, idx) => {
        allImages.push({ ...img, briefId: a.brief_id, isBest: idx === a.best_image_index });
      });
    });
    const accepted = allImages.filter(i => i.isBest);
    const rejected = allImages.filter(i => !i.isBest);
    const avgAccepted = accepted.length ? accepted.reduce((s, i) => s + i.evaluation.average_score, 0) / accepted.length : 0;
    const avgRejected = rejected.length ? rejected.reduce((s, i) => s + i.evaluation.average_score, 0) / rejected.length : 0;
    // Count ads that have on-demand images but no iteration data
    const onDemandCount = ads.filter(a => a.image_iterations.length === 0).length;
    const hasMultiIteration = adsWithIterations.some(a => a.image_iterations.length > 1);
    return { adsWithImages: adsWithIterations, allImages, accepted, rejected, avgAccepted, avgRejected, onDemandCount, hasMultiIteration };
  }, [ads]);

  // Score progression across image iterations (avg at each iteration number)
  const imgProgressionData = useMemo(() => {
    const maxImgIters = adsWithImages.length ? Math.max(...adsWithImages.map(a => a.image_iterations.length)) : 0;
    return Array.from({ length: maxImgIters }, (_, i) => {
      const scoresAtIter = adsWithImages
        .filter(a => a.image_iterations.length > i)
        .map(a => a.image_iterations[i].evaluation.average_score);
      return {
        iteration: `V${i + 1}`,
        avgScore: scoresAtIter.length ? Number((scoresAtIter.reduce((a, b) => a + b, 0) / scoresAtIter.length).toFixed(2)) : 0,
      };
    });
  }, [adsWithImages]);

  // Avg dimension scores: accepted vs rejected
  const dimComparison = useMemo(() => IMG_DIMS.map(d => {
    const accScores = accepted.map(i => i.evaluation[d as keyof typeof i.evaluation] as number);
    const rejScores = rejected.map(i => i.evaluation[d as keyof typeof i.evaluation] as number);
    return {
      dimension: IMG_DIM_LABELS[d],
      accepted: accScores.length ? Number((accScores.reduce((a, b) => a + b, 0) / accScores.length).toFixed(1)) : 0,
      rejected: rejScores.length ? Number((rejScores.reduce((a, b) => a + b, 0) / rejScores.length).toFixed(1)) : 0,
    };
  }), [accepted, rejected]);

  // Per-iteration deltas
  const imgIterDeltas = useMemo(() => {
    const maxImgIters = adsWithImages.length ? Math.max(...adsWithImages.map(a => a.image_iterations.length)) : 0;
    const deltas: { iter: string; avgDelta: number; count: number }[] = [];
    for (let i = 1; i < maxImgIters; i++) {
      const d = adsWithImages
        .filter(a => a.image_iterations.length > i)
        .map(a => a.image_iterations[i].evaluation.average_score - a.image_iterations[i - 1].evaluation.average_score);
      if (d.length) {
        deltas.push({
          iter: `V${i} → V${i + 1}`,
          avgDelta: Number((d.reduce((a, b) => a + b, 0) / d.length).toFixed(3)),
          count: d.length,
        });
      }
    }
    return deltas;
  }, [adsWithImages]);

  // Weakest image dimension frequency
  const imgWeakest = useMemo(() => {
    const imgWeakest: Record<string, number> = {};
    allImages.forEach(img => {
      const e = img.evaluation;
      const dims = { brand_consistency: e.brand_consistency, engagement_potential: e.engagement_potential, text_image_alignment: e.text_image_alignment };
      const weakest = Object.entries(dims).reduce((a, b) => a[1] < b[1] ? a : b)[0];
      imgWeakest[weakest] = (imgWeakest[weakest] || 0) + 1;
    });
    return imgWeakest;
  }, [allImages]);

  return (
    <Box sx={{ mt: 4 }}>
      {/* Section Header */}
      <Box
        sx={{
          mb: 3, p: 3, borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(242,101,34,0.06) 0%, rgba(239,68,68,0.04) 100%)',
          border: '1px solid rgba(242,101,34,0.1)',
          display: 'flex', alignItems: 'center', gap: 1.5,
        }}
      >
        <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #EF4444, #F26522)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ImageRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
            Image Iteration Analysis
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
            {allImages.length > 0
              ? `${allImages.length} image${allImages.length !== 1 ? 's' : ''} across ${adsWithImages.length} ads${rejected.length > 0 ? ` \u00B7 ${accepted.length} accepted \u00B7 ${rejected.length} rejected` : ''}`
              : `${onDemandCount} ads with on-demand images`
            }
            {onDemandCount > 0 && allImages.length > 0 && ` \u00B7 ${onDemandCount} on-demand`}
          </Typography>
        </Box>
      </Box>

      {allImages.length === 0 ? (
        <Paper sx={{ py: 8, textAlign: 'center' }}>
          <PhotoLibraryRoundedIcon sx={{ fontSize: 48, color: 'rgba(242,101,34,0.12)', mb: 2 }} />
          {onDemandCount > 0 ? (
            <>
              <Typography variant="h6" color="text.secondary" fontWeight={600}>
                {onDemandCount} image{onDemandCount !== 1 ? 's' : ''} generated on-demand
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 420, mx: 'auto' }}>
                Images were generated individually per ad. Run the pipeline with multi-iteration image mode to see detailed iteration analysis, score progressions, and dimension comparisons.
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="h6" color="text.secondary" fontWeight={600}>No images generated yet</Typography>
              <Typography variant="body2" color="text.secondary">Generate images for ads to see iteration analysis</Typography>
            </>
          )}
        </Paper>
      ) : (
        <>
          {/* Image Stats Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2.5, textAlign: 'center', border: '1px solid rgba(242,101,34,0.12)' }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>TOTAL IMAGES</Typography>
                <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, color: '#F26522' }}><AnimatedNumber value={allImages.length} /></Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>across {adsWithImages.length} ads</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2.5, textAlign: 'center', border: '1px solid rgba(16,185,129,0.12)' }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>AVG SELECTED</Typography>
                <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, color: '#10B981' }}><AnimatedNumber value={avgAccepted} decimals={1} /></Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{accepted.length} images selected</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2.5, textAlign: 'center', border: rejected.length > 0 ? '1px solid rgba(239,68,68,0.12)' : '1px solid rgba(16,185,129,0.12)' }}>
                {rejected.length > 0 ? (
                  <>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>AVG REJECTED</Typography>
                    <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, color: '#EF4444' }}><AnimatedNumber value={avgRejected} decimals={1} /></Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{rejected.length} images discarded</Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>ITERATIONS / AD</Typography>
                    <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, color: '#10B981' }}>
                      <AnimatedNumber value={adsWithImages.length > 0 ? allImages.length / adsWithImages.length : 0} decimals={1} />
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>avg per ad</Typography>
                  </>
                )}
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper sx={{ p: 2.5, textAlign: 'center', border: rejected.length > 0 ? '1px solid rgba(255,217,61,0.12)' : '1px solid rgba(16,185,129,0.12)' }}>
                {rejected.length > 0 ? (
                  <>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>REJECTION RATE</Typography>
                    <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, color: '#F59E0B' }}>
                      <AnimatedNumber value={allImages.length ? Math.round(rejected.length / allImages.length * 100) : 0} suffix="%" />
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {rejected.length} of {allImages.length}
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.6rem', letterSpacing: '0.05em' }}>STATUS</Typography>
                    <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                      <CheckCircleRoundedIcon sx={{ fontSize: 28, color: '#10B981' }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', mt: 0.5, display: 'block' }}>All images accepted</Typography>
                  </>
                )}
              </Paper>
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            {/* Image Score Progression */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>Image Score Progression</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.7rem' }}>
                  Average image score at each iteration across all ads
                </Typography>
                {imgProgressionData.length <= 1 ? (
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 40, color: 'rgba(242,101,34,0.15)', mb: 1.5 }} />
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      Single iteration per ad
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', mt: 0.5, display: 'block' }}>
                      No progression data — enable multi-iteration image generation to track improvement
                    </Typography>
                    {imgProgressionData.length === 1 && (
                      <Chip
                        label={`Avg score: ${imgProgressionData[0].avgScore.toFixed(1)}/10`}
                        size="small"
                        sx={{ mt: 1.5, fontWeight: 700, fontSize: '0.72rem', bgcolor: 'rgba(242,101,34,0.08)', color: '#F26522', border: '1px solid rgba(242,101,34,0.2)' }}
                      />
                    )}
                  </Box>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={imgProgressionData}>
                      <CartesianGrid stroke={gridStroke} />
                      <XAxis dataKey="iteration" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[5, 10]} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Line type="monotone" dataKey="avgScore" stroke="#F26522" strokeWidth={2.5} dot={{ fill: '#F26522', r: 6, strokeWidth: 2, stroke: '#FFFFFF' }} name="Avg Score" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>

            {/* Accepted vs Rejected Dimension Comparison */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>
                  {rejected.length > 0 ? 'Accepted vs Rejected Dimensions' : 'Image Dimension Scores'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.7rem' }}>
                  {rejected.length > 0
                    ? 'What separates selected images from rejected ones'
                    : 'Average dimension scores across all selected images'}
                </Typography>
                {rejected.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dimComparison} barGap={4}>
                      <XAxis dataKey="dimension" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 10]} tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                      <Bar dataKey="accepted" fill="#10B981" fillOpacity={0.7} radius={[4, 4, 0, 0]} barSize={28} name="Accepted" />
                      <Bar dataKey="rejected" fill="#EF4444" fillOpacity={0.5} radius={[4, 4, 0, 0]} barSize={28} name="Rejected" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <Box sx={{ py: 1.5, px: 2, borderRadius: '10px', bgcolor: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                      <CheckCircleRoundedIcon sx={{ fontSize: 20, color: '#10B981' }} />
                      <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#10B981', fontWeight: 600 }}>
                        All images accepted on first iteration
                      </Typography>
                    </Box>
                    {dimComparison.map(d => {
                      const score = d.accepted;
                      const color = score >= 8 ? '#10B981' : score >= 6 ? '#F26522' : '#F59E0B';
                      return (
                        <Box key={d.dimension}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>{d.dimension}</Typography>
                            <Typography variant="subtitle2" fontWeight={800} sx={{ color, fontSize: '0.9rem' }}>{score.toFixed(1)}</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={score * 10} sx={{ height: 6, borderRadius: 3, bgcolor: subtleBg, '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }} />
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Image Iteration Efficiency */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>Image Iteration Efficiency</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontSize: '0.7rem' }}>
                  Average score change between image iterations
                </Typography>
                {imgIterDeltas.length === 0 ? (
                  <Box sx={{ py: 5, textAlign: 'center' }}>
                    <SpeedRoundedIcon sx={{ fontSize: 40, color: 'rgba(242,101,34,0.15)', mb: 1.5 }} />
                    <Typography variant="body2" color="text.secondary" fontWeight={600}>
                      {hasMultiIteration ? 'Not enough data' : 'Single iteration per image'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', mt: 0.5, display: 'block' }}>
                      {hasMultiIteration ? 'Need more multi-iteration ads for efficiency analysis' : 'Enable multi-iteration image generation to measure improvement between versions'}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {imgIterDeltas.map(d => {
                      const positive = d.avgDelta >= 0;
                      const color = positive ? '#10B981' : '#EF4444';
                      return (
                        <Box key={d.iter}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label={d.iter} size="small" sx={{ fontWeight: 700, fontSize: '0.68rem', bgcolor: subtleBg, border: `1px solid ${subtleBorder}` }} />
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>({d.count} ads)</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {positive ? <TrendingUpRoundedIcon sx={{ fontSize: 16, color }} /> : <TrendingDownRoundedIcon sx={{ fontSize: 16, color }} />}
                              <Typography variant="subtitle2" fontWeight={800} sx={{ color, fontSize: '0.95rem' }}>
                                {positive ? '+' : ''}{d.avgDelta.toFixed(2)}
                              </Typography>
                            </Box>
                          </Box>
                          <LinearProgress variant="determinate" value={Math.min(Math.abs(d.avgDelta) * 30, 100)} sx={{ height: 6, borderRadius: 3, bgcolor: subtleBg, '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }} />
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Weakest Image Dimension */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>Weakest Image Dimensions</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontSize: '0.7rem' }}>
                  Which dimension is most often the lowest scoring across all images
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {IMG_DIMS.map(d => {
                    const count = imgWeakest[d] || 0;
                    const pct = allImages.length ? (count / allImages.length * 100) : 0;
                    const color = IMG_DIM_COLORS[d];
                    return (
                      <Box key={d}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.85rem' }}>{IMG_DIM_LABELS[d]}</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{count}/{allImages.length}</Typography>
                            <Chip label={`${pct.toFixed(0)}%`} size="small" sx={{ fontWeight: 700, fontSize: '0.6rem', height: 18, minWidth: 40, bgcolor: `${color}15`, color, border: `1px solid ${color}30` }} />
                          </Box>
                        </Box>
                        <LinearProgress variant="determinate" value={pct} sx={{ height: 6, borderRadius: 3, bgcolor: subtleBg, '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }} />
                      </Box>
                    );
                  })}
                </Box>
              </Paper>
            </Grid>

            {/* All Image Iterations — Visual Grid */}
            <Grid size={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                  <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>All Image Iterations</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Every generated image — click to view ad detail
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      icon={<CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} />}
                      label={rejected.length > 0 ? `${accepted.length} accepted` : `${allImages.length} images`}
                      size="small"
                      sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }}
                    />
                    {rejected.length > 0 && (
                      <Chip icon={<CancelRoundedIcon sx={{ fontSize: '14px !important' }} />} label={`${rejected.length} rejected`} size="small" sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }} />
                    )}
                  </Box>
                </Box>

                <Grid container spacing={2}>
                  {allImages.map((img) => {
                    const { average_score, brand_consistency, engagement_potential, text_image_alignment } = img.evaluation;
                    const scoreColor = average_score >= 8 ? '#10B981' : average_score >= 6 ? '#F26522' : average_score >= 4 ? '#F59E0B' : '#EF4444';
                    return (
                      <Grid size={{ xs: 6, sm: 4, md: 3 }} key={`${img.briefId}-${img.iteration_number}`}>
                        <Paper
                          onClick={() => navigate(`/ads/${img.briefId}`)}
                          sx={{
                            overflow: 'hidden', cursor: 'pointer',
                            border: img.isBest ? '2px solid rgba(16,185,129,0.3)' : `1px solid ${faintBorder}`,
                            bgcolor: img.isBest ? 'rgba(16,185,129,0.02)' : undefined,
                            transition: 'all 0.2s',
                            '&:hover': { borderColor: img.isBest ? 'rgba(16,185,129,0.5)' : 'rgba(242,101,34,0.25)', transform: 'translateY(-2px)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
                          }}
                        >
                          {/* Image with score overlay */}
                          <Box sx={{ position: 'relative' }}>
                            {img.image_url ? (
                              <Box component="img" src={img.image_url} alt={`${img.briefId} V${img.iteration_number}`}
                                sx={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <Box sx={{ width: '100%', height: 180, bgcolor: faintBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ImageRoundedIcon sx={{ fontSize: 36, color: faintIcon }} />
                              </Box>
                            )}
                            {/* Score overlay badge */}
                            <Box sx={{
                              position: 'absolute', top: 8, right: 8,
                              bgcolor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                              borderRadius: '8px', px: 1, py: 0.25,
                              display: 'flex', alignItems: 'center', gap: 0.5,
                            }}>
                              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: scoreColor, boxShadow: `0 0 6px ${scoreColor}80` }} />
                              <Typography variant="caption" fontWeight={800} sx={{ color: '#FFFFFF', fontSize: '0.75rem' }}>{average_score.toFixed(1)}</Typography>
                            </Box>
                            {/* Status badge */}
                            {rejected.length > 0 && (
                              <Box sx={{
                                position: 'absolute', top: 8, left: 8,
                                bgcolor: img.isBest ? 'rgba(16,185,129,0.85)' : 'rgba(239,68,68,0.75)',
                                backdropFilter: 'blur(4px)', borderRadius: '6px', px: 0.75, py: 0.15,
                              }}>
                                <Typography variant="caption" fontWeight={700} sx={{ color: '#FFFFFF', fontSize: '0.55rem', letterSpacing: '0.04em' }}>
                                  {img.isBest ? 'SELECTED' : 'REJECTED'}
                                </Typography>
                              </Box>
                            )}
                          </Box>

                          <Box sx={{ p: 1.5 }}>
                            {/* Brief ID label */}
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
                                {img.briefId.replace('brief_', '#')}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.62rem' }}>V{img.iteration_number}</Typography>
                            </Box>

                            {/* Dimension bars */}
                            {[
                              { label: 'Brand', score: brand_consistency },
                              { label: 'Engage', score: engagement_potential },
                              { label: 'Align', score: text_image_alignment },
                            ].map(({ label, score }) => {
                              const c = score >= 8 ? '#10B981' : score >= 6 ? '#F26522' : score >= 4 ? '#F59E0B' : '#EF4444';
                              return (
                                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', minWidth: 40 }}>{label}</Typography>
                                  <LinearProgress variant="determinate" value={score * 10} sx={{ flex: 1, height: 3, borderRadius: 2, bgcolor: subtleBg, '& .MuiLinearProgress-bar': { bgcolor: c, borderRadius: 2 } }} />
                                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6rem', color: c, minWidth: 20, textAlign: 'right' }}>{score.toFixed(1)}</Typography>
                                </Box>
                              );
                            })}

                            {/* Feedback snippet */}
                            {img.evaluation.rationale && (
                              <Typography variant="caption" color="text.secondary" sx={{
                                mt: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                overflow: 'hidden', fontSize: '0.65rem', lineHeight: 1.5, borderTop: `1px solid ${subtleBg}`, pt: 0.75,
                              }}>
                                {img.evaluation.rationale}
                              </Typography>
                            )}
                          </Box>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}


// ── Calibration Workbench ──────────────────────────────────────────────
interface CalibrationEntry {
  source_file: string;
  brief_id: string;
  headline: string;
  weighted_average: number;
  weakest_dimension: string;
  scores: Record<string, number>;
  total_cost_usd: number;
  expected_scores?: Record<string, number>;
  deviations?: Record<string, number>;
}

interface CalibrationRunResult {
  status: string;
  message?: string;
  results: CalibrationEntry[];
  aggregate: { count: number; avg_weighted_score?: number };
}

function CalibrationWorkbench({ ads }: { ads: AdResult[] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const subtleBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const faintBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const [telemetry, setTelemetry] = useState<Record<string, number> | null>(null);
  const [resetting, setResetting] = useState(false);
  const [calibError, setCalibError] = useState<string | null>(null);
  const [calibRunning, setCalibRunning] = useState(false);
  const [calibResult, setCalibResult] = useState<CalibrationRunResult | null>(null);

  useEffect(() => {
    getCostSummary().then(res => {
      if (res.data?.parse_telemetry) {
        setTelemetry(res.data.parse_telemetry as unknown as Record<string, number>);
      }
    }).catch(() => { setCalibError('Failed to load calibration data'); });
  }, []);

  const handleResetTelemetry = async () => {
    setResetting(true);
    setCalibError(null);
    try {
      const res = await api.post('/costs/reset-telemetry');
      setTelemetry(res.data?.telemetry ?? null);
    } catch { setCalibError('Failed to reset telemetry'); }
    setResetting(false);
  };

  const handleRunCalibration = async () => {
    setCalibRunning(true);
    setCalibError(null);
    try {
      const res = await api.post('/calibration/run');
      setCalibResult(res.data as CalibrationRunResult);
    } catch { setCalibError('Calibration run failed'); }
    setCalibRunning(false);
  };

  const totalParses = telemetry
    ? Object.values(telemetry).reduce((a, b) => a + b, 0)
    : 0;
  const successRate = telemetry && totalParses > 0
    ? ((telemetry.json_ok ?? 0) / totalParses * 100)
    : 0;

  const dimScoresByAudience = useMemo(() => {
    const result: Record<string, Record<string, number[]>> = {};
    ads.forEach(a => {
      const seg = a.brief.audience_segment;
      if (!result[seg]) result[seg] = {};
      const best = a.copy_iterations[a.best_copy_index];
      DIMS.forEach(d => {
        if (!result[seg][d]) result[seg][d] = [];
        result[seg][d].push(best.evaluation.scores[d]?.score ?? 0);
      });
    });
    return result;
  }, [ads]);

  return (
    <Box sx={{ mt: 4 }}>
      <Box
        sx={{
          mb: 3, p: 3, borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(16,185,129,0.04) 100%)',
          border: '1px solid rgba(139,92,246,0.12)',
          display: 'flex', alignItems: 'center', gap: 1.5,
        }}
      >
        <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #8B5CF6, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BiotechRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
            Calibration Workbench
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
            Monitor evaluator health, parse reliability, and score consistency
          </Typography>
        </Box>
      </Box>

      {calibError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setCalibError(null)}>
          {calibError}
        </Alert>
      )}

      <Grid container spacing={2.5}>
        {/* Parse Telemetry */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                Evaluator Parse Health
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<BiotechRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={handleRunCalibration}
                  disabled={calibRunning}
                  sx={{
                    fontSize: '0.7rem', fontWeight: 700, textTransform: 'none',
                    bgcolor: '#8B5CF6',
                    '&:hover': { bgcolor: '#7C3AED' },
                  }}
                >
                  {calibRunning ? 'Running…' : 'Run Calibration'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<RestartAltRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={handleResetTelemetry}
                  disabled={resetting}
                  sx={{
                    fontSize: '0.7rem', fontWeight: 700, textTransform: 'none',
                    borderColor: 'rgba(139,92,246,0.3)', color: '#8B5CF6',
                    '&:hover': { borderColor: '#8B5CF6', bgcolor: 'rgba(139,92,246,0.06)' },
                  }}
                >
                  Reset Counters
                </Button>
              </Box>
            </Box>

            {telemetry ? (
              totalParses === 0 ? (
                <Box sx={{ py: 3, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#94A3B8', fontWeight: 600, mb: 1 }}>
                    No evaluation data
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.72rem', display: 'block', maxWidth: 340, mx: 'auto' }}>
                    Parse telemetry populates during pipeline runs. Run a batch to see evaluator health metrics.
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={800} sx={{ color: successRate >= 90 ? '#10B981' : successRate >= 70 ? '#F59E0B' : '#EF4444' }}>
                        {successRate.toFixed(0)}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        Parse Success
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={800} sx={{ color: '#64748B' }}>
                        {totalParses}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        Total Parses
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {[
                      { key: 'json_ok', label: 'Clean JSON', color: '#10B981' },
                      { key: 'json_extract_fallback', label: 'JSON Extract Fallback', color: '#F59E0B' },
                      { key: 'regex_fallback', label: 'Regex Fallback', color: '#F26522' },
                      { key: 'default_fallback', label: 'Default Fallback', color: '#EF4444' },
                    ].map(({ key, label, color }) => {
                      const count = telemetry[key] ?? 0;
                      const pct = totalParses > 0 ? (count / totalParses * 100) : 0;
                      return (
                        <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Typography variant="body2" sx={{ fontSize: '0.82rem', minWidth: 140, color: 'text.secondary' }}>
                            {label}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              flex: 1, height: 6, borderRadius: 3,
                              bgcolor: subtleBg,
                              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                            }}
                          />
                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem', color, minWidth: 30, textAlign: 'right' }}>
                            {count}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )
            ) : (
              <Typography variant="body2" color="text.secondary">Loading telemetry...</Typography>
            )}
          </Paper>
        </Grid>

        {/* Score Consistency Analysis */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>
              Score Consistency by Audience
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontSize: '0.7rem' }}>
              Standard deviation of scores per dimension. Lower = more consistent evaluator.
            </Typography>
            {Object.keys(dimScoresByAudience).length === 0 ? (
              <Typography variant="body2" color="text.secondary">No data yet</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {Object.entries(dimScoresByAudience).map(([seg, dims]) => {
                  const color = AUDIENCE_COLORS[seg] || '#F26522';
                  return (
                    <Box key={seg}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.85rem', textTransform: 'capitalize', color, mb: 1 }}>
                        {seg}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {DIMS.map(d => {
                          const scores = dims[d] || [];
                          if (scores.length < 2) return null;
                          const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
                          const stddev = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length);
                          const stdColor = stddev < 0.5 ? '#10B981' : stddev < 1 ? '#F59E0B' : '#EF4444';
                          return (
                            <Chip
                              key={d}
                              label={`${DIM_LABELS[d]}: σ=${stddev.toFixed(2)}`}
                              size="small"
                              sx={{
                                fontWeight: 700, fontSize: '0.62rem', height: 22,
                                bgcolor: `${stdColor}10`, color: stdColor,
                                border: `1px solid ${stdColor}25`,
                              }}
                            />
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Calibration Run Results */}
      {calibResult && calibResult.results.length > 0 && (
        <Paper sx={{ p: 3, mt: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
              Calibration Results
            </Typography>
            <Chip
              label={`${calibResult.aggregate.count} ads · avg ${calibResult.aggregate.avg_weighted_score?.toFixed(1)}/10`}
              size="small"
              sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: 'rgba(139,92,246,0.1)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.2)' }}
            />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {calibResult.results.map((r, i) => {
              const scoreColor = r.weighted_average >= 8 ? '#10B981' : r.weighted_average >= 6 ? '#F26522' : '#EF4444';
              return (
                <Paper key={i} sx={{ p: 2, border: `1px solid ${faintBorder}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>
                        {r.headline || r.brief_id}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        {r.source_file} · weakest: {r.weakest_dimension}
                      </Typography>
                    </Box>
                    <Typography variant="h6" fontWeight={800} sx={{ color: scoreColor, fontSize: '1.1rem' }}>
                      {r.weighted_average.toFixed(1)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                    {Object.entries(r.scores).map(([dim, score]) => {
                      const dev = r.deviations?.[dim];
                      const c = score >= 8 ? '#10B981' : score >= 6 ? '#F26522' : '#EF4444';
                      return (
                        <Chip
                          key={dim}
                          label={`${DIM_LABELS[dim] || dim}: ${score.toFixed(1)}${dev !== undefined ? ` (${dev > 0 ? '+' : ''}${dev.toFixed(1)})` : ''}`}
                          size="small"
                          sx={{ fontWeight: 600, fontSize: '0.6rem', height: 20, bgcolor: `${c}10`, color: c, border: `1px solid ${c}25` }}
                        />
                      );
                    })}
                  </Box>
                </Paper>
              );
            })}
          </Box>
        </Paper>
      )}

      {calibResult && calibResult.results.length === 0 && calibResult.status === 'no_reference_ads' && (
        <Alert severity="info" sx={{ mt: 2, borderRadius: '12px' }}>
          {calibResult.message || 'No reference ads found. Add JSON files to data/reference_ads/ to enable calibration runs.'}
        </Alert>
      )}
    </Box>
  );
}
