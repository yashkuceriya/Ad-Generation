import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import Fade from '@mui/material/Fade';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import AnimatedNumber from '../components/AnimatedNumber';
import { getExperimentPack } from '../api/endpoints';
import type { ExperimentPackItem, ExperimentPackSummary } from '../api/endpoints';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ScoreRing({ score }: { score: number }) {
  const theme = useTheme();
  const color = score >= 8 ? '#10B981' : score >= 6 ? '#F59E0B' : '#EF4444';
  const pct = (score / 10) * 100;
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex', width: 48, height: 48 }}>
      <CircularProgress
        variant="determinate"
        value={100}
        size={48}
        thickness={3}
        sx={{ color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', position: 'absolute' }}
      />
      <CircularProgress
        variant="determinate"
        value={pct}
        size={48}
        thickness={3}
        sx={{ color, position: 'absolute' }}
      />
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.72rem', color }}>
          {score.toFixed(1)}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ExperimentPack() {
  usePageTitle('Experiment Packs');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [packs, setPacks] = useState<ExperimentPackItem[]>([]);
  const [summary, setSummary] = useState<ExperimentPackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await getExperimentPack();
      setPacks(data.packs);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiment packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => {
    downloadFile(JSON.stringify({ packs, summary }, null, 2), 'experiment-launch-packs.json', 'application/json');
  };

  const summaryCards = [
    { label: 'Ready to Launch', value: summary?.total_ready ?? 0, color: '#F26522' },
    { label: 'With Variants', value: summary?.total_with_variants ?? 0, color: '#8B5CF6' },
    { label: 'With Images', value: summary?.total_with_images ?? 0, color: '#10B981' },
    { label: 'Avg Score', value: summary?.avg_score ?? 0, color: '#F59E0B', decimals: 1, suffix: '/10' },
  ];

  return (
    <Fade in timeout={400}>
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40, height: 40, borderRadius: '12px',
                background: 'linear-gradient(135deg, #F26522 0%, #FF8A50 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <RocketLaunchRoundedIcon sx={{ fontSize: 22, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ fontSize: '1.3rem' }}>
                Experiment Launch Packs
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                Structured test packages for experiment-ready ads
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<DownloadRoundedIcon />}
            onClick={handleExport}
            disabled={packs.length === 0}
            sx={{
              bgcolor: '#F26522', fontWeight: 700, fontSize: '0.82rem', textTransform: 'none',
              borderRadius: '10px', px: 2.5,
              '&:hover': { bgcolor: '#D4541A' },
              '&.Mui-disabled': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
            }}
          >
            Export Launch Pack
          </Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {summaryCards.map((card, i) => (
            <Grid key={card.label} size={{ xs: 6, md: 3 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5, borderRadius: '14px',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
                  animation: `${fadeInUp} 0.4s ease-out ${i * 0.08}s both`,
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {card.label}
                </Typography>
                <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, color: card.color, fontSize: '1.6rem' }}>
                  {loading ? (
                    <Skeleton width={60} />
                  ) : (
                    <AnimatedNumber value={card.value} decimals={card.decimals ?? 0} suffix={card.suffix ?? ''} />
                  )}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Content */}
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={160} sx={{ borderRadius: '14px' }} />
            ))}
          </Box>
        ) : error ? (
          <Paper
            elevation={0}
            sx={{
              p: 4, textAlign: 'center', borderRadius: '14px',
              border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.15)'}`,
              bgcolor: isDark ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.03)',
            }}
          >
            <WarningAmberRoundedIcon sx={{ fontSize: 40, color: '#EF4444', mb: 1 }} />
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              Failed to load
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {error}
            </Typography>
          </Paper>
        ) : packs.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 6, textAlign: 'center', borderRadius: '14px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
            }}
          >
            <ScienceRoundedIcon sx={{ fontSize: 48, color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', mb: 1.5 }} />
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
              No Experiment-Ready Ads
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, mx: 'auto' }}>
              Ads must be approved and marked as experiment-ready before they appear here. Head to the Review Queue to approve ads.
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {packs.map((pack, i) => (
              <Paper
                key={pack.brief_id}
                elevation={0}
                sx={{
                  p: 2.5, borderRadius: '14px',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
                  animation: `${fadeInUp} 0.4s ease-out ${i * 0.06}s both`,
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: 'rgba(242,101,34,0.3)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
                  {/* Score ring */}
                  <ScoreRing score={pack.score} />

                  {/* Main content */}
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    {/* Headline + chips */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: '0.92rem' }}>
                        {pack.headline}
                      </Typography>
                      <Chip
                        label={pack.audience}
                        size="small"
                        sx={{
                          fontWeight: 600, fontSize: '0.65rem', height: 22,
                          bgcolor: isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)',
                          color: '#8B5CF6',
                        }}
                      />
                      <Chip
                        label={pack.goal}
                        size="small"
                        sx={{
                          fontWeight: 600, fontSize: '0.65rem', height: 22,
                          bgcolor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
                          color: '#10B981',
                        }}
                      />
                      {pack.has_image && (
                        <Chip
                          icon={<ImageRoundedIcon sx={{ fontSize: '14px !important' }} />}
                          label="Image"
                          size="small"
                          sx={{
                            fontWeight: 600, fontSize: '0.65rem', height: 22,
                            bgcolor: isDark ? 'rgba(59,130,246,0.12)' : 'rgba(59,130,246,0.08)',
                            color: '#3B82F6',
                          }}
                        />
                      )}
                    </Box>

                    {/* Hypothesis */}
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', mb: 1, fontStyle: 'italic' }}>
                      {pack.hypothesis}
                    </Typography>

                    {/* Variant count + blockers */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        icon={<CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} />}
                        label={`${pack.variants.length} variant${pack.variants.length !== 1 ? 's' : ''}`}
                        size="small"
                        sx={{
                          fontWeight: 600, fontSize: '0.65rem', height: 22,
                          bgcolor: pack.variants.length > 0
                            ? (isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)')
                            : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                          color: pack.variants.length > 0 ? '#10B981' : 'text.secondary',
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                        ${pack.cost_usd.toFixed(4)}
                      </Typography>
                      {pack.readiness_blockers.map((blocker) => (
                        <Chip
                          key={blocker}
                          label={blocker}
                          size="small"
                          sx={{
                            fontWeight: 600, fontSize: '0.62rem', height: 20,
                            bgcolor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                            color: '#EF4444',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </Fade>
  );
}
