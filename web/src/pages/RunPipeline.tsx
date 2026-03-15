import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import Skeleton from '@mui/material/Skeleton';
import PipelineProgress from '../components/PipelineProgress';
import PipelineFlow from '../components/PipelineFlow';
import { startPipeline, stopPipeline, getPipelineStatus, getPresets, getRunHistory, getConfig } from '../api/endpoints';
import type { RunHistoryEntry } from '../api/endpoints';
import { useSSE } from '../api/useSSE';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import type { PipelineStatus, SSEEvent, Presets } from '../types';

interface CustomBrief {
  audience: string;
  goal: string;
  offer: string;
  tone: string;
}

const EVENT_ICON: Record<string, React.ReactNode> = {
  brief_complete: <CheckCircleRoundedIcon sx={{ fontSize: 16, color: '#10B981' }} />,
  pipeline_complete: <CheckCircleRoundedIcon sx={{ fontSize: 16, color: '#10B981' }} />,
  pipeline_error: <ErrorRoundedIcon sx={{ fontSize: 16, color: '#EF4444' }} />,
  pipeline_stopped: <StopRoundedIcon sx={{ fontSize: 16, color: '#F59E0B' }} />,
  image_generated: <ImageRoundedIcon sx={{ fontSize: 16, color: '#F26522' }} />,
  image_error: <ErrorRoundedIcon sx={{ fontSize: 16, color: '#EF4444' }} />,
};

export default function RunPipeline() {
  usePageTitle('Run Pipeline');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [mode, setMode] = useState('demo');
  const [count, setCount] = useState(5);
  const [imageMode, setImageMode] = useState('lazy');
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [presets, setPresets] = useState<Presets | null>(null);
  const [customBrief, setCustomBrief] = useState<CustomBrief>({ audience: '', goal: '', offer: '', tone: '' });
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>([]);
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'info' | 'error' } | null>(null);
  const [imageCostPerImage, setImageCostPerImage] = useState(0.07);
  const [imageGenEnabled, setImageGenEnabled] = useState(true);

  useEffect(() => {
    getConfig().then(res => {
      setImageCostPerImage(res.data.image_cost_per_image);
      setImageGenEnabled(res.data.image_generation_enabled);
    }).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await getPipelineStatus();
      setStatus(res.data);
    } catch { /* */ }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    getRunHistory().then(res => setRunHistory(res.data.reverse())).catch(() => {});
  }, []);

  useEffect(() => {
    getPresets().then(res => {
      setPresets(res.data);
      setCustomBrief({
        audience: res.data.audiences[0] ?? '',
        goal: res.data.goals[0] ?? '',
        offer: res.data.offers[0] ?? '',
        tone: res.data.tones[0] ?? '',
      });
    }).catch(() => { /* presets unavailable */ });
  }, []);

  const handleEvent = useCallback((event: SSEEvent) => {
    setEvents(prev => [event, ...prev].slice(0, 50));
    refresh();
    if (event.type === 'pipeline_complete') {
      getRunHistory().then(res => setRunHistory(res.data.reverse())).catch(() => {});
    }
  }, [refresh]);

  useSSE(handleEvent);

  const handleStart = async () => {
    setLoading(true);
    setEvents([]);
    setActionError(null);
    try {
      await startPipeline(mode, count, imageMode, mode === 'custom' ? customBrief : undefined);
      setSnack({ message: `Pipeline started — generating ${count} ad${count > 1 ? 's' : ''}`, severity: 'success' });
    } catch {
      setActionError('Failed to start pipeline — check backend connection');
    }
    setLoading(false);
    refresh();
  };

  const handleStop = async () => {
    setStopDialogOpen(false);
    setActionError(null);
    try {
      await stopPipeline();
    } catch { setActionError('Failed to stop pipeline'); }
    refresh();
  };

  const isRunning = status?.status === 'running';

  if (status === null) {
    return (
      <Box>
        <Skeleton variant="rounded" height={100} animation="wave" sx={{ mb: 3.5, borderRadius: '20px' }} />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Skeleton variant="rounded" height={400} animation="wave" sx={{ borderRadius: '12px' }} />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Skeleton variant="rounded" height={300} animation="wave" sx={{ borderRadius: '12px' }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  const estimatedCost = count * 0.01 + (imageMode === 'eager' ? count * imageCostPerImage : imageMode === 'lazy' ? Math.min(3, count) * imageCostPerImage : 0);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          mb: 3.5,
          p: 3.5,
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(242,101,34,0.06) 0%, rgba(16,185,129,0.03) 100%)',
          border: '1px solid rgba(242,101,34,0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,101,34,0.08), transparent 70%)',
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'linear-gradient(135deg, #F26522, #D4541A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RocketLaunchRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
              Run Pipeline
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.6 }}>
            Configure and launch the autonomous ad generation pipeline
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Config Panel */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 3, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <TuneRoundedIcon sx={{ fontSize: 18, color: '#F26522' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                Configuration
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField
                select
                label="Mode"
                value={mode}
                onChange={(e) => {
                  setMode(e.target.value);
                  if (e.target.value === 'demo') setCount(5);
                  if (e.target.value === 'single') setCount(1);
                  if (e.target.value === 'batch') setCount(50);
                  if (e.target.value === 'custom') setCount(1);
                }}
                fullWidth
              >
                <MenuItem value="single">Single (1 ad)</MenuItem>
                <MenuItem value="demo">Demo (5 ads)</MenuItem>
                <MenuItem value="batch">Batch (custom count)</MenuItem>
                <MenuItem value="custom">Custom Brief</MenuItem>
              </TextField>

              {mode === 'custom' && presets && (
                <Paper
                  sx={{
                    p: 2.5,
                    border: '1px solid rgba(242,101,34,0.15)',
                    background: 'linear-gradient(135deg, rgba(242,101,34,0.04), rgba(16,185,129,0.02))',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 2 }}>
                    <EditNoteRoundedIcon sx={{ fontSize: 16, color: '#10B981' }} />
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#10B981', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                      CUSTOM BRIEF
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                      select
                      label="Audience"
                      value={customBrief.audience}
                      onChange={(e) => setCustomBrief(prev => ({ ...prev, audience: e.target.value }))}
                      fullWidth
                      size="small"
                    >
                      {presets.audiences.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="Campaign Goal"
                      value={customBrief.goal}
                      onChange={(e) => setCustomBrief(prev => ({ ...prev, goal: e.target.value }))}
                      fullWidth
                      size="small"
                    >
                      {presets.goals.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="Product Offer"
                      value={customBrief.offer}
                      onChange={(e) => setCustomBrief(prev => ({ ...prev, offer: e.target.value }))}
                      fullWidth
                      size="small"
                    >
                      {presets.offers.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="Tone"
                      value={customBrief.tone}
                      onChange={(e) => setCustomBrief(prev => ({ ...prev, tone: e.target.value }))}
                      fullWidth
                      size="small"
                    >
                      {presets.tones.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </Box>

                  {/* Brief Summary */}
                  {customBrief.audience && customBrief.goal && (
                    <Paper
                      sx={{
                        mt: 2,
                        p: 2,
                        bgcolor: 'rgba(242,101,34,0.06)',
                        border: '1px solid rgba(242,101,34,0.1)',
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} sx={{ color: '#F26522', fontSize: '0.6rem', letterSpacing: '0.05em', display: 'block', mb: 0.75 }}>
                        BRIEF PREVIEW
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', lineHeight: 1.6, display: 'block' }}>
                        Target <strong style={{ color: '#10B981' }}>{customBrief.audience}</strong> with a{' '}
                        <strong style={{ color: '#F26522' }}>{customBrief.tone}</strong> tone to{' '}
                        <strong style={{ color: '#10B981' }}>{customBrief.goal}</strong> featuring{' '}
                        <strong style={{ color: '#F26522' }}>{customBrief.offer}</strong>.
                      </Typography>
                    </Paper>
                  )}
                </Paper>
              )}

              {mode === 'batch' && (
                <TextField
                  type="number"
                  label="Count"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  inputProps={{ min: 1, max: 50 }}
                  fullWidth
                />
              )}

              <TextField
                select
                label="Image Mode"
                value={imageMode}
                onChange={(e) => setImageMode(e.target.value)}
                fullWidth
                helperText={
                  imageMode === 'lazy' ? `Images generated on-demand when clicked (~$${imageCostPerImage.toFixed(2)} each)`
                  : imageMode === 'eager' ? 'Images generated for every ad during pipeline'
                  : 'No images, text-only ads'
                }
              >
                <MenuItem value="lazy">Lazy (on-demand)</MenuItem>
                <MenuItem value="eager">Eager (all images)</MenuItem>
                <MenuItem value="off">Off (text only)</MenuItem>
              </TextField>

              {!imageGenEnabled && imageMode !== 'off' && (
                <Alert severity="warning" variant="outlined" sx={{ borderRadius: '10px', fontSize: '0.82rem' }}>
                  Image generation is currently paused. Images will not be generated even in {imageMode} mode. Select "Off" or wait until image generation is re-enabled.
                </Alert>
              )}

              {/* Cost Estimator */}
              <Paper
                sx={{
                  p: 2.5,
                  background: 'linear-gradient(135deg, rgba(242,101,34,0.06), rgba(16,185,129,0.03))',
                  border: '1px solid rgba(242,101,34,0.12)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                  <BoltRoundedIcon sx={{ fontSize: 14, color: '#F59E0B' }} />
                  <Typography variant="caption" fontWeight={700} sx={{ color: '#F59E0B', fontSize: '0.65rem', letterSpacing: '0.05em' }}>
                    ESTIMATED COST
                  </Typography>
                </Box>
                <Typography variant="h5" fontWeight={800}>
                  ~${estimatedCost.toFixed(2)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.7rem' }}>
                  {count} ads × ~$0.01/ad text
                  {imageMode !== 'off' && ` + ${imageMode === 'eager' ? count : `~${Math.min(3, count)}`} images × ~$${imageCostPerImage.toFixed(2)}/image`}
                </Typography>
              </Paper>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<RocketLaunchRoundedIcon />}
                  onClick={handleStart}
                  disabled={isRunning || loading}
                  fullWidth
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(135deg, #F26522, #D4541A)',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    borderRadius: '12px',
                    '&:hover': { background: 'linear-gradient(135deg, #FF8A50, #F26522)' },
                    '&.Mui-disabled': { opacity: 0.5 },
                  }}
                >
                  {loading ? 'Starting...' : 'Launch Pipeline'}
                </Button>
                {isRunning && (
                  <Button
                    variant="outlined"
                    startIcon={<StopRoundedIcon />}
                    onClick={() => setStopDialogOpen(true)}
                    sx={{
                      px: 3,
                      borderColor: 'rgba(239,68,68,0.3)',
                      color: '#EF4444',
                      borderRadius: '12px',
                      '&:hover': { borderColor: '#EF4444', bgcolor: 'rgba(239,68,68,0.06)' },
                    }}
                  >
                    Stop
                  </Button>
                )}
              </Box>
              {actionError && (
                <Alert severity="error" onClose={() => setActionError(null)} sx={{ borderRadius: '10px', fontSize: '0.82rem' }}>
                  {actionError}
                </Alert>
              )}
            </Box>
          </Paper>

          {/* Quick Launch */}
          <Paper sx={{ p: 3, mt: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ fontSize: '0.85rem' }}>
              Quick Launch
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
              {[
                { label: '1 Ad (test)', m: 'single', c: 1 },
                { label: '5 Ads (demo)', m: 'demo', c: 5, recommended: true },
                { label: '10 Ads', m: 'batch', c: 10 },
                { label: '50 Ads (full)', m: 'batch', c: 50 },
              ].map(q => {
                const active = mode === q.m && count === q.c;
                return (
                  <Chip
                    key={q.label}
                    label={`${q.label}${'recommended' in q ? ' ★' : ''}`}
                    onClick={() => { setMode(q.m); setCount(q.c); }}
                    sx={{
                      fontWeight: 600, fontSize: '0.75rem',
                      bgcolor: active ? 'rgba(242,101,34,0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                      color: active ? '#F26522' : 'text.secondary',
                      border: `1px solid ${active ? 'rgba(242,101,34,0.3)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}`,
                      '&:hover': { bgcolor: 'rgba(242,101,34,0.1)', borderColor: 'rgba(242,101,34,0.2)' },
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
            </Box>
          </Paper>

          {/* Brief Templates */}
          <Paper sx={{ p: 3, mt: 2.5, border: '1px solid rgba(16,185,129,0.1)', bgcolor: 'rgba(16,185,129,0.02)' }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ fontSize: '0.85rem' }}>
              Templates
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5, fontSize: '0.7rem' }}>
              Pre-built briefs for common scenarios
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                { label: 'Parents — Conversion', audience: 'parents', goal: 'conversion', offer: 'SAT prep tutoring', tone: 'urgent' },
                { label: 'Students — Awareness', audience: 'students', goal: 'awareness', offer: 'Free SAT practice test', tone: 'encouraging' },
                { label: 'Families — Conversion', audience: 'families', goal: 'conversion', offer: 'SAT study package', tone: 'reassuring' },
              ].map(t => (
                <Box
                  key={t.label}
                  onClick={() => {
                    setMode('custom');
                    setCount(1);
                    setCustomBrief({ audience: t.audience, goal: t.goal, offer: t.offer, tone: t.tone });
                  }}
                  sx={{
                    p: 1.5, borderRadius: '10px', cursor: 'pointer',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                    '&:hover': { bgcolor: 'rgba(16,185,129,0.04)', borderColor: 'rgba(16,185,129,0.15)' },
                    transition: 'all 0.15s',
                  }}
                >
                  <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                    {t.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                    {t.tone} · {t.offer}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Run History */}
          {runHistory.length > 0 && (
            <Paper sx={{ p: 3, mt: 2.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ fontSize: '0.85rem' }}>
                Recent Runs
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1.5 }}>
                {runHistory.slice(0, 5).map((run, i) => {
                  const date = new Date(run.timestamp);
                  const scoreColor = run.avg_score >= 8 ? '#10B981' : run.avg_score >= 7 ? '#F26522' : '#F59E0B';
                  return (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5,
                        p: 1.5, borderRadius: '10px',
                        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}`,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                          {run.total_ads} ads · {run.elapsed_seconds.toFixed(0)}s
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                          {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                      <Chip
                        label={`${run.avg_score.toFixed(1)} avg`}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: '0.65rem', height: 22,
                          bgcolor: `${scoreColor}15`, color: scoreColor,
                          border: `1px solid ${scoreColor}30`,
                        }}
                      />
                      <Chip
                        label={`${run.pass_rate}%`}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: '0.65rem', height: 22,
                          bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.7rem' }}>
                        ${run.total_cost.toFixed(4)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          )}
        </Grid>

        {/* Progress + Events */}
        <Grid size={{ xs: 12, md: 7 }}>
          {status && status.status !== 'idle' && (
            <Box sx={{ mb: 2.5 }}>
              <PipelineFlow currentPhase={status.current_phase} isRunning={status.status === 'running'} />
              <PipelineProgress status={status} />
            </Box>
          )}

          <Paper sx={{ p: 3, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>
              Live Events
            </Typography>
            {events.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <AutorenewRoundedIcon sx={{ fontSize: 40, color: 'rgba(242,101,34,0.2)', mb: 1.5 }} />
                <Typography variant="body2" color="text.secondary">
                  Events will appear here when pipeline is running
                </Typography>
              </Box>
            ) : (
              <Box sx={{ maxHeight: 520, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {events.map((event, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1.5,
                      p: 1.5, borderRadius: '10px',
                      bgcolor: event.type.includes('error') ? 'rgba(239,68,68,0.04)'
                        : event.type.includes('complete') ? 'rgba(16,185,129,0.03)'
                        : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
                      border: `1px solid ${
                        event.type.includes('error') ? 'rgba(239,68,68,0.1)'
                        : event.type.includes('complete') ? 'rgba(16,185,129,0.08)'
                        : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)')
                      }`,
                      transition: 'all 0.2s',
                    }}
                  >
                    <Box sx={{ mt: 0.25, flexShrink: 0 }}>
                      {EVENT_ICON[event.type] || <AutorenewRoundedIcon sx={{ fontSize: 16, color: '#F26522' }} />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                        <Chip
                          label={event.type.replace(/_/g, ' ')}
                          size="small"
                          sx={{
                            fontWeight: 700, fontSize: '0.62rem', height: 20,
                            bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                          }}
                        />
                        {!!event.brief_id && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            {String(event.brief_id)}
                          </Typography>
                        )}
                        {event.score !== undefined && (
                          <Chip
                            label={`${Number(event.score).toFixed(1)}/10`}
                            size="small"
                            sx={{
                              fontWeight: 700, fontSize: '0.62rem', height: 20,
                              bgcolor: Number(event.score) >= 7 ? 'rgba(16,185,129,0.1)' : 'rgba(242,101,34,0.1)',
                              color: Number(event.score) >= 7 ? '#10B981' : '#F26522',
                              border: `1px solid ${Number(event.score) >= 7 ? 'rgba(16,185,129,0.2)' : 'rgba(242,101,34,0.2)'}`,
                            }}
                          />
                        )}
                      </Box>
                      {event.type === 'copy_iteration_complete' && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.72rem' }}>
                          Iter {String(event.iteration)} · Weakest: {String(event.weakest_dimension)} · &ldquo;{String(event.headline)}&rdquo;
                        </Typography>
                      )}
                      {event.type === 'pipeline_complete' && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.72rem' }}>
                          {String(event.total_ads)} ads · Avg: {Number(event.avg_score).toFixed(1)} · Cost: ${Number(event.total_cost).toFixed(4)}
                        </Typography>
                      )}
                      {!!event.error && (
                        <Typography variant="caption" sx={{ mt: 0.5, display: 'block', fontSize: '0.72rem', color: '#EF4444' }}>
                          {String(event.error)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Stop Confirmation Dialog */}
      <Dialog
        open={stopDialogOpen}
        onClose={() => setStopDialogOpen(false)}
        PaperProps={{
          sx: {
            bgcolor: isDark ? '#1C2128' : 'background.paper',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: '16px',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Stop Pipeline?</DialogTitle>
        <DialogContent>
          <DialogContentText color="text.secondary">
            This will stop the current pipeline run. Ads that have already been generated will be kept, but any in-progress generation will be cancelled.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setStopDialogOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleStop}
            variant="contained"
            sx={{
              bgcolor: '#EF4444',
              '&:hover': { bgcolor: '#E55A5A' },
              fontWeight: 600,
            }}
          >
            Stop Pipeline
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled" sx={{ borderRadius: '10px', fontWeight: 600 }}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
