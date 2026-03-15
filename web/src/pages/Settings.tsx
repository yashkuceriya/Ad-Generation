import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import usePageTitle from '../hooks/usePageTitle';
import { getConfig, updateModels, updatePipeline } from '../api/endpoints';
import type { EngineConfig } from '../api/endpoints';

const DIM_COLORS: Record<string, string> = {
  clarity: '#F26522',
  value_proposition: '#10B981',
  cta_strength: '#F59E0B',
  brand_voice: '#EF4444',
  emotional_resonance: '#8B5CF6',
};

const DIM_LABELS: Record<string, string> = {
  clarity: 'Clarity',
  value_proposition: 'Value Proposition',
  cta_strength: 'CTA Strength',
  brand_voice: 'Brand Voice',
  emotional_resonance: 'Emotional Resonance',
};

// Fallback if backend doesn't return available_models (e.g. older version running)
const FALLBACK_MODELS: Record<string, string[]> = {
  text: [
    'google/gemini-3-flash-preview',
    'google/gemini-3.1-flash-lite-preview',
    'google/gemini-2.5-flash-preview',
    'google/gemini-2.5-pro-preview-06-05',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-haiku-4',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'meta-llama/llama-4-maverick',
    'deepseek/deepseek-r1',
  ],
  vision: [
    'google/gemini-3-flash-preview',
    'google/gemini-2.5-flash-preview',
    'google/gemini-2.5-pro-preview-06-05',
    'anthropic/claude-sonnet-4',
    'openai/gpt-4o',
  ],
  image: [
    'google/gemini-3.1-flash-image-preview',
    'google/gemini-2.0-flash-exp:free',
  ],
};

const MODEL_ROLES: { key: string; label: string; description: string; category: 'text' | 'vision' | 'image' }[] = [
  { key: 'draft', label: 'Draft', description: 'Creative copy generation', category: 'text' },
  { key: 'refine', label: 'Refine', description: 'Targeted copy refinement', category: 'text' },
  { key: 'evaluation', label: 'Evaluation', description: 'Scoring & evaluation (most calls)', category: 'text' },
  { key: 'vision', label: 'Vision', description: 'Image evaluation (multimodal)', category: 'vision' },
  { key: 'image', label: 'Image', description: 'Image generation', category: 'image' },
];

function ConfigRow({ label, value }: { label: string; value: string | number }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>{label}</Typography>
      <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{value}</Typography>
    </Box>
  );
}

export default function Settings() {
  usePageTitle('Settings');
  const [config, setConfig] = useState<EngineConfig | null>(null);
  const [error, setError] = useState(false);
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  // Editable model state
  const [models, setModels] = useState<Record<string, string>>({});
  const [modelsDirty, setModelsDirty] = useState(false);
  const [modelsSaving, setModelsSaving] = useState(false);

  // Editable pipeline state
  const [pipelineSettings, setPipelineSettings] = useState({
    max_copy_iterations: 3,
    max_image_iterations: 3,
    quality_threshold: 7.0,
    early_stop_threshold: 9.0,
  });
  const [pipelineDirty, setPipelineDirty] = useState(false);
  const [pipelineSaving, setPipelineSaving] = useState(false);

  useEffect(() => {
    getConfig()
      .then(res => {
        setConfig(res.data);
        setModels(res.data.models);
        setPipelineSettings(res.data.pipeline);
      })
      .catch(() => setError(true));
  }, []);

  const handleModelChange = (role: string, value: string) => {
    setModels(prev => ({ ...prev, [role]: value }));
    setModelsDirty(true);
  };

  const handleSaveModels = async () => {
    setModelsSaving(true);
    try {
      await updateModels(models);
      setModelsDirty(false);
      setSnack({ message: 'Models updated — changes take effect on next pipeline run', severity: 'success' });
      // Refresh config to sync
      const res = await getConfig();
      setConfig(res.data);
      setModels(res.data.models);
    } catch {
      setSnack({ message: 'Failed to update models', severity: 'error' });
    }
    setModelsSaving(false);
  };

  const handleSavePipeline = async () => {
    setPipelineSaving(true);
    try {
      await updatePipeline(pipelineSettings);
      setPipelineDirty(false);
      setSnack({ message: 'Pipeline settings updated', severity: 'success' });
      const res = await getConfig();
      setConfig(res.data);
      setPipelineSettings(res.data.pipeline);
    } catch {
      setSnack({ message: 'Failed to update pipeline settings', severity: 'error' });
    }
    setPipelineSaving(false);
  };

  if (!config && !error) {
    return (
      <Box>
        <Skeleton variant="rounded" height={100} animation="wave" sx={{ mb: 3.5, borderRadius: '20px' }} />
        <Grid container spacing={2.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid size={{ xs: 12, md: 6 }} key={i}>
              <Skeleton variant="rounded" height={200} animation="wave" sx={{ borderRadius: '12px' }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          Failed to load configuration. Make sure the backend is running.
        </Typography>
      </Paper>
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
        <Box sx={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.06), transparent 70%)' }} />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #F26522, #D4541A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SettingsRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Settings</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Configure models, pipeline behavior, and thresholds
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2.5}>
        {/* Models — Editable */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SmartToyRoundedIcon sx={{ fontSize: 18, color: '#F26522' }} />
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>Models</Typography>
              </Box>
              {modelsDirty && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<SaveRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={handleSaveModels}
                  disabled={modelsSaving}
                  sx={{
                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'none',
                    background: 'linear-gradient(135deg, #F26522, #D4541A)',
                    borderRadius: '8px', px: 2,
                    '&:hover': { background: 'linear-gradient(135deg, #FF8A50, #F26522)' },
                  }}
                >
                  {modelsSaving ? 'Saving...' : 'Save Models'}
                </Button>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {MODEL_ROLES.map(role => {
                const availableList = config?.available_models?.[role.category] || FALLBACK_MODELS[role.category] || [];
                const currentValue = models[role.key] || '';
                // Ensure current value is always in the list
                const fullList = availableList.includes(currentValue)
                  ? availableList
                  : [currentValue, ...availableList].filter(Boolean);

                return (
                  <Box key={role.key}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                        {role.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                        {role.description}
                      </Typography>
                    </Box>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      value={currentValue}
                      onChange={(e) => handleModelChange(role.key, e.target.value)}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          fontSize: '0.82rem',
                          fontFamily: 'monospace',
                        },
                      }}
                    >
                      {fullList.map(model => {
                        const provider = model.split('/')[0];
                        const name = model.split('/').pop() || model;
                        const isActive = model === currentValue;
                        return (
                          <MenuItem key={model} value={model} sx={{ fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: isActive ? 700 : 400 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                              <Typography component="span" sx={{ fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: isActive ? 700 : 400 }}>
                                {name}
                              </Typography>
                              <Typography component="span" sx={{ fontSize: '0.68rem', color: 'text.secondary', ml: 'auto' }}>
                                {provider}
                              </Typography>
                              {isActive && (
                                <Chip label="active" size="small" sx={{ height: 16, fontSize: '0.55rem', fontWeight: 700, bgcolor: 'rgba(16,185,129,0.12)', color: '#10B981' }} />
                              )}
                            </Box>
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  </Box>
                );
              })}
            </Box>

            {/* Temperatures (read-only) */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                TEMPERATURES
              </Typography>
              {config && Object.entries(config.temperatures).map(([role, temp]) => (
                <ConfigRow key={role} label={role.charAt(0).toUpperCase() + role.slice(1)} value={temp} />
              ))}
              {config && <ConfigRow label="Max output tokens" value={config.max_output_tokens} />}
            </Box>
          </Paper>
        </Grid>

        {/* Pipeline Settings — Editable */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TuneRoundedIcon sx={{ fontSize: 18, color: '#10B981' }} />
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>Pipeline</Typography>
              </Box>
              {pipelineDirty && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<SaveRoundedIcon sx={{ fontSize: 14 }} />}
                  onClick={handleSavePipeline}
                  disabled={pipelineSaving}
                  sx={{
                    fontSize: '0.75rem', fontWeight: 700, textTransform: 'none',
                    background: 'linear-gradient(135deg, #10B981, #0D9668)',
                    borderRadius: '8px', px: 2,
                    '&:hover': { background: 'linear-gradient(135deg, #34D399, #10B981)' },
                  }}
                >
                  {pipelineSaving ? 'Saving...' : 'Save Pipeline'}
                </Button>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Max Copy Iterations */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>Max Copy Iterations</Typography>
                  <Chip label={pipelineSettings.max_copy_iterations} size="small" sx={{ fontWeight: 700, fontSize: '0.75rem', height: 22, bgcolor: 'rgba(242,101,34,0.1)', color: '#F26522' }} />
                </Box>
                <Slider
                  value={pipelineSettings.max_copy_iterations}
                  onChange={(_, v) => { setPipelineSettings(p => ({ ...p, max_copy_iterations: v as number })); setPipelineDirty(true); }}
                  min={1} max={5} step={1} marks
                  size="small"
                  sx={{ '& .MuiSlider-thumb': { bgcolor: '#F26522' }, '& .MuiSlider-track': { bgcolor: '#F26522' } }}
                />
                <Typography variant="caption" color="text.secondary">More iterations = higher quality but more cost/latency</Typography>
              </Box>

              {/* Max Image Iterations */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>Max Image Iterations</Typography>
                  <Chip label={pipelineSettings.max_image_iterations} size="small" sx={{ fontWeight: 700, fontSize: '0.75rem', height: 22, bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981' }} />
                </Box>
                <Slider
                  value={pipelineSettings.max_image_iterations}
                  onChange={(_, v) => { setPipelineSettings(p => ({ ...p, max_image_iterations: v as number })); setPipelineDirty(true); }}
                  min={1} max={5} step={1} marks
                  size="small"
                  sx={{ '& .MuiSlider-thumb': { bgcolor: '#10B981' }, '& .MuiSlider-track': { bgcolor: '#10B981' } }}
                />
              </Box>

              {/* Quality Threshold */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>Quality Threshold</Typography>
                  <Chip label={`${pipelineSettings.quality_threshold.toFixed(1)}/10`} size="small" sx={{ fontWeight: 700, fontSize: '0.75rem', height: 22, bgcolor: 'rgba(245,158,11,0.1)', color: '#F59E0B' }} />
                </Box>
                <Slider
                  value={pipelineSettings.quality_threshold}
                  onChange={(_, v) => { setPipelineSettings(p => ({ ...p, quality_threshold: v as number })); setPipelineDirty(true); }}
                  min={1} max={10} step={0.5}
                  size="small"
                  valueLabelDisplay="auto"
                  sx={{ '& .MuiSlider-thumb': { bgcolor: '#F59E0B' }, '& .MuiSlider-track': { bgcolor: '#F59E0B' } }}
                />
                <Typography variant="caption" color="text.secondary">Ads below this score are marked "below threshold"</Typography>
              </Box>

              {/* Early Stop Threshold */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>Early Stop Threshold</Typography>
                  <Chip label={`${pipelineSettings.early_stop_threshold.toFixed(1)}/10`} size="small" sx={{ fontWeight: 700, fontSize: '0.75rem', height: 22, bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981' }} />
                </Box>
                <Slider
                  value={pipelineSettings.early_stop_threshold}
                  onChange={(_, v) => { setPipelineSettings(p => ({ ...p, early_stop_threshold: v as number })); setPipelineDirty(true); }}
                  min={5} max={10} step={0.5}
                  size="small"
                  valueLabelDisplay="auto"
                  sx={{ '& .MuiSlider-thumb': { bgcolor: '#10B981' }, '& .MuiSlider-track': { bgcolor: '#10B981' } }}
                />
                <Typography variant="caption" color="text.secondary">Ads scoring this or higher skip remaining iterations</Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Dimension Weights */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TuneRoundedIcon sx={{ fontSize: 18, color: '#8B5CF6' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>Dimension Weights</Typography>
            </Box>
            {config && Object.entries(config.dimension_weights).map(([dim, weight]) => {
              const color = DIM_COLORS[dim] || '#F26522';
              return (
                <Box key={dim} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem' }}>
                      {DIM_LABELS[dim] || dim}
                    </Typography>
                    <Chip label={`${(weight * 100).toFixed(0)}%`} size="small" sx={{ fontWeight: 700, height: 20, bgcolor: `${color}15`, color, border: `1px solid ${color}30` }} />
                  </Box>
                  <LinearProgress variant="determinate" value={weight * 100} sx={{ height: 5, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 } }} />
                </Box>
              );
            })}
          </Paper>
        </Grid>

        {/* Cost Per Token */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PaidRoundedIcon sx={{ fontSize: 18, color: '#F59E0B' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>Cost Per Token</Typography>
            </Box>
            {config && Object.entries(config.cost_per_token).map(([model, rates]) => {
              const shortName = model.split('/').pop() || model;
              return (
                <Box key={model} sx={{ mb: 2 }}>
                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem', color: '#F26522', display: 'block', mb: 0.5 }}>
                    {shortName}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Chip label={`In: $${rates.input}`} size="small" sx={{ fontWeight: 600, height: 20, bgcolor: 'action.hover' }} />
                    <Chip label={`Out: $${rates.output}`} size="small" sx={{ fontWeight: 600, height: 20, bgcolor: 'action.hover' }} />
                    {rates.per_image && <Chip label={`Img: $${rates.per_image}`} size="small" sx={{ fontWeight: 600, height: 20, bgcolor: 'rgba(242,101,34,0.08)', color: '#F26522' }} />}
                  </Box>
                </Box>
              );
            })}
          </Paper>
        </Grid>

        {/* Brand Voice */}
        <Grid size={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <RecordVoiceOverRoundedIcon sx={{ fontSize: 18, color: '#06D6A0' }} />
              <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>Brand Voice</Typography>
              {config && <Chip label={config.brand.name} size="small" sx={{ fontWeight: 700, bgcolor: 'rgba(242,101,34,0.08)', color: '#F26522', border: '1px solid rgba(242,101,34,0.15)' }} />}
            </Box>
            {config && (
              <>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5, fontSize: '0.88rem' }}>
                  {config.brand.voice}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {config.brand.principles.map((p, i) => (
                    <Chip key={i} label={p} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                  ))}
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled" sx={{ borderRadius: '10px', fontWeight: 600 }}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
