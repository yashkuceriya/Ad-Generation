import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Snackbar from '@mui/material/Snackbar';
import { useTheme } from '@mui/material/styles';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import HtmlRoundedIcon from '@mui/icons-material/HtmlRounded';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import Button from '@mui/material/Button';
import ScoreChip from '../components/ScoreChip';
import ScoreRadar from '../components/ScoreRadar';
import IterationTimeline from '../components/IterationTimeline';
import AdPreviewCard from '../components/AdPreviewCard';
import type { ImageGenStep } from '../components/AdPreviewCard';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ThumbUpAltRoundedIcon from '@mui/icons-material/ThumbUpAltRounded';
import ThumbDownAltRoundedIcon from '@mui/icons-material/ThumbDownAltRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import { getAd, generateImage, refineAd, checkCompliance, generateVariants, approveAd, rejectAd, markExperimentReady, getConfig } from '../api/endpoints';
import type { EngineConfig } from '../api/endpoints';
import { getClientId } from '../api/clientId';
import { useSSE } from '../api/useSSE';
import type { AdResult, ImageIteration, SSEEvent } from '../types';

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAdJSON(ad: AdResult) {
  downloadFile(JSON.stringify(ad, null, 2), `ad-${ad.brief_id}.json`, 'application/json');
}

function copyAdText(ad: AdResult): string {
  const best = ad.copy_iterations[ad.best_copy_index].ad_copy;
  return `Headline: ${best.headline}\n\nPrimary Text: ${best.primary_text}\n\nDescription: ${best.description}\n\nCTA: ${best.cta_button}`;
}

function exportAdPreviewHTML(ad: AdResult) {
  const best = ad.copy_iterations[ad.best_copy_index];
  const score = best.evaluation.weighted_average;
  const scoreColor = score >= 8 ? '#10B981' : score >= 6 ? '#F26522' : score >= 4 ? '#F59E0B' : '#EF4444';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ad Preview - ${ad.brief_id}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 24px; }
  .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 420px; width: 100%; overflow: hidden; }
  .card-header { padding: 16px 20px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; gap: 10px; }
  .avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #F26522, #D4541A); display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 14px; }
  .card-header-text { flex: 1; }
  .card-header-text .name { font-weight: 700; font-size: 14px; color: #1a1a1a; }
  .card-header-text .meta { font-size: 12px; color: #888; }
  .primary-text { padding: 16px 20px; font-size: 14px; line-height: 1.6; color: #333; }
  .card-body { padding: 0 20px 16px; }
  .headline { font-size: 18px; font-weight: 800; color: #1a1a1a; margin-bottom: 6px; }
  .description { font-size: 13px; color: #666; line-height: 1.5; margin-bottom: 14px; }
  .cta-btn { display: block; width: 100%; padding: 12px; background: #F26522; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; text-align: center; text-decoration: none; }
  .badges { padding: 12px 20px; border-top: 1px solid #f0f0f0; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .badge-score { background: ${scoreColor}18; color: ${scoreColor}; border: 1px solid ${scoreColor}40; }
  .badge-audience { background: rgba(242,101,34,0.08); color: #F26522; border: 1px solid rgba(242,101,34,0.2); }
</style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div class="avatar">N</div>
    <div class="card-header-text">
      <div class="name">Nerdy Ad Engine</div>
      <div class="meta">Sponsored · ${ad.brief.audience_segment}</div>
    </div>
  </div>
  <div class="primary-text">${best.ad_copy.primary_text}</div>
  <div class="card-body">
    <div class="headline">${best.ad_copy.headline}</div>
    <div class="description">${best.ad_copy.description}</div>
    <a class="cta-btn">${best.ad_copy.cta_button}</a>
  </div>
  <div class="badges">
    <span class="badge badge-score">Score: ${score.toFixed(1)}/10</span>
    <span class="badge badge-audience">${ad.brief.audience_segment}</span>
  </div>
</div>
</body>
</html>`;
  downloadFile(html, `ad-${ad.brief_id}-preview.html`, 'text/html');
}

function ImageIterationCard({ iter, isBest }: { iter: ImageIteration; isBest: boolean; index: number }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { brand_consistency, engagement_potential, text_image_alignment, average_score } = iter.evaluation;
  const scoreColor = average_score >= 8 ? '#10B981' : average_score >= 6 ? '#F26522' : average_score >= 4 ? '#F59E0B' : '#EF4444';

  return (
    <Paper
      sx={{
        overflow: 'hidden',
        border: isBest ? '2px solid rgba(16,185,129,0.3)' : '1px solid',
        borderColor: isBest ? undefined : 'divider',
        bgcolor: isBest ? 'rgba(16,185,129,0.03)' : undefined,
        transition: 'all 0.2s',
        '&:hover': { borderColor: isBest ? 'rgba(16,185,129,0.4)' : 'rgba(242,101,34,0.2)' },
      }}
    >
      {/* Image thumbnail */}
      {iter.image_url ? (
        <Box
          component="img"
          src={iter.image_url}
          alt={`Iteration ${iter.iteration_number}`}
          sx={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <Box sx={{ width: '100%', height: 200, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ImageRoundedIcon sx={{ fontSize: 40, color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }} />
        </Box>
      )}

      <Box sx={{ p: 2.5 }}>
        {/* Header: iteration number + status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="overline" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
            V{iter.iteration_number}
          </Typography>
          {isBest ? (
            <Chip
              icon={<CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} />}
              label="SELECTED"
              size="small"
              sx={{
                fontWeight: 700, fontSize: '0.65rem', height: 22,
                bgcolor: 'rgba(16,185,129,0.12)', color: '#10B981',
                border: '1px solid rgba(16,185,129,0.25)',
              }}
            />
          ) : (
            <Chip
              icon={<CancelRoundedIcon sx={{ fontSize: '14px !important' }} />}
              label="REJECTED"
              size="small"
              sx={{
                fontWeight: 700, fontSize: '0.65rem', height: 22,
                bgcolor: 'rgba(239,68,68,0.08)', color: '#EF4444',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            />
          )}
          {/* Overall score */}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: scoreColor, boxShadow: `0 0 10px ${scoreColor}50` }} />
            <Typography variant="h6" fontWeight={800} sx={{ color: scoreColor, fontSize: '1.1rem' }}>
              {average_score.toFixed(1)}
            </Typography>
          </Box>
        </Box>

        {/* Score breakdown */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[
            { label: 'Brand', score: brand_consistency },
            { label: 'Engagement', score: engagement_potential },
            { label: 'Alignment', score: text_image_alignment },
          ].map(({ label, score }) => {
            const c = score >= 8 ? '#10B981' : score >= 6 ? '#F26522' : score >= 4 ? '#F59E0B' : '#EF4444';
            return (
              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Typography variant="body2" sx={{ fontSize: '0.82rem', minWidth: 80, color: 'text.secondary' }}>
                  {label}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={score * 10}
                  sx={{
                    flex: 1, height: 5, borderRadius: 3,
                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    '& .MuiLinearProgress-bar': { bgcolor: c, borderRadius: 3 },
                  }}
                />
                <Typography variant="body2" fontWeight={800} sx={{ fontSize: '0.85rem', color: c, minWidth: 30, textAlign: 'right' }}>
                  {score.toFixed(1)}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Feedback / rationale */}
        {iter.evaluation.rationale && (
          <Typography
            variant="body2"
            sx={{ mt: 2, display: 'block', fontSize: '0.84rem', lineHeight: 1.7, borderTop: '1px solid', borderColor: 'divider', pt: 1.5, color: 'text.secondary' }}
          >
            {iter.evaluation.rationale}
          </Typography>
        )}

        {/* Suggestions */}
        {iter.evaluation.suggestions?.length > 0 && (
          <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {iter.evaluation.suggestions.map((s, i) => (
              <Chip
                key={i}
                label={s}
                size="small"
                sx={{
                  fontSize: '0.72rem', height: 24,
                  bgcolor: 'rgba(245,158,11,0.06)', color: '#F59E0B',
                  border: '1px solid rgba(245,158,11,0.15)',
                  '& .MuiChip-label': { lineHeight: 1.4 },
                }}
              />
            ))}
          </Box>
        )}

        {/* Refinement feedback (what was told to next iteration) */}
        {iter.refinement_feedback && (
          <Box
            sx={{
              mt: 2, p: 2, borderRadius: '10px',
              bgcolor: 'rgba(242,101,34,0.04)', border: '1px solid rgba(242,101,34,0.12)',
            }}
          >
            <Typography variant="overline" sx={{ fontSize: '0.62rem', color: '#F26522', letterSpacing: '0.06em' }}>
              FEEDBACK TO NEXT ITERATION
            </Typography>
            <Typography variant="body2" display="block" sx={{ mt: 0.75, fontSize: '0.84rem', lineHeight: 1.65, color: 'text.secondary' }}>
              {iter.refinement_feedback}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default function AdDetail() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { briefId } = useParams<{ briefId: string }>();
  usePageTitle(briefId ? `Ad ${briefId}` : 'Ad Detail');
  const navigate = useNavigate();
  const [ad, setAd] = useState<AdResult | null>(null);
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'info' | 'error' } | null>(null);
  const [tab, setTab] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageGenSteps, setImageGenSteps] = useState<ImageGenStep[]>([]);
  const [cacheHit, setCacheHit] = useState(false);

  const [fetchError, setFetchError] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [steerInput, setSteerInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Approval/Rejection dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectorName, setRejectorName] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Config — image generation enabled flag
  const [imageGenEnabled, setImageGenEnabled] = useState(true);

  useEffect(() => {
    getConfig().then(res => {
      setImageGenEnabled(res.data.image_generation_enabled);
    }).catch(() => {});
  }, []);

  // Live image scores from SSE (shown on Scores tab while images generate)
  const [liveImageScores, setLiveImageScores] = useState<{
    iteration: number;
    score: number;
    brand_consistency: number;
    engagement_potential: number;
    text_image_alignment: number;
    rationale: string;
  } | null>(null);

  useEffect(() => {
    if (briefId) {
      getAd(briefId).then(r => { setAd(r.data); setFetchError(false); }).catch(() => setFetchError(true));
    }
  }, [briefId]);

  // Re-fetch ad data (debounced to avoid hammering during rapid events)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshAd = useCallback((delay = 150) => {
    if (!briefId) return;
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      getAd(briefId).then(r => { setAd(r.data); setFetchError(false); }).catch(() => {});
    }, delay);
  }, [briefId]);

  // Listen for ALL pipeline SSE events for this brief — live updates
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    if (!briefId) return;
    if (String(event.brief_id) !== briefId) return;

    // Brief started for this ad — mark as live
    if (event.type === 'brief_started') {
      setIsLive(true);
    }

    // Copy iteration completed — refresh to show new iteration live
    if (event.type === 'copy_iteration_complete') {
      setIsLive(true);
      refreshAd(100); // fast refresh for copy iterations
      // Auto-switch to Scores tab (0) to show the radar updating live
      setTab(0);
    }

    if (event.type === 'brief_complete') {
      setIsLive(false);
      refreshAd(50); // immediate for completion
    }

    // Image events are user-scoped — only process if client_id matches
    const myClientId = getClientId();
    const eventClientId = event.client_id as string | undefined;
    const isMyImageEvent = !eventClientId || eventClientId === myClientId;

    // Image iteration completed — refresh to show image + update progress steps + capture live scores
    if (event.type === 'image_iteration_complete' && isMyImageEvent) {
      setIsLive(true);
      refreshAd(100);
      // Capture live image scores so they appear on the Scores tab in real time
      setLiveImageScores({
        iteration: Number(event.iteration),
        score: Number(event.score),
        brand_consistency: Number(event.brand_consistency ?? 0),
        engagement_potential: Number(event.engagement_potential ?? 0),
        text_image_alignment: Number(event.text_image_alignment ?? 0),
        rationale: String(event.rationale ?? ''),
      });
      const iter = Number(event.iteration);
      const score = Number(event.score);
      setImageGenSteps(prev => {
        let steps = [...prev];
        steps = steps.map(s =>
          s.label === `Generating image v${iter}` && (s.status === 'active' || s.status === 'pending')
            ? { ...s, status: 'done' as const, detail: 'Complete' }
            : s
        );
        steps = steps.map(s =>
          s.label === 'Evaluating quality' && (s.status === 'active' || s.status === 'pending')
            ? { ...s, status: 'done' as const, detail: `Score: ${score.toFixed(1)}/10` }
            : s
        );
        if (iter < 3) {
          steps.push({ label: 'Refining image', status: 'active', detail: `Improving from ${score.toFixed(1)}...` });
          steps.push({ label: `Generating image v${iter + 1}`, status: 'pending' });
          steps.push({ label: 'Evaluating quality', status: 'pending' });
        }
        return steps;
      });
    }

    if (event.type === 'image_generated' && isMyImageEvent) {
      // SSE delivered the result — cancel any fallback polling
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      const wasCacheHit = Boolean(event.cache_hit);
      setCacheHit(wasCacheHit);
      setLiveImageScores(null); // Clear live scores — full data now in ad object
      setImageGenSteps(prev => prev.map(s => ({
        ...s,
        status: 'done' as const,
        detail: s.detail || (s.label.startsWith('Generating') ? 'Complete' : s.detail),
      })));
      getAd(briefId).then(r => {
        setAd(r.data);
        setImageLoading(false);
        setImageGenSteps([]);
      }).catch(() => setImageLoading(false));
    }

    if (event.type === 'image_error' && isMyImageEvent) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setImageLoading(false);
      setImageError(String(event.error || 'Image generation failed'));
      setImageGenSteps(prev => [
        ...prev.map(s => s.status === 'active' ? { ...s, status: 'done' as const, detail: 'Error' } : s),
        { label: `Error: ${String(event.error || 'Generation failed')}`, status: 'done' as const },
      ]);
    }

    // Auto-refresh on variants generated or compliance complete
    if ((event.type === 'variants_generated' || event.type === 'compliance_complete') && event.brief_id === briefId) {
      getAd(briefId).then(r => setAd(r.data)).catch(() => {});
    }

    // Auto-refresh on approval/rejection/experiment-ready events
    if ((event.type === 'ad_approved' || event.type === 'ad_rejected' || event.type === 'ad_experiment_ready') && event.brief_id === briefId) {
      getAd(briefId).then(r => setAd(r.data)).catch(() => {});
    }
  }, [briefId, refreshAd]);

  useSSE(handleSSEEvent);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling and refresh timer on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  if (!ad) {
    return (
      <Box>
        {fetchError && (
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <Typography variant="body2" sx={{ color: '#EF4444' }}>
              Failed to load ad details. Make sure the backend is running.
            </Typography>
          </Paper>
        )}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3.5 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="rounded" width="60%" height={32} sx={{ mb: 1 }} animation="wave" />
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Skeleton variant="rounded" width={60} height={24} animation="wave" />
              <Skeleton variant="rounded" width={80} height={24} animation="wave" />
              <Skeleton variant="rounded" width={70} height={24} animation="wave" />
            </Box>
          </Box>
        </Box>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Skeleton variant="rounded" height={520} animation="wave" sx={{ borderRadius: '12px' }} />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Skeleton variant="rounded" height={48} animation="wave" sx={{ mb: 2, borderRadius: '8px' }} />
            <Skeleton variant="rounded" height={300} animation="wave" sx={{ borderRadius: '8px' }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  const bestCopy = ad.copy_iterations[ad.best_copy_index];
  const bestImage = ad.image_iterations[ad.best_image_index];
  const hasImages = ad.image_iterations.length > 0;

  const handleGenerateImage = async (forceRegenerate = false) => {
    if (!briefId) return;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setImageLoading(true);
    setCacheHit(false);
    setImageError(null);
    setTab(0); // Auto-switch to Scores tab to show live updates
    setImageGenSteps([
      { label: 'Crafting image prompt', status: 'active' },
      { label: 'Generating image v1', status: 'pending' },
      { label: 'Evaluating quality', status: 'pending' },
    ]);
    try {
      await generateImage(briefId, forceRegenerate);
      setImageGenSteps(prev => prev.map((s, i) =>
        i === 0 ? { ...s, status: 'done' as const, detail: 'Prompt ready' }
        : i === 1 ? { ...s, status: 'active' as const }
        : s
      ));
      let attempts = 0;
      const maxAttempts = 36;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const res = await getAd(briefId);
          if (res.data.image_iterations.length > 0) {
            setAd(res.data);
            setImageLoading(false);
            setImageGenSteps([]);
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          } else if (attempts >= maxAttempts) {
            setImageLoading(false);
            setImageGenSteps(prev => [...prev, { label: 'Timed out waiting for image', status: 'done' as const }]);
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          }
        } catch {
          setImageLoading(false);
          setImageGenSteps([]);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      }, 5000);
    } catch {
      setImageLoading(false);
      setImageGenSteps([]);
    }
  };

  const handleRegenerateImage = () => handleGenerateImage(true);

  // Image stats
  const imgScores = ad.image_iterations.map(i => i.evaluation.average_score);
  const bestImgScore = imgScores.length ? Math.max(...imgScores) : 0;
  const worstImgScore = imgScores.length ? Math.min(...imgScores) : 0;
  const imgImprovement = imgScores.length >= 2 ? imgScores[imgScores.length - 1] - imgScores[0] : 0;

  // Live combined score: blends copy score + live image score during generation
  const copyScore = bestCopy.evaluation.weighted_average;
  const liveOverallScore = liveImageScores
    ? (copyScore * 0.6 + liveImageScores.score * 0.4)
    : hasImages
      ? (copyScore * 0.6 + bestImgScore * 0.4)
      : copyScore;
  const isScoreLive = !!liveImageScores || imageLoading;

  return (
    <Box>
      {/* Back + Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3.5 }}>
        <IconButton
          aria-label="Back to gallery"
          onClick={() => navigate('/ads')}
          sx={{
            mt: 0.25,
            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            border: '1px solid',
            borderColor: 'divider',
            '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
          }}
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
              {bestCopy.ad_copy.headline}
            </Typography>
            {isLive && (
              <Chip
                label="LIVE"
                size="small"
                sx={{
                  fontWeight: 800, fontSize: '0.6rem', height: 22,
                  bgcolor: 'rgba(255,59,48,0.12)', color: '#FF3B30',
                  border: '1px solid rgba(255,59,48,0.3)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{
              transition: 'transform 0.3s ease',
              ...(isScoreLive ? {
                animation: 'scorePulse 1.5s ease-in-out infinite',
                '@keyframes scorePulse': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.08)' },
                },
              } : {}),
            }}>
              <ScoreChip score={liveOverallScore} variant="glow" />
            </Box>
            {isScoreLive && liveImageScores && (
              <Chip
                label={`IMG ${liveImageScores.score.toFixed(1)}`}
                size="small"
                sx={{
                  fontWeight: 700, fontSize: '0.65rem', height: 22,
                  bgcolor: 'rgba(242,101,34,0.1)', color: '#F26522',
                  border: '1px solid rgba(242,101,34,0.25)',
                  animation: 'fadeIn 0.3s ease-out',
                  '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
                }}
              />
            )}
            <Chip
              label={ad.brief.audience_segment}
              size="small"
              sx={{
                fontWeight: 600, fontSize: '0.68rem',
                bgcolor: 'rgba(242,101,34,0.08)', color: '#FF8A50',
                border: '1px solid rgba(242,101,34,0.15)',
              }}
            />
            <Chip
              label={ad.brief.campaign_goal}
              size="small"
              sx={{
                fontWeight: 600, fontSize: '0.68rem',
                bgcolor: 'rgba(16,185,129,0.08)', color: '#10B981',
                border: '1px solid rgba(16,185,129,0.15)',
              }}
            />
            <Chip
              label={ad.brief.tone}
              size="small"
              sx={{
                fontWeight: 600, fontSize: '0.68rem',
                bgcolor: 'rgba(245,158,11,0.08)', color: '#F59E0B',
                border: '1px solid rgba(245,158,11,0.15)',
              }}
            />
            <Chip
              icon={<PaidRoundedIcon sx={{ fontSize: '14px !important' }} />}
              label={`$${ad.total_cost_usd.toFixed(4)}`}
              size="small"
              sx={{
                fontWeight: 600, fontSize: '0.68rem',
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                border: '1px solid', borderColor: 'divider',
              }}
            />
            <Chip
              label={`${ad.copy_iterations.length} copy iter · ${ad.image_iterations.length} image iter`}
              size="small"
              sx={{
                fontWeight: 600, fontSize: '0.68rem',
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                border: '1px solid', borderColor: 'divider',
              }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => { navigator.clipboard.writeText(copyAdText(ad)); setSnack({ message: 'Ad text copied to clipboard!', severity: 'success' }); }}
              sx={{
                fontSize: '0.7rem', fontWeight: 700, textTransform: 'none',
                borderColor: 'rgba(139,92,246,0.3)', color: '#8B5CF6',
                '&:hover': { borderColor: '#8B5CF6', bgcolor: 'rgba(139,92,246,0.06)' },
              }}
            >
              Copy Ad Text
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HtmlRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => { exportAdPreviewHTML(ad); setSnack({ message: 'HTML preview downloaded!', severity: 'success' }); }}
              sx={{
                fontSize: '0.7rem', fontWeight: 700, textTransform: 'none',
                borderColor: 'rgba(16,185,129,0.3)', color: '#10B981',
                '&:hover': { borderColor: '#10B981', bgcolor: 'rgba(16,185,129,0.06)' },
              }}
            >
              Download Preview
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={() => { exportAdJSON(ad); setSnack({ message: 'Ad exported as JSON', severity: 'success' }); }}
              sx={{
                fontSize: '0.7rem', fontWeight: 700, textTransform: 'none',
                borderColor: 'rgba(242,101,34,0.3)', color: '#F26522',
                '&:hover': { borderColor: '#F26522', bgcolor: 'rgba(242,101,34,0.06)' },
              }}
            >
              Export
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Readiness Workflow Stepper */}
      {(() => {
        const WORKFLOW_STEPS = ['generated', 'evaluator_pass', 'compliance_pass', 'human_approved', 'experiment_ready'] as const;
        const STEP_LABELS = ['Generated', 'Evaluator Pass', 'Compliance Pass', 'Human Approved', 'Experiment Ready'];
        const currentStepIndex = WORKFLOW_STEPS.indexOf(ad.status as typeof WORKFLOW_STEPS[number]);
        const activeStep = ad.status === 'rejected' || ad.status === 'below_threshold'
          ? -1
          : currentStepIndex >= 0 ? currentStepIndex : (ad.status === 'iterating' ? -1 : 0);

        return (
          <Paper
            sx={{
              p: 2.5, mb: 2.5,
              border: '1px solid',
              borderColor: ad.status === 'rejected' ? 'rgba(239,68,68,0.2)' : 'rgba(242,101,34,0.12)',
              background: ad.status === 'rejected'
                ? 'linear-gradient(135deg, rgba(239,68,68,0.04), rgba(239,68,68,0.01))'
                : ad.status === 'experiment_ready'
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))'
                  : 'linear-gradient(135deg, rgba(242,101,34,0.04), rgba(16,185,129,0.02))',
            }}
          >
            <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary', letterSpacing: '0.08em', mb: 1.5, display: 'block' }}>
              READINESS PIPELINE
            </Typography>
            <Stepper
              activeStep={activeStep}
              alternativeLabel
              sx={{
                '& .MuiStepConnector-line': {
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                },
                '& .MuiStepLabel-label': {
                  fontSize: '0.72rem',
                  fontWeight: 600,
                },
                '& .MuiStepLabel-label.Mui-active': {
                  color: '#F26522',
                  fontWeight: 700,
                },
                '& .MuiStepLabel-label.Mui-completed': {
                  color: '#10B981',
                  fontWeight: 700,
                },
                '& .MuiStepIcon-root.Mui-active': {
                  color: '#F26522',
                },
                '& .MuiStepIcon-root.Mui-completed': {
                  color: '#10B981',
                },
              }}
            >
              {STEP_LABELS.map((label, index) => (
                <Step key={label} completed={activeStep > index}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            {ad.status === 'rejected' && (
              <Box sx={{ mt: 2, p: 1.5, borderRadius: '8px', bgcolor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#EF4444', fontWeight: 600 }}>
                  Rejected{ad.rejection_reason ? `: ${ad.rejection_reason}` : ''}
                </Typography>
              </Box>
            )}
            {ad.status === 'below_threshold' && (
              <Box sx={{ mt: 2, p: 1.5, borderRadius: '8px', bgcolor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#F59E0B', fontWeight: 600 }}>
                  Below quality threshold — not eligible for approval workflow
                </Typography>
              </Box>
            )}
          </Paper>
        );
      })()}

      {/* Approval / Rejection Action Bar */}
      {(ad.status === 'compliance_pass' || ad.status === 'evaluator_pass') && (
        <Paper
          sx={{
            p: 2.5, mb: 2.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            border: '1px solid rgba(139,92,246,0.15)',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(16,185,129,0.02))',
          }}
        >
          <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600, flex: 1 }}>
            This ad is ready for human review
          </Typography>
          <Button
            variant="contained"
            startIcon={<ThumbUpAltRoundedIcon sx={{ fontSize: 18 }} />}
            onClick={() => setApproveDialogOpen(true)}
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: '0.82rem',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              '&:hover': { background: 'linear-gradient(135deg, #34D399, #10B981)' },
            }}
          >
            Approve
          </Button>
          <Button
            variant="outlined"
            startIcon={<ThumbDownAltRoundedIcon sx={{ fontSize: 18 }} />}
            onClick={() => setRejectDialogOpen(true)}
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: '0.82rem',
              borderColor: 'rgba(239,68,68,0.4)', color: '#EF4444',
              '&:hover': { borderColor: '#EF4444', bgcolor: 'rgba(239,68,68,0.06)' },
            }}
          >
            Reject
          </Button>
        </Paper>
      )}
      {ad.status === 'human_approved' && (
        <Paper
          sx={{
            p: 2.5, mb: 2.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            border: '1px solid rgba(16,185,129,0.2)',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Approved{ad.approved_by ? ` by ${ad.approved_by}` : ''}{ad.approved_at ? ` on ${new Date(ad.approved_at).toLocaleDateString()}` : ''}
            </Typography>
            {ad.approval_notes && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                Notes: {ad.approval_notes}
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            startIcon={<TaskAltRoundedIcon sx={{ fontSize: 18 }} />}
            onClick={async () => {
              try {
                await markExperimentReady(ad.brief_id);
                const { data } = await getAd(ad.brief_id);
                setAd(data);
                setSnack({ message: 'Ad marked as experiment ready!', severity: 'success' });
              } catch {
                setSnack({ message: 'Failed to mark experiment ready', severity: 'error' });
              }
            }}
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: '0.82rem',
              background: 'linear-gradient(135deg, #F26522, #D4541A)',
              '&:hover': { background: 'linear-gradient(135deg, #FF8A50, #F26522)' },
            }}
          >
            Mark Experiment Ready
          </Button>
        </Paper>
      )}
      {ad.status === 'rejected' && (
        <Paper
          sx={{
            p: 2.5, mb: 2.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.04), rgba(239,68,68,0.01))',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#EF4444' }}>
              Rejected{ad.rejection_reason ? `: ${ad.rejection_reason}` : ''}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<ThumbUpAltRoundedIcon sx={{ fontSize: 18 }} />}
            onClick={() => setApproveDialogOpen(true)}
            sx={{
              textTransform: 'none', fontWeight: 700, fontSize: '0.82rem',
              borderColor: 'rgba(16,185,129,0.4)', color: '#10B981',
              '&:hover': { borderColor: '#10B981', bgcolor: 'rgba(16,185,129,0.06)' },
            }}
          >
            Reconsider
          </Button>
        </Paper>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onClose={() => setApproveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Approve Ad</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Your Name"
            value={approverName}
            onChange={(e) => setApproverName(e.target.value)}
            size="small"
            fullWidth
            required
          />
          <TextField
            label="Notes (optional)"
            value={approvalNotes}
            onChange={(e) => setApprovalNotes(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setApproveDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!approverName.trim()}
            onClick={async () => {
              try {
                await approveAd(ad.brief_id, approverName.trim(), approvalNotes.trim() || undefined);
                const { data } = await getAd(ad.brief_id);
                setAd(data);
                setApproveDialogOpen(false);
                setApproverName('');
                setApprovalNotes('');
                setSnack({ message: 'Ad approved successfully!', severity: 'success' });
              } catch {
                setSnack({ message: 'Failed to approve ad', severity: 'error' });
              }
            }}
            sx={{
              textTransform: 'none', fontWeight: 700,
              background: 'linear-gradient(135deg, #10B981, #059669)',
              '&:hover': { background: 'linear-gradient(135deg, #34D399, #10B981)' },
            }}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Reject Ad</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Your Name"
            value={rejectorName}
            onChange={(e) => setRejectorName(e.target.value)}
            size="small"
            fullWidth
            required
          />
          <TextField
            label="Reason for Rejection"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={2}
            required
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejectDialogOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!rejectorName.trim() || !rejectionReason.trim()}
            onClick={async () => {
              try {
                await rejectAd(ad.brief_id, rejectorName.trim(), rejectionReason.trim());
                const { data } = await getAd(ad.brief_id);
                setAd(data);
                setRejectDialogOpen(false);
                setRejectorName('');
                setRejectionReason('');
                setSnack({ message: 'Ad rejected', severity: 'info' });
              } catch {
                setSnack({ message: 'Failed to reject ad', severity: 'error' });
              }
            }}
            sx={{
              textTransform: 'none', fontWeight: 700,
              bgcolor: '#EF4444',
              '&:hover': { bgcolor: '#DC2626' },
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      <Grid container spacing={3}>
        {/* Left: Ad Preview */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ position: 'sticky', top: 24 }}>
            <AdPreviewCard
              copy={bestCopy.ad_copy}
              imageUrl={bestImage?.image_url}
              onGenerateImage={!hasImages ? () => handleGenerateImage(false) : undefined}
              onRegenerateImage={hasImages ? handleRegenerateImage : undefined}
              imageLoading={imageLoading}
              briefId={ad.brief_id}
              imageGenSteps={imageGenSteps}
              cacheHit={cacheHit}
              imageGenDisabled={!imageGenEnabled}
            />
            {!imageGenEnabled && (
              <Alert severity="info" variant="outlined" sx={{ mt: 1.5, borderRadius: '10px', fontSize: '0.82rem' }}>
                Image generation is paused — existing images remain available
              </Alert>
            )}
            {imageError && (
              <Alert
                severity="error"
                onClose={() => setImageError(null)}
                sx={{ mt: 1.5, borderRadius: '10px', fontSize: '0.82rem' }}
              >
                {imageError}
              </Alert>
            )}
          </Box>
        </Grid>

        {/* Right: Details */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                borderBottom: '1px solid', borderColor: 'divider',
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  minHeight: 48,
                },
                '& .Mui-selected': { color: '#F26522 !important' },
                '& .MuiTabs-indicator': {
                  background: 'linear-gradient(90deg, #F26522, #10B981)',
                  height: 2.5,
                  borderRadius: '2px 2px 0 0',
                },
              }}
            >
              <Tab icon={<StarRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Scores" />
              <Tab icon={<SpeedRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Copy Iterations" />
              <Tab
                icon={<ImageRoundedIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    Images
                    {hasImages && (
                      <Chip
                        label={ad.image_iterations.length}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.6rem', fontWeight: 700,
                          bgcolor: 'rgba(242,101,34,0.12)', color: '#F26522',
                        }}
                      />
                    )}
                  </Box>
                }
              />
              <Tab icon={<PsychologyRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Reasoning" />
              <Tab icon={<PaidRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Cost" />
              <Tab
                icon={<VerifiedUserRoundedIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    Compliance
                    {ad.compliance && (
                      <Chip
                        label={ad.compliance.passes ? 'PASS' : 'FAIL'}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.6rem', fontWeight: 700,
                          bgcolor: ad.compliance.passes ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          color: ad.compliance.passes ? '#10B981' : '#EF4444',
                        }}
                      />
                    )}
                  </Box>
                }
              />
              <Tab
                icon={<ScienceRoundedIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    A/B Variants
                    {ad.variants && ad.variants.length > 0 && (
                      <Chip
                        label={ad.variants.length}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.6rem', fontWeight: 700,
                          bgcolor: 'rgba(242,101,34,0.12)', color: '#F26522',
                        }}
                      />
                    )}
                  </Box>
                }
              />
            </Tabs>

            <Box sx={{ p: 3 }}>
              {/* Scores Tab */}
              {tab === 0 && (
                <Box>
                  {/* Live Performance Grade */}
                  <Paper
                    sx={{
                      p: 2.5, mb: 3, overflow: 'hidden',
                      background: isScoreLive
                        ? 'linear-gradient(135deg, rgba(242,101,34,0.06), rgba(16,185,129,0.04))'
                        : 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))',
                      border: `1px solid ${isScoreLive ? 'rgba(242,101,34,0.2)' : 'rgba(16,185,129,0.12)'}`,
                      transition: 'all 0.4s ease',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{ textAlign: 'center', minWidth: 80 }}>
                        <Typography variant="overline" sx={{ fontSize: '0.55rem', color: 'text.secondary', letterSpacing: '0.08em' }}>
                          OVERALL
                        </Typography>
                        <Typography
                          variant="h3"
                          fontWeight={900}
                          sx={{
                            color: liveOverallScore >= 8 ? '#10B981' : liveOverallScore >= 6 ? '#F26522' : '#EF4444',
                            lineHeight: 1,
                            transition: 'color 0.4s ease',
                            ...(isScoreLive ? {
                              animation: 'scoreGlow 1.5s ease-in-out infinite',
                              '@keyframes scoreGlow': {
                                '0%, 100%': { textShadow: 'none' },
                                '50%': { textShadow: `0 0 12px ${liveOverallScore >= 8 ? '#10B981' : '#F26522'}40` },
                              },
                            } : {}),
                          }}
                        >
                          {liveOverallScore.toFixed(1)}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                          / 10
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontWeight: 600 }}>
                              COPY SCORE
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={copyScore * 10}
                                sx={{
                                  flex: 1, height: 6, borderRadius: 3,
                                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                  '& .MuiLinearProgress-bar': { bgcolor: '#10B981', borderRadius: 3, transition: 'transform 0.6s ease' },
                                }}
                              />
                              <Typography variant="body2" fontWeight={800} sx={{ fontSize: '0.85rem', color: '#10B981', minWidth: 28 }}>
                                {copyScore.toFixed(1)}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontWeight: 600 }}>
                              IMAGE SCORE
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {liveImageScores ? (
                                <>
                                  <LinearProgress
                                    variant="determinate"
                                    value={liveImageScores.score * 10}
                                    sx={{
                                      flex: 1, height: 6, borderRadius: 3,
                                      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                      '& .MuiLinearProgress-bar': { bgcolor: '#F26522', borderRadius: 3, transition: 'transform 0.6s ease' },
                                    }}
                                  />
                                  <Typography variant="body2" fontWeight={800} sx={{ fontSize: '0.85rem', color: '#F26522', minWidth: 28 }}>
                                    {liveImageScores.score.toFixed(1)}
                                  </Typography>
                                </>
                              ) : hasImages ? (
                                <>
                                  <LinearProgress
                                    variant="determinate"
                                    value={bestImgScore * 10}
                                    sx={{
                                      flex: 1, height: 6, borderRadius: 3,
                                      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                      '& .MuiLinearProgress-bar': { bgcolor: '#F26522', borderRadius: 3 },
                                    }}
                                  />
                                  <Typography variant="body2" fontWeight={800} sx={{ fontSize: '0.85rem', color: '#F26522', minWidth: 28 }}>
                                    {bestImgScore.toFixed(1)}
                                  </Typography>
                                </>
                              ) : imageLoading ? (
                                <>
                                  <LinearProgress
                                    sx={{
                                      flex: 1, height: 6, borderRadius: 3,
                                      '& .MuiLinearProgress-bar': { bgcolor: '#F26522' },
                                    }}
                                  />
                                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary', minWidth: 28 }}>
                                    ...
                                  </Typography>
                                </>
                              ) : (
                                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                  Not generated
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Box>
                        {isScoreLive && (
                          <Typography variant="caption" sx={{
                            fontSize: '0.65rem', color: '#F26522', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 0.5,
                          }}>
                            <Box sx={{
                              width: 6, height: 6, borderRadius: '50%', bgcolor: '#F26522',
                              animation: 'pulse 1.5s ease-in-out infinite',
                              '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
                            }} />
                            Updating live — image v{liveImageScores?.iteration ?? 1} {liveImageScores ? 'scored' : 'generating'}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Paper>

                  {/* Why this version won */}
                  {ad.copy_iterations.length > 1 && (() => {
                    const first = ad.copy_iterations[0].evaluation;
                    const best = bestCopy.evaluation;
                    const improved = Object.entries(best.scores)
                      .filter(([dim, s]) => s.score > (first.scores[dim]?.score ?? 0))
                      .map(([dim, s]) => ({
                        dim: dim.replace(/_/g, ' '),
                        delta: +(s.score - (first.scores[dim]?.score ?? 0)).toFixed(1),
                      }))
                      .sort((a, b) => b.delta - a.delta);
                    const lift = +(best.weighted_average - first.weighted_average).toFixed(2);

                    return (
                      <Paper sx={{ p: 2.5, mb: 3, border: '1px solid rgba(16,185,129,0.12)', bgcolor: 'rgba(16,185,129,0.02)' }}>
                        <Typography variant="overline" sx={{ fontSize: '0.6rem', color: '#10B981', letterSpacing: '0.08em' }}>
                          WHY THIS VERSION WON
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.7, fontSize: '0.85rem', color: 'text.secondary' }}>
                          Iteration {ad.best_copy_index + 1} scored <strong>{best.weighted_average.toFixed(1)}</strong>/10
                          {lift > 0 ? ` (+${lift} vs v1)` : ''}.
                          {improved.length > 0 && (
                            <> Biggest gains: {improved.slice(0, 3).map(i => `${i.dim} (+${i.delta})`).join(', ')}.</>
                          )}
                          {best.weakest_dimension && (
                            <> Remaining opportunity: <strong>{best.weakest_dimension.replace(/_/g, ' ')}</strong> at {best.scores[best.weakest_dimension]?.score.toFixed(1)}/10.</>
                          )}
                        </Typography>
                      </Paper>
                    );
                  })()}

                  <ScoreRadar
                    scores={bestCopy.evaluation.scores}
                    prevScores={ad.copy_iterations.length >= 2
                      ? ad.copy_iterations[ad.best_copy_index > 0 ? ad.best_copy_index - 1 : 0].evaluation.scores
                      : undefined}
                    animationKey={`${ad.copy_iterations.length}-${bestCopy.evaluation.weighted_average}`}
                  />

                  {/* Live Image Scores — shown while images are being generated */}
                  {(liveImageScores || (imageLoading && ad.image_iterations.length === 0)) && (
                    <Paper
                      sx={{
                        mt: 2.5, p: 2.5, overflow: 'hidden',
                        border: '1px solid rgba(242,101,34,0.2)',
                        bgcolor: 'rgba(242,101,34,0.02)',
                        borderRadius: '12px',
                        animation: 'fadeIn 0.3s ease-out',
                        '@keyframes fadeIn': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <ImageRoundedIcon sx={{ fontSize: 16, color: '#F26522' }} />
                        <Typography variant="overline" sx={{ fontSize: '0.62rem', color: '#F26522', letterSpacing: '0.08em' }}>
                          IMAGE EVALUATION {liveImageScores ? `— V${liveImageScores.iteration}` : '— GENERATING...'}
                        </Typography>
                        {liveImageScores && (
                          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <Box sx={{
                              width: 8, height: 8, borderRadius: '50%',
                              bgcolor: liveImageScores.score >= 7 ? '#10B981' : liveImageScores.score >= 5 ? '#F59E0B' : '#EF4444',
                              boxShadow: `0 0 8px ${liveImageScores.score >= 7 ? '#10B981' : liveImageScores.score >= 5 ? '#F59E0B' : '#EF4444'}50`,
                              animation: 'pulse 1.5s ease-in-out infinite',
                            }} />
                            <Typography variant="h6" fontWeight={800} sx={{
                              color: liveImageScores.score >= 7 ? '#10B981' : liveImageScores.score >= 5 ? '#F59E0B' : '#EF4444',
                              fontSize: '1rem',
                            }}>
                              {liveImageScores.score.toFixed(1)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                      {liveImageScores ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {[
                            { label: 'Brand Consistency', score: liveImageScores.brand_consistency },
                            { label: 'Engagement Potential', score: liveImageScores.engagement_potential },
                            { label: 'Text-Image Alignment', score: liveImageScores.text_image_alignment },
                          ].map(({ label, score }) => {
                            const c = score >= 8 ? '#10B981' : score >= 6 ? '#F26522' : score >= 4 ? '#F59E0B' : '#EF4444';
                            return (
                              <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                <Typography variant="body2" sx={{ fontSize: '0.8rem', minWidth: 140, color: 'text.secondary' }}>
                                  {label}
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={score * 10}
                                  sx={{
                                    flex: 1, height: 5, borderRadius: 3,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                    transition: 'all 0.5s ease-out',
                                    '& .MuiLinearProgress-bar': { bgcolor: c, borderRadius: 3, transition: 'transform 0.5s ease-out' },
                                  }}
                                />
                                <Typography variant="body2" fontWeight={800} sx={{ fontSize: '0.82rem', color: c, minWidth: 30, textAlign: 'right' }}>
                                  {score.toFixed(1)}
                                </Typography>
                              </Box>
                            );
                          })}
                          {liveImageScores.rationale && (
                            <Typography variant="body2" sx={{ mt: 1, fontSize: '0.8rem', lineHeight: 1.6, color: 'text.secondary', fontStyle: 'italic' }}>
                              {liveImageScores.rationale}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <LinearProgress
                            sx={{
                              flex: 1, height: 4, borderRadius: 2,
                              '& .MuiLinearProgress-bar': { bgcolor: '#F26522' },
                            }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            Waiting for scores...
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  )}

                  <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {Object.entries(bestCopy.evaluation.scores).map(([dim, s]) => {
                      const isWeakest = dim === bestCopy.evaluation.weakest_dimension;
                      const scoreColor = s.score >= 8 ? '#10B981' : s.score >= 6 ? '#F26522' : s.score >= 4 ? '#F59E0B' : '#EF4444';
                      return (
                        <Paper
                          key={dim}
                          sx={{
                            p: 0,
                            overflow: 'hidden',
                            border: isWeakest ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(0,0,0,0.06)',
                            bgcolor: isWeakest ? 'rgba(245,158,11,0.02)' : undefined,
                            transition: 'all 0.2s',
                            '&:hover': { borderColor: `${scoreColor}40` },
                          }}
                        >
                          {/* Score header bar */}
                          <Box
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1.5,
                              px: 2.5, py: 1.75,
                              borderBottom: '1px solid', borderColor: 'divider',
                              bgcolor: 'rgba(255,255,255,0.015)',
                            }}
                          >
                            {/* Colored dot */}
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: scoreColor, boxShadow: `0 0 10px ${scoreColor}50`, flexShrink: 0 }} />
                            <Typography variant="subtitle1" fontWeight={700} sx={{ textTransform: 'capitalize', flex: 1, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
                              {dim.replace(/_/g, ' ')}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={s.score * 10}
                              sx={{
                                width: 80, height: 6, borderRadius: 3,
                                bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                '& .MuiLinearProgress-bar': { bgcolor: scoreColor, borderRadius: 3 },
                              }}
                            />
                            <Typography variant="h6" fontWeight={800} sx={{ color: scoreColor, fontSize: '1.1rem', minWidth: 36, textAlign: 'right' }}>
                              {s.score.toFixed(1)}
                            </Typography>
                            {isWeakest && (
                              <Chip
                                label="Weakest"
                                size="small"
                                sx={{
                                  fontWeight: 700, fontSize: '0.65rem', height: 22,
                                  bgcolor: 'rgba(245,158,11,0.12)', color: '#F59E0B',
                                  border: '1px solid rgba(245,158,11,0.25)',
                                }}
                              />
                            )}
                          </Box>

                          {/* Rationale body */}
                          <Box sx={{ px: 2.5, py: 2 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                lineHeight: 1.75,
                                fontSize: '0.88rem',
                                color: 'text.primary',
                                letterSpacing: '0.005em',
                              }}
                            >
                              {s.rationale}
                            </Typography>

                            {/* Suggestions */}
                            {s.suggestions.length > 0 && (
                              <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                                <Typography variant="overline" sx={{ fontSize: '0.6rem', fontWeight: 700, color: scoreColor, letterSpacing: '0.08em', mb: 1, display: 'block' }}>
                                  Suggestions
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  {s.suggestions.map((sug, i) => (
                                    <Box key={i} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                                      <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: `${scoreColor}60`, mt: '7px', flexShrink: 0 }} />
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontSize: '0.84rem',
                                          lineHeight: 1.65,
                                          color: 'text.secondary',
                                        }}
                                      >
                                        {sug}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Box>
                              </Box>
                            )}
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {/* Copy Iterations Tab */}
              {tab === 1 && (
                <IterationTimeline iterations={ad.copy_iterations} bestIndex={ad.best_copy_index} />
              )}

              {/* Images Tab */}
              {tab === 2 && (
                <Box>
                  {!hasImages ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <ImageRoundedIcon sx={{ fontSize: 48, color: 'rgba(242,101,34,0.15)', mb: 2 }} />
                      <Typography variant="h6" fontWeight={700} color="text.secondary" gutterBottom>
                        No images generated yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Click "Generate AI Image" on the ad preview to create images
                      </Typography>
                    </Box>
                  ) : (
                    <>
                      {/* Image Stats Summary */}
                      <Grid container spacing={1.5} sx={{ mb: 3 }}>
                        <Grid size={4}>
                          <Paper
                            sx={{
                              p: 2, textAlign: 'center',
                              background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))',
                              border: '1px solid rgba(16,185,129,0.1)',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>
                              BEST SCORE
                            </Typography>
                            <Typography variant="h5" fontWeight={800} sx={{ color: '#10B981' }}>
                              {bestImgScore.toFixed(1)}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid size={4}>
                          <Paper
                            sx={{
                              p: 2, textAlign: 'center',
                              background: 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))',
                              border: '1px solid rgba(239,68,68,0.08)',
                            }}
                          >
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>
                              LOWEST SCORE
                            </Typography>
                            <Typography variant="h5" fontWeight={800} sx={{ color: '#EF4444' }}>
                              {worstImgScore.toFixed(1)}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid size={4}>
                          <Paper
                            sx={{
                              p: 2, textAlign: 'center',
                              background: `linear-gradient(135deg, ${imgImprovement >= 0 ? 'rgba(16,185,129,0.06), rgba(16,185,129,0.02)' : 'rgba(245,158,11,0.06), rgba(245,158,11,0.02)'})`,
                              border: `1px solid ${imgImprovement >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'}`,
                            }}
                          >
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', fontWeight: 600 }}>
                              IMPROVEMENT
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                              {imgImprovement >= 0 ? (
                                <TrendingUpRoundedIcon sx={{ fontSize: 16, color: '#10B981' }} />
                              ) : (
                                <TrendingDownRoundedIcon sx={{ fontSize: 16, color: '#F59E0B' }} />
                              )}
                              <Typography variant="h5" fontWeight={800} sx={{ color: imgImprovement >= 0 ? '#10B981' : '#F59E0B' }}>
                                {imgImprovement >= 0 ? '+' : ''}{imgImprovement.toFixed(1)}
                              </Typography>
                            </Box>
                          </Paper>
                        </Grid>
                      </Grid>

                      {/* Iteration cards */}
                      <Grid container spacing={2}>
                        {ad.image_iterations.map((iter, idx) => (
                          <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                            <ImageIterationCard
                              iter={iter}
                              isBest={idx === ad.best_image_index}
                              index={idx}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  )}
                </Box>
              )}

              {/* Reasoning Tab */}
              {tab === 3 && (
                <Box>
                  <Paper sx={{ p: 2.5, mb: 3, border: '1px solid rgba(139,92,246,0.12)', bgcolor: 'rgba(139,92,246,0.02)' }}>
                    <Typography variant="overline" sx={{ fontSize: '0.6rem', color: '#8B5CF6', letterSpacing: '0.08em' }}>
                      AUTONOMOUS DECISION LOG
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.7, fontSize: '0.85rem', color: 'text.secondary' }}>
                      The engine autonomously evaluated each iteration, identified weaknesses, and generated targeted refinement instructions.
                      Below is the full reasoning chain for {ad.copy_iterations.length} iteration{ad.copy_iterations.length !== 1 ? 's' : ''}.
                    </Typography>
                  </Paper>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {ad.copy_iterations.map((iter, idx) => {
                      const isLast = idx === ad.copy_iterations.length - 1;
                      const isBestIter = idx === ad.best_copy_index;
                      const prevIter = idx > 0 ? ad.copy_iterations[idx - 1] : null;
                      const scoreDelta = prevIter
                        ? iter.evaluation.weighted_average - prevIter.evaluation.weighted_average
                        : 0;

                      return (
                        <Box key={iter.iteration_number} sx={{ display: 'flex', gap: 2 }}>
                          {/* Timeline connector */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.5 }}>
                            <Box
                              sx={{
                                width: 28, height: 28, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: isBestIter ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.1)',
                                border: `2px solid ${isBestIter ? '#10B981' : '#8B5CF6'}`,
                                flexShrink: 0,
                              }}
                            >
                              <Typography variant="caption" fontWeight={800} sx={{ fontSize: '0.7rem', color: isBestIter ? '#10B981' : '#8B5CF6' }}>
                                {iter.iteration_number}
                              </Typography>
                            </Box>
                            {!isLast && (
                              <Box sx={{ width: 2, flex: 1, bgcolor: 'rgba(139,92,246,0.12)', my: 0.5 }} />
                            )}
                          </Box>

                          {/* Iteration content */}
                          <Paper
                            sx={{
                              flex: 1, p: 2.5, mb: isLast ? 0 : 2,
                              border: isBestIter ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(0,0,0,0.06)',
                              bgcolor: isBestIter ? 'rgba(16,185,129,0.02)' : undefined,
                            }}
                          >
                            {/* Header */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                              <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.88rem' }}>
                                Iteration {iter.iteration_number}
                              </Typography>
                              <Chip
                                label={`${iter.evaluation.weighted_average.toFixed(1)}/10`}
                                size="small"
                                sx={{
                                  fontWeight: 700, fontSize: '0.65rem', height: 22,
                                  bgcolor: iter.evaluation.weighted_average >= 7 ? 'rgba(16,185,129,0.1)' : 'rgba(242,101,34,0.1)',
                                  color: iter.evaluation.weighted_average >= 7 ? '#10B981' : '#F26522',
                                  border: `1px solid ${iter.evaluation.weighted_average >= 7 ? 'rgba(16,185,129,0.2)' : 'rgba(242,101,34,0.2)'}`,
                                }}
                              />
                              {scoreDelta !== 0 && (
                                <Chip
                                  label={`${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(2)}`}
                                  size="small"
                                  sx={{
                                    fontWeight: 700, fontSize: '0.6rem', height: 20,
                                    bgcolor: scoreDelta > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                                    color: scoreDelta > 0 ? '#10B981' : '#EF4444',
                                  }}
                                />
                              )}
                              {isBestIter && (
                                <Chip
                                  icon={<CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} />}
                                  label="SELECTED"
                                  size="small"
                                  sx={{
                                    fontWeight: 700, fontSize: '0.6rem', height: 22, ml: 'auto',
                                    bgcolor: 'rgba(16,185,129,0.12)', color: '#10B981',
                                    border: '1px solid rgba(16,185,129,0.25)',
                                  }}
                                />
                              )}
                            </Box>

                            {/* Critic Assessment */}
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="overline" sx={{ fontSize: '0.58rem', color: '#8B5CF6', letterSpacing: '0.08em' }}>
                                CRITIC ASSESSMENT
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.84rem', lineHeight: 1.7, color: 'text.secondary' }}>
                                Weakest dimension: <strong style={{ color: '#F59E0B' }}>{iter.evaluation.weakest_dimension.replace(/_/g, ' ')}</strong>{' '}
                                at {iter.evaluation.scores[iter.evaluation.weakest_dimension]?.score.toFixed(1)}/10.
                                {iter.evaluation.scores[iter.evaluation.weakest_dimension]?.rationale && (
                                  <> {iter.evaluation.scores[iter.evaluation.weakest_dimension].rationale}</>
                                )}
                              </Typography>
                            </Box>

                            {/* Headline produced */}
                            <Box
                              sx={{
                                p: 1.5, borderRadius: '8px',
                                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: '1px solid', borderColor: 'divider',
                                mb: 2,
                              }}
                            >
                              <Typography variant="overline" sx={{ fontSize: '0.55rem', color: 'text.disabled', letterSpacing: '0.08em' }}>
                                HEADLINE
                              </Typography>
                              <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem', color: 'text.primary' }}>
                                &ldquo;{iter.ad_copy.headline}&rdquo;
                              </Typography>
                            </Box>

                            {/* Refinement Strategy (what the refiner told the next iteration) */}
                            {iter.refinement_feedback ? (
                              <Box
                                sx={{
                                  p: 2, borderRadius: '10px',
                                  bgcolor: 'rgba(242,101,34,0.04)', border: '1px solid rgba(242,101,34,0.12)',
                                }}
                              >
                                <Typography variant="overline" sx={{ fontSize: '0.58rem', color: '#F26522', letterSpacing: '0.08em' }}>
                                  REFINEMENT STRATEGY FOR NEXT ITERATION
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.75, fontSize: '0.84rem', lineHeight: 1.7, color: 'text.secondary' }}>
                                  {iter.refinement_feedback}
                                </Typography>
                              </Box>
                            ) : isLast ? (
                              <Box
                                sx={{
                                  p: 2, borderRadius: '10px',
                                  bgcolor: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.12)',
                                }}
                              >
                                <Typography variant="overline" sx={{ fontSize: '0.58rem', color: '#10B981', letterSpacing: '0.08em' }}>
                                  FINAL ITERATION
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.75, fontSize: '0.84rem', lineHeight: 1.7, color: 'text.secondary' }}>
                                  This was the last iteration in the autonomous loop. The best-performing version was selected based on weighted score.
                                </Typography>
                              </Box>
                            ) : null}
                          </Paper>
                        </Box>
                      );
                    })}
                  </Box>

                  {/* Manual Steering Input */}
                  <Paper
                    sx={{
                      mt: 3, p: 2.5,
                      border: '1px solid rgba(242,101,34,0.15)',
                      background: 'linear-gradient(135deg, rgba(242,101,34,0.04), rgba(139,92,246,0.02))',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
                      <PsychologyRoundedIcon sx={{ fontSize: 16, color: '#F26522' }} />
                      <Typography variant="overline" sx={{ fontSize: '0.6rem', color: '#F26522', letterSpacing: '0.08em' }}>
                        HUMAN-IN-THE-LOOP STEERING
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', mb: 2, lineHeight: 1.6 }}>
                      Not satisfied with the result? Give a natural-language instruction and the engine will produce a new iteration guided by your direction.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                      <TextField
                        multiline
                        minRows={2}
                        maxRows={4}
                        fullWidth
                        size="small"
                        placeholder='e.g. "Make the tone more urgent" or "Emphasize the free trial offer"'
                        value={steerInput}
                        onChange={(e) => setSteerInput(e.target.value)}
                        disabled={isRefining}
                        sx={{
                          '& .MuiOutlinedInput-root': { fontSize: '0.85rem', borderRadius: '10px' },
                        }}
                      />
                      <Button
                        variant="contained"
                        disabled={!steerInput.trim() || isRefining}
                        onClick={async () => {
                          if (!briefId || !steerInput.trim()) return;
                          setIsRefining(true);
                          try {
                            await refineAd(briefId, steerInput.trim());
                            setSteerInput('');
                            setSnack({ message: 'Refinement submitted — waiting for result...', severity: 'info' });
                          } catch {
                            setSnack({ message: 'Failed to submit refinement', severity: 'error' });
                          }
                          setIsRefining(false);
                        }}
                        sx={{
                          minWidth: 48, height: 48,
                          background: 'linear-gradient(135deg, #F26522, #D4541A)',
                          borderRadius: '10px',
                          '&:hover': { background: 'linear-gradient(135deg, #FF8A50, #F26522)' },
                        }}
                      >
                        {isRefining ? (
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700 }}>...</Typography>
                        ) : (
                          <SendRoundedIcon sx={{ fontSize: 20 }} />
                        )}
                      </Button>
                    </Box>
                  </Paper>
                </Box>
              )}

              {/* Cost Tab */}
              {tab === 4 && (
                <Box>
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={6}>
                      <Paper
                        sx={{
                          p: 2.5,
                          background: 'linear-gradient(135deg, rgba(242,101,34,0.06), rgba(242,101,34,0.02))',
                          border: '1px solid rgba(242,101,34,0.1)',
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.65rem' }}>
                          TOTAL COST
                        </Typography>
                        <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, fontSize: '1.75rem' }}>
                          ${ad.total_cost_usd.toFixed(4)}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid size={6}>
                      <Paper
                        sx={{
                          p: 2.5,
                          background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))',
                          border: '1px solid rgba(16,185,129,0.1)',
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.65rem' }}>
                          QUALITY / DOLLAR
                        </Typography>
                        <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, fontSize: '1.75rem' }}>
                          {ad.quality_per_dollar.toFixed(0)}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Copy costs */}
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, fontSize: '0.85rem' }}>
                    Copy Generation
                  </Typography>
                  {ad.copy_iterations.map((iter) => (
                    <Box key={iter.iteration_number} sx={{ mb: 2.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="caption" fontWeight={600} color="text.secondary">
                          Iteration {iter.iteration_number}
                        </Typography>
                        <Chip
                          label={`$${iter.costs.reduce((s, c) => s + c.cost_usd, 0).toFixed(5)}`}
                          size="small"
                          sx={{
                            fontWeight: 700, fontSize: '0.65rem', height: 20,
                            bgcolor: 'rgba(242,101,34,0.08)', color: '#FF8A50',
                          }}
                        />
                      </Box>
                      <Paper sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                        {iter.costs.map((c, i) => (
                          <Box
                            key={i}
                            sx={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              py: 1.25, px: 2,
                              borderBottom: i < iter.costs.length - 1 ? '1px solid rgba(0,0,0,0.03)' : 'none',
                              '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                              transition: 'background 0.15s',
                            }}
                          >
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                              {c.step_name.replace(/_/g, ' ')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                {(c.input_tokens + c.output_tokens).toLocaleString()} tokens
                              </Typography>
                              <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem', color: '#F26522', minWidth: 70, textAlign: 'right' }}>
                                ${c.cost_usd.toFixed(6)}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Paper>
                    </Box>
                  ))}

                  {/* Image costs */}
                  {hasImages && (
                    <>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, mt: 2, fontSize: '0.85rem' }}>
                        Image Generation
                      </Typography>
                      {ad.image_iterations.map((iter) => (
                        <Box key={iter.iteration_number} sx={{ mb: 2.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Typography variant="caption" fontWeight={600} color="text.secondary">
                              Image V{iter.iteration_number}
                            </Typography>
                            <Chip
                              label={`$${iter.costs.reduce((s, c) => s + c.cost_usd, 0).toFixed(5)}`}
                              size="small"
                              sx={{
                                fontWeight: 700, fontSize: '0.65rem', height: 20,
                                bgcolor: 'rgba(16,185,129,0.08)', color: '#10B981',
                              }}
                            />
                          </Box>
                          <Paper sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                            {iter.costs.map((c, i) => (
                              <Box
                                key={i}
                                sx={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  py: 1.25, px: 2,
                                  borderBottom: i < iter.costs.length - 1 ? '1px solid rgba(0,0,0,0.03)' : 'none',
                                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                                }}
                              >
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                                  {c.step_name.replace(/_/g, ' ')}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    {(c.input_tokens + c.output_tokens).toLocaleString()} tokens
                                  </Typography>
                                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem', color: '#10B981', minWidth: 70, textAlign: 'right' }}>
                                    ${c.cost_usd.toFixed(6)}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                          </Paper>
                        </Box>
                      ))}
                    </>
                  )}
                </Box>
              )}

              {/* Compliance Tab */}
              {tab === 5 && (
                <Box>
                  {ad.compliance ? (
                    <>
                      {/* Overall status */}
                      <Paper
                        sx={{
                          p: 2.5, mb: 3,
                          background: ad.compliance.passes
                            ? 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))'
                            : 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))',
                          border: `1px solid ${ad.compliance.passes ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          {ad.compliance.passes ? (
                            <CheckCircleRoundedIcon sx={{ fontSize: 40, color: '#10B981' }} />
                          ) : (
                            <ErrorOutlineRoundedIcon sx={{ fontSize: 40, color: '#EF4444' }} />
                          )}
                          <Box>
                            <Typography variant="h5" fontWeight={800}>
                              {ad.compliance.passes ? 'Platform Compliant' : 'Compliance Issues Found'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Score: {ad.compliance.score}/10 — {ad.compliance.violations.length} issue{ad.compliance.violations.length !== 1 ? 's' : ''} found
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>

                      {/* Violations list */}
                      {ad.compliance.violations.length > 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {ad.compliance.violations.map((v, i) => (
                            <Paper
                              key={i}
                              sx={{
                                p: 2, border: '1px solid',
                                borderColor: v.severity === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                                bgcolor: v.severity === 'error'
                                  ? (isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.03)')
                                  : (isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.03)'),
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                                {v.severity === 'error' ? (
                                  <ErrorOutlineRoundedIcon sx={{ fontSize: 18, color: '#EF4444', mt: 0.25 }} />
                                ) : (
                                  <WarningAmberRoundedIcon sx={{ fontSize: 18, color: '#F59E0B', mt: 0.25 }} />
                                )}
                                <Box sx={{ flex: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                                      {v.message}
                                    </Typography>
                                    <Chip
                                      label={v.field.replace(/_/g, ' ')}
                                      size="small"
                                      sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                                    />
                                  </Box>
                                  {v.suggestion && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                                      {v.suggestion}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </Paper>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                          No compliance issues found. This ad is ready to publish.
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Compliance check has not been run yet.
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<VerifiedUserRoundedIcon />}
                        onClick={async () => {
                          try {
                            await checkCompliance(ad.brief_id);
                            const { data } = await getAd(ad.brief_id);
                            setAd(data);
                            setSnack({ message: 'Compliance check complete', severity: 'success' });
                          } catch {
                            setSnack({ message: 'Compliance check failed', severity: 'error' });
                          }
                        }}
                        sx={{ borderColor: '#F26522', color: '#F26522', '&:hover': { borderColor: '#F26522', bgcolor: 'rgba(242,101,34,0.06)' } }}
                      >
                        Run Compliance Check
                      </Button>
                    </Box>
                  )}
                </Box>
              )}

              {/* A/B Variants Tab */}
              {tab === 6 && (
                <Box>
                  {ad.variants && ad.variants.length > 0 ? (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, fontSize: '0.82rem' }}>
                        Strategic test variants generated from the winning copy. Each tests a specific hypothesis.
                      </Typography>
                      <Grid container spacing={2.5}>
                        {ad.variants.map((variant, i) => (
                          <Grid key={i} size={6}>
                            <Paper
                              sx={{
                                p: 2.5, height: '100%',
                                border: '1px solid',
                                borderColor: variant.variant_type === 'hook_variant' ? 'rgba(242,101,34,0.2)' : 'rgba(16,185,129,0.2)',
                                bgcolor: variant.variant_type === 'hook_variant'
                                  ? (isDark ? 'rgba(242,101,34,0.04)' : 'rgba(242,101,34,0.02)')
                                  : (isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.02)'),
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                <Chip
                                  label={variant.variant_type === 'hook_variant' ? 'Hook Variant' : 'CTA Variant'}
                                  size="small"
                                  sx={{
                                    fontWeight: 700, fontSize: '0.65rem', height: 22,
                                    bgcolor: variant.variant_type === 'hook_variant' ? 'rgba(242,101,34,0.12)' : 'rgba(16,185,129,0.12)',
                                    color: variant.variant_type === 'hook_variant' ? '#F26522' : '#10B981',
                                  }}
                                />
                                <ScienceRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', ml: 'auto' }} />
                              </Box>

                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, fontStyle: 'italic', fontSize: '0.72rem' }}>
                                {variant.variant_hypothesis}
                              </Typography>

                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <Box>
                                  <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>Headline</Typography>
                                  <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>{variant.ad_copy.headline}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>Primary Text</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'pre-line' }}>{variant.ad_copy.primary_text}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>Description</Typography>
                                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{variant.ad_copy.description}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>CTA</Typography>
                                  <Chip label={variant.ad_copy.cta_button} size="small" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                                </Box>
                              </Box>

                              {variant.costs.length > 0 && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontSize: '0.68rem' }}>
                                  Cost: ${variant.costs.reduce((sum, c) => sum + c.cost_usd, 0).toFixed(6)}
                                </Typography>
                              )}
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Generate A/B test variants to optimize your winning ad.
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
                        Creates a hook variant and a CTA variant for split testing.
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<ScienceRoundedIcon />}
                        onClick={async () => {
                          try {
                            await generateVariants(ad.brief_id);
                            setSnack({ message: 'Generating A/B variants...', severity: 'info' });
                          } catch {
                            setSnack({ message: 'Variant generation failed', severity: 'error' });
                          }
                        }}
                        sx={{ borderColor: '#F26522', color: '#F26522', '&:hover': { borderColor: '#F26522', bgcolor: 'rgba(242,101,34,0.06)' } }}
                      >
                        Generate A/B Variants
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled" sx={{ borderRadius: '10px', fontWeight: 600 }}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
