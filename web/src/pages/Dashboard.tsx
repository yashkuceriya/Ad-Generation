import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import PipelineProgress from '../components/PipelineProgress';
import PipelineFlow from '../components/PipelineFlow';
import ScoreChip from '../components/ScoreChip';
import AnimatedNumber from '../components/AnimatedNumber';
import { getAds, getPipelineStatus, getCostSummary } from '../api/endpoints';
import { useSSE } from '../api/useSSE';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, CartesianGrid, Legend, ReferenceLine, ReferenceArea,
} from 'recharts';
import type { AdResult, PipelineStatus, CostSummary, SSEEvent } from '../types';

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAdsJSON(ads: AdResult[]) {
  downloadFile(JSON.stringify(ads, null, 2), 'dashboard-ads-export.json', 'application/json');
}

const DIMS = ['clarity', 'value_proposition', 'cta_strength', 'brand_voice', 'emotional_resonance'];
const DIM_LABELS: Record<string, string> = {
  clarity: 'Clarity', value_proposition: 'Value Prop', cta_strength: 'CTA',
  brand_voice: 'Brand Voice', emotional_resonance: 'Emotion',
};
const DIM_COLORS: Record<string, string> = {
  clarity: '#F26522', value_proposition: '#10B981', cta_strength: '#F59E0B',
  brand_voice: '#EF4444', emotional_resonance: '#8B5CF6',
};
const PASSING_STATUSES = ['published', 'evaluator_pass', 'compliance_pass', 'human_approved', 'experiment_ready'];

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(242, 101, 34, 0); }
  50% { box-shadow: 0 0 16px 2px rgba(242, 101, 34, 0.12); }
`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;


/* ---------- Section Header ---------- */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{
        fontSize: '0.6rem',
        letterSpacing: '0.1em',
        mb: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        '&::before': {
          content: '""',
          width: 3,
          height: 14,
          borderRadius: 2,
          background: 'linear-gradient(180deg, #F26522, #10B981)',
          flexShrink: 0,
        },
      }}
    >
      {children}
    </Typography>
  );
}

/* ---------- Stat Card ---------- */
function StatCard({ title, value, subtitle, icon, gradient, pulsing, accentColor, animDelay = 0, extra }: {
  title: string; value: React.ReactNode; subtitle?: string;
  icon: React.ReactNode; gradient: string; pulsing?: boolean;
  accentColor?: string; animDelay?: number; extra?: React.ReactNode;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      sx={{
        p: 3, position: 'relative', overflow: 'hidden', borderRadius: '16px',
        animation: pulsing ? `${pulseGlow} 2.5s ease-in-out infinite, ${fadeInUp} 0.6s ease-out both` : `${fadeInUp} 0.6s ease-out both`,
        animationDelay: pulsing ? `0s, ${animDelay}s` : `${animDelay}s`,
        transition: 'transform 0.25s ease, box-shadow 0.3s ease',
        background: isDark
          ? `linear-gradient(135deg, ${accentColor || '#F26522'}12 0%, transparent 60%)`
          : `linear-gradient(135deg, ${accentColor || '#F26522'}08 0%, transparent 60%)`,
        border: `1px solid ${isDark ? `${accentColor || '#F26522'}20` : `${accentColor || '#F26522'}12`}`,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDark
            ? `0 8px 32px ${accentColor || '#F26522'}15`
            : `0 8px 32px ${accentColor || '#F26522'}12`,
        },
        '&::before': {
          content: '""', position: 'absolute', top: 0, right: 0,
          width: 140, height: 140, borderRadius: '50%',
          background: gradient, opacity: 0.07, transform: 'translate(30%, -30%)',
        },
        '&::after': {
          content: '""', position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 3, background: gradient, opacity: 0.6,
          borderRadius: '0 0 16px 16px',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.6rem', letterSpacing: '0.08em', fontWeight: 700 }}>{title}</Typography>
          <Typography variant="h3" fontWeight={800} sx={{ mt: 0.25, fontSize: '2.2rem', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block', fontSize: '0.72rem', lineHeight: 1.4 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 48, height: 48, borderRadius: '14px',
            background: gradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 12px ${accentColor || '#F26522'}30`,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      </Box>
      {extra}
    </Paper>
  );
}

/* ---------- Chart Wrapper ---------- */
function ChartCard({ title, subtitle, children, headerRight }: {
  title: string; subtitle?: string; children: React.ReactNode; headerRight?: React.ReactNode;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      sx={{
        p: 3, height: '100%', borderRadius: '16px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
        transition: 'box-shadow 0.3s ease',
        '&:hover': {
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.3)'
            : '0 8px 32px rgba(0,0,0,0.06)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem', letterSpacing: '-0.01em' }}>{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.72rem', mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {headerRight}
      </Box>
      {children}
    </Paper>
  );
}

export default function Dashboard() {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const TOOLTIP_STYLE = {
    background: isDark ? 'rgba(26,29,39,0.98)' : 'rgba(255,255,255,0.98)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 10,
    color: isDark ? '#E2E8F0' : '#1E293B',
    backdropFilter: 'blur(10px)',
    fontSize: '0.82rem',
  };
  const [ads, setAds] = useState<AdResult[]>([]);
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'info' } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [adsRes, statusRes, costRes] = await Promise.all([
        getAds(), getPipelineStatus(), getCostSummary(),
      ]);
      setAds(adsRes.data);
      setStatus(statusRes.data);
      setCostSummary(costRes.data);
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Debounced refresh for SSE events — avoids hammering server with parallel fetches
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => { refresh(); }, 200);
  }, [refresh]);

  useEffect(() => {
    return () => { if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current); };
  }, []);

  const handleEvent = useCallback((event: SSEEvent) => {
    if ([
      'brief_complete', 'pipeline_complete', 'pipeline_stopped',
      'copy_iteration_complete', 'image_iteration_complete',
      'image_generated', 'brief_started',
    ].includes(event.type)) {
      // Immediate refresh for major milestones, debounced for iterations
      if (event.type === 'pipeline_complete' || event.type === 'pipeline_stopped') {
        refresh();
      } else {
        debouncedRefresh();
      }
    }
  }, [refresh, debouncedRefresh]);

  useSSE(handleEvent);

  const isRunning = status?.status === 'running';

  // === Derived analytics ===
  const { validAds, scores, avgScore, passingCount, belowCount, passRate, medianScore } = useMemo(() => {
    const validAds = ads.filter(a => a.copy_iterations.length > 0);
    const scores = validAds.map(a => a.copy_iterations[a.best_copy_index].evaluation.weighted_average);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const passingCount = ads.filter(a => PASSING_STATUSES.includes(a.status ?? '')).length;
    const belowCount = ads.filter(a => a.status === 'below_threshold').length;
    const passRate = ads.length ? Math.round(passingCount / ads.length * 100) : 0;
    const sorted = [...scores].sort((a, b) => a - b);
    const medianScore = sorted.length
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;
    return { validAds, scores, avgScore, passingCount, belowCount, passRate, medianScore };
  }, [ads]);

  // Score histogram
  const histData = useMemo(() => {
    const data = Array.from({ length: 10 }, (_, i) => ({ range: `${i + 1}`, count: 0 }));
    scores.forEach(s => { const idx = Math.min(Math.floor(s) - 1, 9); if (idx >= 0) data[idx].count++; });
    return data;
  }, [scores]);

  // Average dimension scores across all ads
  const { dimAverages, radarData } = useMemo(() => {
    const dimAverages: Record<string, number> = {};
    DIMS.forEach(d => {
      const vals = validAds.map(a => a.copy_iterations[a.best_copy_index].evaluation.scores[d]?.score || 0);
      dimAverages[d] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });
    const radarData = DIMS.map(d => ({ dimension: DIM_LABELS[d], score: Number(dimAverages[d].toFixed(1)), fullMark: 10 }));
    return { dimAverages, radarData };
  }, [validAds]);

  // Weakest dimension frequency
  const weakestData = useMemo(() => {
    const weakestCount: Record<string, number> = {};
    validAds.forEach(a => {
      const w = a.copy_iterations[a.best_copy_index].evaluation.weakest_dimension;
      weakestCount[w] = (weakestCount[w] || 0) + 1;
    });
    return DIMS.map(d => ({ name: DIM_LABELS[d], count: weakestCount[d] || 0, color: DIM_COLORS[d] }))
      .sort((a, b) => b.count - a.count);
  }, [validAds]);

  // Score improvement across iterations (how much did iterating help?)
  const { avgImprovement, improvedPct } = useMemo(() => {
    const deltas = validAds.map(a => {
      const iters = a.copy_iterations;
      if (iters.length <= 1) return 0;
      return iters[iters.length - 1].evaluation.weighted_average - iters[0].evaluation.weighted_average;
    });
    const avgImprovement = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    const multiIterAds = validAds.filter(a => a.copy_iterations.length > 1);
    const improvedCount = multiIterAds.filter(a => {
      const iters = a.copy_iterations;
      return iters[iters.length - 1].evaluation.weighted_average > iters[0].evaluation.weighted_average;
    }).length;
    const improvedPct = multiIterAds.length > 0 ? Math.round((improvedCount / multiIterAds.length) * 100) : 0;
    return { avgImprovement, improvedPct };
  }, [validAds]);

  // Iteration progression data (avg score at each iteration number)
  const iterProgressionData = useMemo(() => {
    const maxIters = Math.max(...validAds.map(a => a.copy_iterations.length), 0);
    return Array.from({ length: maxIters }, (_, i) => {
      const scoresAtIter = validAds
        .filter(a => a.copy_iterations.length > i)
        .map(a => a.copy_iterations[i].evaluation.weighted_average);
      return {
        iteration: `Iter ${i + 1}`,
        avgScore: scoresAtIter.length ? Number((scoresAtIter.reduce((a, b) => a + b, 0) / scoresAtIter.length).toFixed(2)) : 0,
        minScore: scoresAtIter.length ? Number(Math.min(...scoresAtIter).toFixed(2)) : 0,
        maxScore: scoresAtIter.length ? Number(Math.max(...scoresAtIter).toFixed(2)) : 0,
      };
    });
  }, [validAds]);

  // Audience breakdown
  const audienceStats = useMemo(() => {
    const audienceStats: Record<string, { count: number; avgScore: number; avgCost: number }> = {};
    validAds.forEach(a => {
      const seg = a.brief.audience_segment;
      if (!audienceStats[seg]) audienceStats[seg] = { count: 0, avgScore: 0, avgCost: 0 };
      audienceStats[seg].count++;
      audienceStats[seg].avgScore += a.copy_iterations[a.best_copy_index].evaluation.weighted_average;
      audienceStats[seg].avgCost += a.total_cost_usd;
    });
    Object.values(audienceStats).forEach(s => { s.avgScore /= s.count; s.avgCost /= s.count; });
    return audienceStats;
  }, [validAds]);

  const AUDIENCE_COLORS: Record<string, string> = { parents: '#F26522', students: '#10B981', families: '#F59E0B' };

  if (initialLoading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={180} animation="wave" sx={{ mb: 4, borderRadius: '20px' }} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid size={{ xs: 6, md: 3 }} key={i}>
              <Skeleton variant="rounded" height={120} animation="wave" sx={{ borderRadius: '16px' }} />
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={2.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid size={{ xs: 12, md: 6 }} key={i}>
              <Skeleton variant="rounded" height={300} animation="wave" sx={{ borderRadius: '16px' }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {fetchError && (
        <Alert
          severity="error"
          variant="outlined"
          action={<Button size="small" onClick={refresh} sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Retry</Button>}
          sx={{ mb: 2, borderRadius: '12px' }}
        >
          Failed to load data. Make sure the backend is running.
        </Alert>
      )}
      {/* Hero */}
      <Box
        sx={{
          mb: 3, p: { xs: 3, md: 4 }, borderRadius: '20px', position: 'relative', overflow: 'hidden',
          background: isDark
            ? 'linear-gradient(135deg, rgba(242,101,34,0.12) 0%, rgba(16,185,129,0.06) 50%, rgba(30,30,40,0.8) 100%)'
            : 'linear-gradient(135deg, rgba(242,101,34,0.06) 0%, rgba(16,185,129,0.04) 50%, rgba(255,255,255,0.8) 100%)',
          border: `1px solid ${isDark ? 'rgba(242,101,34,0.2)' : 'rgba(242,101,34,0.12)'}`,
        }}
      >
        <Box sx={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,101,34,0.08), transparent 70%)' }} />
        <Box sx={{ position: 'absolute', bottom: -80, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.06), transparent 70%)' }} />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography variant="overline" sx={{ color: '#F26522', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em' }}>AUTONOMOUS AD ENGINE</Typography>
            {isRunning && (
              <Chip
                label="LIVE"
                size="small"
                sx={{
                  height: 18, fontSize: '0.55rem', fontWeight: 800,
                  bgcolor: 'rgba(16,185,129,0.15)', color: '#10B981',
                  animation: `${pulseGlow} 2s ease-in-out infinite`,
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            )}
          </Box>
          <Typography variant="h3" fontWeight={800} sx={{ mt: 0.5, mb: 1, letterSpacing: '-0.02em' }}>
            Varsity Tutors
            <Box component="span" sx={{ background: 'linear-gradient(135deg, #F26522, #10B981)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', ml: 1.5 }}>SAT Prep</Box>
          </Typography>

          {/* Quick summary stats line */}
          {ads.length > 0 && (
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, mb: 2.5, flexWrap: 'wrap',
              }}
            >
              <Chip
                label={`${ads.length} ads generated`}
                size="small"
                sx={{
                  fontWeight: 700, fontSize: '0.75rem', height: 26,
                  bgcolor: isDark ? 'rgba(242,101,34,0.12)' : 'rgba(242,101,34,0.08)',
                  color: '#F26522',
                  border: '1px solid rgba(242,101,34,0.2)',
                }}
              />
              <Chip
                label={`${passRate}% pass rate`}
                size="small"
                sx={{
                  fontWeight: 700, fontSize: '0.75rem', height: 26,
                  bgcolor: passRate >= 80 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  color: passRate >= 80 ? '#10B981' : '#F59E0B',
                  border: `1px solid ${passRate >= 80 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                }}
              />
              {costSummary && costSummary.total_cost_usd > 0 && (
                <Chip
                  label={`$${costSummary.total_cost_usd.toFixed(2)} total cost`}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: '0.75rem', height: 26,
                    bgcolor: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.06)',
                    color: '#8B5CF6',
                    border: '1px solid rgba(139,92,246,0.2)',
                  }}
                />
              )}
              {medianScore > 0 && (
                <Chip
                  label={`${medianScore.toFixed(1)} median score`}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: '0.75rem', height: 26,
                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    color: 'text.secondary',
                  }}
                />
              )}
            </Box>
          )}

          {ads.length === 0 && (
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mb: 2.5, lineHeight: 1.6 }}>
              Generate, evaluate, and iterate high-performance Facebook & Instagram ads using AI-driven feedback loops.
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<RocketLaunchRoundedIcon />}
              onClick={() => navigate('/run')}
              sx={{
                px: 4, py: 1.5,
                background: 'linear-gradient(135deg, #F26522, #D4541A)',
                fontSize: '0.95rem', fontWeight: 700, borderRadius: '14px',
                boxShadow: '0 4px 20px rgba(242,101,34,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #FF8A50, #F26522)', boxShadow: '0 6px 28px rgba(242,101,34,0.45)', transform: 'translateY(-1px)' },
                transition: 'all 0.25s ease',
              }}
            >
              Launch Pipeline
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<AutoAwesomeRoundedIcon />}
              onClick={() => navigate('/ads')}
              sx={{
                px: 4, py: 1.5, fontSize: '0.95rem', fontWeight: 700, borderRadius: '14px',
                borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                color: 'text.primary',
                '&:hover': { borderColor: '#F26522', bgcolor: 'rgba(242,101,34,0.04)', transform: 'translateY(-1px)' },
                transition: 'all 0.25s ease',
              }}
            >
              View Gallery
            </Button>
            <Button
              variant="text"
              size="small"
              startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => { exportAdsJSON(ads); setSnack({ message: `Exported ${ads.length} ads as JSON`, severity: 'success' }); }}
              disabled={ads.length === 0}
              sx={{
                ml: 'auto', fontSize: '0.8rem', textTransform: 'none',
                color: '#F26522', fontWeight: 600,
                '&:hover': { bgcolor: 'rgba(242,101,34,0.06)' },
              }}
            >
              Export Data
            </Button>
            <Button
              variant="text"
              size="small"
              startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                const topAds = [...ads]
                  .sort((a, b) => b.copy_iterations[b.best_copy_index].evaluation.weighted_average - a.copy_iterations[a.best_copy_index].evaluation.weighted_average)
                  .slice(0, 5);
                const pkg = {
                  generated_at: new Date().toISOString(),
                  summary: {
                    total_ads: ads.length,
                    avg_score: avgScore.toFixed(2),
                    pass_rate: `${passRate}%`,
                    total_cost: costSummary?.total_cost_usd?.toFixed(4) ?? '—',
                  },
                  top_ads: topAds.map(a => ({
                    brief_id: a.brief_id,
                    audience: a.brief.audience_segment,
                    goal: a.brief.campaign_goal,
                    headline: a.copy_iterations[a.best_copy_index].ad_copy.headline,
                    primary_text: a.copy_iterations[a.best_copy_index].ad_copy.primary_text,
                    description: a.copy_iterations[a.best_copy_index].ad_copy.description,
                    cta: a.copy_iterations[a.best_copy_index].ad_copy.cta_button,
                    score: a.copy_iterations[a.best_copy_index].evaluation.weighted_average,
                    iterations: a.copy_iterations.length,
                    cost: a.total_cost_usd,
                  })),
                };
                downloadFile(JSON.stringify(pkg, null, 2), 'nerdy-review-package.json', 'application/json');
                setSnack({ message: 'Review package exported', severity: 'success' });
              }}
              disabled={ads.length === 0}
              sx={{
                fontSize: '0.8rem', textTransform: 'none',
                color: '#10B981', fontWeight: 600,
                '&:hover': { bgcolor: 'rgba(16,185,129,0.06)' },
              }}
            >
              Review Package
            </Button>
          </Box>
        </Box>
      </Box>

      {status && status.status !== 'idle' && (
        <Box sx={{ mb: 3 }}>
          <PipelineFlow currentPhase={status.current_phase} isRunning={status.status === 'running'} />
          <PipelineProgress status={status} />
        </Box>
      )}

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            title="Total Ads"
            value={<AnimatedNumber value={ads.length} />}
            subtitle={ads.length === 1 ? '1 ad generated' : `${ads.length} ads generated`}
            icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 22, color: 'white' }} />}
            gradient="linear-gradient(135deg, #3B82F6, #1D4ED8)"
            accentColor="#3B82F6"
            pulsing={isRunning}
            animDelay={0.1}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            title="Avg Score"
            value={avgScore ? <AnimatedNumber value={avgScore} decimals={1} suffix="/10" /> : '—'}
            subtitle={avgScore ? `${avgScore >= 7 ? 'Above' : 'Below'} passing threshold (7.0)` : 'out of 10'}
            icon={<SpeedRoundedIcon sx={{ fontSize: 22, color: 'white' }} />}
            gradient={`linear-gradient(135deg, ${avgScore >= 7 ? '#10B981, #059669' : '#F59E0B, #D97706'})`}
            accentColor={avgScore >= 7 ? '#10B981' : '#F59E0B'}
            pulsing={isRunning}
            animDelay={0.2}
            extra={scores.length >= 2 ? (
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress variant="determinate" value={100} size={40} thickness={3} sx={{ color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', position: 'absolute' }} />
                  <CircularProgress variant="determinate" value={avgScore * 10} size={40} thickness={3} sx={{ color: avgScore >= 7 ? '#10B981' : avgScore >= 5 ? '#F59E0B' : '#EF4444', '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }} />
                </Box>
                <ResponsiveContainer width={60} height={24}>
                  <LineChart data={scores.map((v, i) => ({ v, i }))}>
                    <Line type="monotone" dataKey="v" stroke={avgScore >= 7 ? '#10B981' : '#F59E0B'} strokeWidth={1.5} dot={false} isAnimationActive={true} animationDuration={800} />
                  </LineChart>
                </ResponsiveContainer>
                {avgScore >= 7 && (
                  <Chip label={`+${(avgScore - 7).toFixed(1)} above threshold`} size="small"
                    sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981', fontWeight: 700, fontSize: '0.6rem', height: 20 }} />
                )}
              </Box>
            ) : undefined}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            title="Pass Rate"
            value={ads.length ? <AnimatedNumber value={passRate} suffix="%" /> : '—'}
            subtitle={ads.length ? `${passingCount} passing · ${belowCount} below threshold` : 'score >= 7.0'}
            icon={<CheckCircleRoundedIcon sx={{ fontSize: 22, color: 'white' }} />}
            gradient={`linear-gradient(135deg, ${passRate >= 80 ? '#10B981, #059669' : '#F59E0B, #D97706'})`}
            accentColor={passRate >= 80 ? '#10B981' : '#F59E0B'}
            pulsing={isRunning}
            animDelay={0.3}
            extra={ads.length > 0 ? (
              <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress variant="determinate" value={100} size={40} thickness={3} sx={{ color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', position: 'absolute' }} />
                  <CircularProgress variant="determinate" value={passRate} size={40} thickness={3} sx={{ color: passRate >= 80 ? '#10B981' : passRate >= 50 ? '#F59E0B' : '#EF4444', '& .MuiCircularProgress-circle': { strokeLinecap: 'round' } }} />
                </Box>
              </Box>
            ) : undefined}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            title={belowCount > 0 ? 'Below Threshold' : 'Avg Improvement'}
            value={belowCount > 0
              ? <AnimatedNumber value={belowCount} />
              : (ads.length ? <AnimatedNumber value={avgImprovement} decimals={2} prefix="+" /> : '—')
            }
            subtitle={belowCount > 0
              ? `${belowCount} ad${belowCount !== 1 ? 's' : ''} need attention`
              : 'from iteration 1 to best'
            }
            icon={belowCount > 0
              ? <WarningAmberRoundedIcon sx={{ fontSize: 22, color: 'white' }} />
              : <TrendingUpRoundedIcon sx={{ fontSize: 22, color: 'white' }} />
            }
            gradient={belowCount > 0
              ? 'linear-gradient(135deg, #EF4444, #DC2626)'
              : 'linear-gradient(135deg, #10B981, #059669)'
            }
            accentColor={belowCount > 0 ? '#EF4444' : '#10B981'}
            pulsing={isRunning}
            animDelay={0.4}
            extra={avgImprovement !== 0 && belowCount === 0 ? (
              <Box sx={{ mt: 1 }}>
                <Chip
                  icon={avgImprovement > 0 ? <TrendingUpRoundedIcon sx={{ fontSize: 12, color: '#10B981 !important' }} /> : <TrendingDownRoundedIcon sx={{ fontSize: 12, color: '#EF4444 !important' }} />}
                  label={`${avgImprovement > 0 ? '+' : ''}${avgImprovement.toFixed(2)} avg lift`}
                  size="small"
                  sx={{
                    fontWeight: 700, fontSize: '0.6rem', height: 20,
                    bgcolor: avgImprovement > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: avgImprovement > 0 ? '#10B981' : '#EF4444',
                  }}
                />
              </Box>
            ) : undefined}
          />
        </Grid>
      </Grid>

      {/* Cost Overview */}
      {costSummary && costSummary.total_calls > 0 && (
        <Box sx={{ mb: 3 }}>
          <SectionHeader>PIPELINE COSTS</SectionHeader>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Total Spend"
                value={<AnimatedNumber value={costSummary.total_cost_usd} decimals={4} prefix="$" />}
                subtitle={`${costSummary.total_calls} API calls`}
                icon={<Typography sx={{ fontSize: 18, fontWeight: 800, color: 'white' }}>$</Typography>}
                gradient="linear-gradient(135deg, #EF4444, #DC2626)"
                accentColor="#EF4444"
                pulsing={isRunning}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Total Tokens"
                value={costSummary.total_tokens >= 1000 ? <AnimatedNumber value={costSummary.total_tokens / 1000} decimals={1} suffix="K" /> : <AnimatedNumber value={costSummary.total_tokens} />}
                subtitle="input + output"
                icon={<Typography sx={{ fontSize: 14, fontWeight: 800, color: 'white' }}>Tk</Typography>}
                gradient="linear-gradient(135deg, #F59E0B, #D97706)"
                accentColor="#F59E0B"
                pulsing={isRunning}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Avg Cost/Ad"
                value={ads.length ? <AnimatedNumber value={costSummary.total_cost_usd / ads.length} decimals={4} prefix="$" /> : '—'}
                subtitle="per generated ad"
                icon={<Typography sx={{ fontSize: 14, fontWeight: 800, color: 'white' }}>/ad</Typography>}
                gradient="linear-gradient(135deg, #F26522, #FF8A50)"
                accentColor="#F26522"
                pulsing={isRunning}
              />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <StatCard
                title="Avg Calls/Ad"
                value={ads.length ? <AnimatedNumber value={costSummary.total_calls / ads.length} decimals={1} /> : '—'}
                subtitle="generate + eval + refine"
                icon={<Typography sx={{ fontSize: 14, fontWeight: 800, color: 'white' }}>#</Typography>}
                gradient="linear-gradient(135deg, #10B981, #059669)"
                accentColor="#10B981"
                pulsing={isRunning}
              />
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Pipeline Health Metrics */}
      {costSummary?.pipeline_metrics && costSummary.pipeline_metrics.total_briefs > 0 && (() => {
        const pm = costSummary.pipeline_metrics;
        return (
          <Box sx={{ mb: 3 }}>
            <SectionHeader>PIPELINE HEALTH</SectionHeader>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.55rem' }}>EARLY STOP RATE</Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 0.25, color: pm.early_stopping.early_stop_rate >= 50 ? '#10B981' : '#F59E0B' }}>
                    {pm.early_stopping.early_stop_rate}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {pm.early_stopping.exceptional} exceptional · {pm.early_stopping.threshold} threshold · {pm.early_stopping.full_iterations} full
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.55rem' }}>BATCH EVAL SUCCESS</Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 0.25, color: pm.eval_mode.batch_success_rate >= 90 ? '#10B981' : '#EF4444' }}>
                    {pm.eval_mode.batch_success_rate}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {pm.eval_mode.batched_ok} batched · {pm.eval_mode.batched_fallback} fallback
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.55rem' }}>ITERATION DISTRIBUTION</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'flex-end' }}>
                    {Object.entries(pm.iteration_distribution).sort(([a], [b]) => Number(a) - Number(b)).map(([iter, count]) => {
                      const maxCount = Math.max(...Object.values(pm.iteration_distribution));
                      const height = maxCount > 0 ? (Number(count) / maxCount) * 48 : 0;
                      return (
                        <Box key={iter} sx={{ flex: 1, textAlign: 'center' }}>
                          <Box sx={{ height: Math.max(height, 4), bgcolor: '#F26522', borderRadius: '4px 4px 0 0', opacity: 0.8, mx: 'auto', width: '80%' }} />
                          <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 700, display: 'block', mt: 0.5 }}>{count}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.5rem' }}>iter {iter}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Paper sx={{ p: 2.5, borderRadius: '16px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.55rem' }}>IMAGE CACHE</Typography>
                  {pm.image_cache.total > 0 ? (
                    <>
                      <Typography variant="h4" fontWeight={800} sx={{ mt: 0.25, color: pm.image_cache.hit_rate >= 50 ? '#10B981' : '#F59E0B' }}>
                        {pm.image_cache.hit_rate}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {pm.image_cache.hits} hits · {pm.image_cache.misses} misses
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography variant="h4" fontWeight={800} sx={{ mt: 0.25, color: '#6B7280' }}>N/A</Typography>
                      <Typography variant="caption" color="text.secondary">No images generated</Typography>
                    </>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        );
      })()}

      {ads.length === 0 && (
        <Paper
          sx={{
            p: 5, mb: 3, textAlign: 'center',
            border: '1px dashed rgba(242,101,34,0.15)',
            background: 'linear-gradient(135deg, rgba(242,101,34,0.02) 0%, rgba(16,185,129,0.02) 100%)',
            borderRadius: '16px',
          }}
        >
          <Box
            sx={{
              width: 64, height: 64, borderRadius: '20px', mx: 'auto', mb: 2.5,
              background: 'linear-gradient(135deg, rgba(242,101,34,0.1), rgba(16,185,129,0.08))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <RocketLaunchRoundedIcon sx={{ fontSize: 32, color: '#F26522' }} />
          </Box>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 1, letterSpacing: '-0.02em' }}>
            Ready to Generate
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto', lineHeight: 1.7 }}>
            Launch the autonomous pipeline to generate, evaluate, and iterate high-performance ads.
            All charts and analytics will populate automatically.
          </Typography>
          <Button
            variant="contained"
            startIcon={<RocketLaunchRoundedIcon />}
            onClick={() => navigate('/run')}
            sx={{
              px: 4, py: 1.25,
              background: 'linear-gradient(135deg, #F26522, #D4541A)',
              fontSize: '0.9rem', fontWeight: 700,
              borderRadius: '14px',
              boxShadow: '0 4px 16px rgba(242,101,34,0.3)',
              '&:hover': { background: 'linear-gradient(135deg, #FF8A50, #F26522)', boxShadow: '0 6px 24px rgba(242,101,34,0.4)' },
            }}
          >
            Launch Pipeline
          </Button>
        </Paper>
      )}

      <Grid container spacing={2.5}>
        {/* Score Distribution */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard
            title="Score Distribution"
            subtitle={scores.length > 0 ? `${scores.length} ads scored · Median: ${medianScore.toFixed(1)}` : undefined}
            headerRight={medianScore > 0 ? (
              <Chip
                label={`Median ${medianScore.toFixed(1)}`}
                size="small"
                sx={{
                  fontWeight: 700, fontSize: '0.65rem', height: 22,
                  bgcolor: medianScore >= 7 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  color: medianScore >= 7 ? '#10B981' : '#F59E0B',
                  border: `1px solid ${medianScore >= 7 ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                }}
              />
            ) : undefined}
          >
            {ads.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">Run the pipeline to see score distribution</Typography></Box>
            ) : (
              <Box>
                {/* Color band legend */}
                <Box sx={{ display: 'flex', gap: 2, mb: 1.5, justifyContent: 'center' }}>
                  {[
                    { label: 'Poor (1-5)', color: '#EF4444' },
                    { label: 'Fair (5-7)', color: '#F59E0B' },
                    { label: 'Good (7-10)', color: '#10B981' },
                  ].map(band => (
                    <Box key={band.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: band.color, opacity: 0.8 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{band.label}</Typography>
                    </Box>
                  ))}
                </Box>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={histData} barSize={28} key={`hist-${ads.length}`}>
                    <ReferenceArea x1="1" x2="5" fill="#EF4444" fillOpacity={isDark ? 0.04 : 0.03} />
                    <ReferenceArea x1="5" x2="7" fill="#F59E0B" fillOpacity={isDark ? 0.04 : 0.03} />
                    <ReferenceArea x1="7" x2="10" fill="#10B981" fillOpacity={isDark ? 0.04 : 0.03} />
                    <XAxis dataKey="range" tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <ReferenceLine y={0} stroke="transparent" />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={600}>
                      {histData.map((_, i) => <Cell key={i} fill={i >= 7 ? '#10B981' : i >= 6 ? '#F26522' : i >= 4 ? '#F59E0B' : '#EF4444'} fillOpacity={0.8} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Dimension Radar — avg across all ads */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Quality Radar" subtitle="Average dimension scores across all ads">
            {ads.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">No data yet</Typography></Box>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%" key={`radar-${ads.length}-${avgScore.toFixed(1)}`}>
                  <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#94A3B8', fontSize: 9 }} tickCount={6} axisLine={false} />
                  <Radar name="Avg Score" dataKey="score" stroke="#F26522" fill="#F26522" fillOpacity={0.2} strokeWidth={2} dot={{ r: 4, fill: '#F26522', strokeWidth: 0 }} isAnimationActive={true} animationDuration={600} animationEasing="ease-out" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>

        {/* Iteration Progression */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard
            title="Iteration Effectiveness"
            subtitle={improvedPct > 0 ? `${improvedPct}% of ads improved through iteration` : 'Score progression across iterations'}
            headerRight={
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {avgImprovement > 0 && (
                  <Chip label={`+${avgImprovement.toFixed(2)} avg lift`} size="small" sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }} />
                )}
                {improvedPct > 0 && (
                  <Chip
                    icon={<TrendingUpRoundedIcon sx={{ fontSize: 14, color: '#10B981 !important' }} />}
                    label={`${improvedPct}%`}
                    size="small"
                    sx={{ fontWeight: 700, fontSize: '0.65rem', bgcolor: 'rgba(16,185,129,0.06)', color: '#10B981' }}
                  />
                )}
              </Box>
            }
          >
            {iterProgressionData.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">No data yet</Typography></Box>
            ) : (
              <Box>
                {/* Before/After visual */}
                {iterProgressionData.length >= 2 && (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2,
                    p: 1.5, borderRadius: '12px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>FIRST ITER</Typography>
                      <Typography variant="h6" fontWeight={800} sx={{ color: '#F59E0B', fontSize: '1.1rem' }}>
                        {iterProgressionData[0].avgScore.toFixed(1)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 24, height: 2, bgcolor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }} />
                      <TrendingUpRoundedIcon sx={{ fontSize: 20, color: '#10B981' }} />
                      <Box sx={{ width: 24, height: 2, bgcolor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)' }} />
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>BEST ITER</Typography>
                      <Typography variant="h6" fontWeight={800} sx={{ color: '#10B981', fontSize: '1.1rem' }}>
                        {iterProgressionData[iterProgressionData.length - 1].avgScore.toFixed(1)}
                      </Typography>
                    </Box>
                  </Box>
                )}
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={iterProgressionData} key={`line-${ads.length}-${avgScore.toFixed(1)}`}>
                    <CartesianGrid stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'} />
                    <XAxis dataKey="iteration" tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[5, 10]} tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <ReferenceLine y={7} stroke="#F59E0B" strokeDasharray="3 3" strokeOpacity={0.5} label={{ value: 'Pass', fill: '#F59E0B', fontSize: 10, position: 'right' }} />
                    <Line type="monotone" dataKey="avgScore" stroke="#F26522" strokeWidth={2.5} dot={{ fill: '#F26522', r: 5, strokeWidth: 0 }} name="Avg" isAnimationActive={true} animationDuration={600} />
                    <Line type="monotone" dataKey="maxScore" stroke="#10B981" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Max" isAnimationActive={true} animationDuration={600} />
                    <Line type="monotone" dataKey="minScore" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Min" isAnimationActive={true} animationDuration={600} />
                    <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Weakest Dimensions */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Weakest Dimensions" subtitle="How often each dimension is the lowest scoring area">
            {ads.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">No data yet</Typography></Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                {weakestData.map((d, i) => {
                  const pct = ads.length ? (d.count / ads.length * 100) : 0;
                  return (
                    <Box key={d.name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {i === 0 && d.count > 1 && (
                            <TrendingDownRoundedIcon sx={{ fontSize: 14, color: '#EF4444' }} />
                          )}
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>{d.name}</Typography>
                        </Box>
                        <Chip
                          label={`${pct.toFixed(0)}%`}
                          size="small"
                          sx={{
                            fontWeight: 700, fontSize: '0.6rem', height: 20,
                            bgcolor: `${d.color}15`,
                            color: d.color,
                            border: `1px solid ${d.color}25`,
                          }}
                        />
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          height: 8, borderRadius: 4,
                          bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          '& .MuiLinearProgress-bar': { bgcolor: d.color, borderRadius: 4 },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', mt: 0.25, display: 'block' }}>
                        {d.count} of {ads.length} ads
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Audience Comparison */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard title="Performance by Audience" subtitle="Score and cost comparison across segments">
            {Object.keys(audienceStats).length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">No data yet</Typography></Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {Object.entries(audienceStats).map(([seg, stats]) => {
                  const color = AUDIENCE_COLORS[seg] || '#F26522';
                  const scoreColor = stats.avgScore >= 8 ? '#10B981' : stats.avgScore >= 7 ? '#F26522' : '#F59E0B';
                  return (
                    <Paper
                      key={seg}
                      sx={{
                        p: 2, display: 'flex', alignItems: 'center', gap: 2,
                        borderRadius: '12px',
                        border: `1px solid ${color}20`,
                        bgcolor: `${color}05`,
                        transition: 'all 0.25s ease',
                        '&:hover': { borderColor: `${color}40`, transform: 'translateX(4px)' },
                      }}
                    >
                      <Box sx={{ width: 6, height: 48, borderRadius: 3, bgcolor: color }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ textTransform: 'capitalize', fontSize: '0.88rem' }}>
                          {seg}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                          {stats.count} ads · ${stats.avgCost.toFixed(4)} avg cost
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Box sx={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          px: 1.5, py: 0.5, borderRadius: '10px',
                          bgcolor: `${scoreColor}15`,
                          border: `1px solid ${scoreColor}25`,
                        }}>
                          <Typography variant="h6" fontWeight={800} sx={{ color: scoreColor, fontSize: '1.1rem' }}>
                            <AnimatedNumber value={stats.avgScore} decimals={1} />
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', mt: 0.25 }}>
                          avg score
                        </Typography>
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Top Ads */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard
            title="Top Performing Ads"
            subtitle={ads.length > 0 ? `Best ${Math.min(5, ads.length)} by quality score` : undefined}
            headerRight={
              ads.length > 0 ? (
                <Chip
                  label="View All"
                  size="small"
                  variant="outlined"
                  onClick={() => navigate('/ads')}
                  sx={{
                    cursor: 'pointer', fontSize: '0.7rem', borderRadius: '8px',
                    borderColor: '#F26522', color: '#F26522',
                    '&:hover': { bgcolor: 'rgba(242,101,34,0.06)' },
                  }}
                />
              ) : undefined
            }
          >
            {ads.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">No ads generated yet</Typography></Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {[...ads]
                  .sort((a, b) => b.copy_iterations[b.best_copy_index].evaluation.weighted_average - a.copy_iterations[a.best_copy_index].evaluation.weighted_average)
                  .slice(0, 5)
                  .map((ad, i) => {
                    const best = ad.copy_iterations[ad.best_copy_index];
                    const firstScore = ad.copy_iterations[0].evaluation.weighted_average;
                    const improvement = best.evaluation.weighted_average - firstScore;
                    const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                    return (
                      <Box
                        key={ad.brief_id}
                        onClick={() => navigate(`/ads/${ad.brief_id}`)}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5,
                          p: 1.5, borderRadius: '12px', cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border: `1px solid transparent`,
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                            borderColor: isDark ? 'rgba(242,101,34,0.15)' : 'rgba(242,101,34,0.1)',
                            transform: 'translateX(4px)',
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 28, height: 28, borderRadius: '10px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            background: i < 3
                              ? `linear-gradient(135deg, ${rankColors[i]}30, ${rankColors[i]}10)`
                              : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            border: i < 3 ? `1px solid ${rankColors[i]}30` : 'none',
                          }}
                        >
                          <Typography variant="caption" fontWeight={800} sx={{
                            fontSize: '0.72rem',
                            color: i < 3 ? rankColors[i] : 'text.secondary',
                          }}>
                            {i + 1}
                          </Typography>
                        </Box>
                        <ScoreChip score={best.evaluation.weighted_average} variant="glow" />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.85rem' }}>
                            {best.ad_copy.headline}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.7rem' }}>
                            {ad.brief.audience_segment} · {ad.brief.campaign_goal} · {ad.copy_iterations.length} iters
                          </Typography>
                        </Box>
                        {improvement > 0 && (
                          <Chip
                            icon={<TrendingUpRoundedIcon sx={{ fontSize: 12, color: '#10B981 !important' }} />}
                            label={`+${improvement.toFixed(1)}`}
                            size="small"
                            sx={{
                              fontWeight: 700, fontSize: '0.6rem', height: 22,
                              bgcolor: 'rgba(16,185,129,0.08)', color: '#10B981',
                              border: '1px solid rgba(16,185,129,0.15)',
                            }}
                          />
                        )}
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem' }}>
                          ${ad.total_cost_usd.toFixed(3)}
                        </Typography>
                      </Box>
                    );
                  })}
              </Box>
            )}
          </ChartCard>
        </Grid>

        {/* Actionable Recommendations */}
        {ads.length >= 3 && (
          <Grid size={12}>
            <Paper sx={{
              p: 3, borderRadius: '16px',
              border: '1px solid rgba(242,101,34,0.15)',
              background: isDark
                ? 'linear-gradient(135deg, rgba(242,101,34,0.06) 0%, rgba(16,185,129,0.03) 100%)'
                : 'linear-gradient(135deg, rgba(242,101,34,0.03) 0%, rgba(16,185,129,0.02) 100%)',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #F26522, #10B981)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 3px 10px rgba(242,101,34,0.25)',
                }}>
                  <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: 'white' }} />
                </Box>
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>Recommendations</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Recommend scaling the best audience */}
                {(() => {
                  const bestAudience = Object.entries(audienceStats).sort((a, b) => b[1].avgScore - a[1].avgScore)[0];
                  if (bestAudience) {
                    return (
                      <Box sx={{
                        display: 'flex', gap: 1.5, alignItems: 'flex-start',
                        p: 1.5, borderRadius: '10px',
                        bgcolor: isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.03)',
                        border: '1px solid rgba(16,185,129,0.1)',
                      }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10B981', mt: '6px', flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.7, color: isDark ? 'rgba(226,232,240,0.8)' : 'rgba(30,41,59,0.8)' }}>
                          <strong>Scale {bestAudience[0]} ads</strong> — highest average score ({bestAudience[1].avgScore.toFixed(1)}/10) at ${bestAudience[1].avgCost.toFixed(4)}/ad. Consider running a 10+ batch for this segment.
                        </Typography>
                      </Box>
                    );
                  }
                  return null;
                })()}

                {/* Flag weakest dimension for targeted improvement */}
                {weakestData.length > 0 && weakestData[0].count > 1 && (
                  <Box sx={{
                    display: 'flex', gap: 1.5, alignItems: 'flex-start',
                    p: 1.5, borderRadius: '10px',
                    bgcolor: isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.03)',
                    border: '1px solid rgba(245,158,11,0.1)',
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#F59E0B', mt: '6px', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.7, color: isDark ? 'rgba(226,232,240,0.8)' : 'rgba(30,41,59,0.8)' }}>
                      <strong>Improve {weakestData[0].name}</strong> — weakest dimension in {weakestData[0].count}/{ads.length} ads ({(weakestData[0].count / ads.length * 100).toFixed(0)}%). Consider refining the {weakestData[0].name.toLowerCase()} rubric or adding targeted refinement prompts.
                    </Typography>
                  </Box>
                )}

                {/* Iteration effectiveness insight */}
                {avgImprovement > 0 && (
                  <Box sx={{
                    display: 'flex', gap: 1.5, alignItems: 'flex-start',
                    p: 1.5, borderRadius: '10px',
                    bgcolor: isDark ? 'rgba(242,101,34,0.05)' : 'rgba(242,101,34,0.03)',
                    border: '1px solid rgba(242,101,34,0.1)',
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#F26522', mt: '6px', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.7, color: isDark ? 'rgba(226,232,240,0.8)' : 'rgba(30,41,59,0.8)' }}>
                      <strong>Iteration is working</strong> — average lift of +{avgImprovement.toFixed(2)} per ad across iterations. {improvedPct}% of multi-iteration ads showed improvement.
                    </Typography>
                  </Box>
                )}

                {/* Cost efficiency insight */}
                {costSummary && costSummary.total_cost_usd > 0 && avgScore > 0 && (
                  <Box sx={{
                    display: 'flex', gap: 1.5, alignItems: 'flex-start',
                    p: 1.5, borderRadius: '10px',
                    bgcolor: isDark ? 'rgba(139,92,246,0.05)' : 'rgba(139,92,246,0.03)',
                    border: '1px solid rgba(139,92,246,0.1)',
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#8B5CF6', mt: '6px', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.7, color: isDark ? 'rgba(226,232,240,0.8)' : 'rgba(30,41,59,0.8)' }}>
                      <strong>Quality per dollar: {(avgScore / costSummary.total_cost_usd).toFixed(0)}</strong> — at ${(costSummary.total_cost_usd / ads.length).toFixed(4)}/ad, this is{' '}
                      {costSummary.total_cost_usd / ads.length < 0.02 ? 'highly efficient' : 'within normal range'} for LLM-generated ad copy.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Cost + Quality Summary Row */}
        <Grid size={12}>
          <Paper sx={{ p: 3, borderRadius: '16px', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box sx={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(180deg, #F26522, #10B981)' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>Dimension Score Breakdown</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>All Ads</Typography>
            </Box>
            {ads.length === 0 ? (
              <Box sx={{ py: 4, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">No data yet</Typography></Box>
            ) : (
              <Grid container spacing={1.5}>
                {DIMS.map(d => {
                  const avg = dimAverages[d];
                  const min = Math.min(...validAds.map(a => a.copy_iterations[a.best_copy_index].evaluation.scores[d]?.score || 0));
                  const max = Math.max(...validAds.map(a => a.copy_iterations[a.best_copy_index].evaluation.scores[d]?.score || 0));
                  const color = DIM_COLORS[d];
                  return (
                    <Grid size={{ xs: 12, sm: 6, md: "grow" }} key={d}>
                      <Paper
                        sx={{
                          p: 2, textAlign: 'center', borderRadius: '14px',
                          border: `1px solid ${color}20`,
                          bgcolor: `${color}05`,
                          transition: 'all 0.25s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: `0 4px 16px ${color}15`,
                          },
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} sx={{ color, fontSize: '0.6rem', letterSpacing: '0.05em' }}>
                          {DIM_LABELS[d].toUpperCase()}
                        </Typography>
                        <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5, color }}>
                          <AnimatedNumber value={avg} decimals={1} />
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center', gap: 1.5 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                            min {min.toFixed(1)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                            max {max.toFixed(1)}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={avg * 10}
                          sx={{
                            mt: 1, height: 5, borderRadius: 3,
                            bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                          }}
                        />
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled" sx={{ borderRadius: '10px', fontWeight: 600 }}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
