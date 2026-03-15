import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import AdPreviewCard from '../components/AdPreviewCard';
import ScoreRadar from '../components/ScoreRadar';
import { getAd } from '../api/endpoints';
import type { AdResult, DimensionScore } from '../types';

function scoreColor(score: number): string {
  if (score >= 8) return '#10B981';
  if (score >= 6) return '#F59E0B';
  return '#EF4444';
}

export default function AdCompare() {
  usePageTitle('Compare Ads');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [ads, setAds] = useState<(AdResult | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 3);

  useEffect(() => {
    if (ids.length < 2) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const results = await Promise.all(ids.map((id) => getAd(id)));
        if (!cancelled) {
          setAds(results.map((r) => r.data));
        }
      } catch {
        if (!cancelled) {
          setError('Failed to load one or more ads.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('ids')]);

  // Collect all unique dimension keys across all loaded ads
  const allDimensions: string[] = [];
  const dimensionSet = new Set<string>();
  for (const ad of ads) {
    if (!ad) continue;
    const scores = ad.copy_iterations[ad.best_copy_index].evaluation.scores;
    for (const key of Object.keys(scores)) {
      if (!dimensionSet.has(key)) {
        dimensionSet.add(key);
        allDimensions.push(key);
      }
    }
  }

  const LABEL_MAP: Record<string, string> = {
    clarity: 'Clarity',
    value_proposition: 'Value Prop',
    cta_strength: 'CTA Strength',
    emotional_resonance: 'Emotion',
    brand_voice: 'Brand Voice',
  };

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
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.06), transparent 70%)',
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            onClick={() => navigate('/ads')}
            sx={{
              bgcolor: 'rgba(242,101,34,0.1)',
              color: '#F26522',
              '&:hover': { bgcolor: 'rgba(242,101,34,0.2)' },
            }}
          >
            <ArrowBackRoundedIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'linear-gradient(135deg, #F26522, #D4541A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <CompareArrowsRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                Ad Comparison
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                Comparing {ids.length} ads side-by-side
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* No IDs — guide user to gallery */}
      {ids.length < 2 && !loading && (
        <Paper
          sx={{
            textAlign: 'center',
            py: 8,
            px: 4,
            border: '1px dashed rgba(242,101,34,0.2)',
            bgcolor: 'rgba(242,101,34,0.02)',
            borderRadius: '16px',
          }}
        >
          <Box
            sx={{
              width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 2.5,
              background: 'linear-gradient(135deg, rgba(242,101,34,0.1), rgba(16,185,129,0.08))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <CompareArrowsRoundedIcon sx={{ fontSize: 28, color: '#F26522' }} />
          </Box>
          <Typography variant="h6" fontWeight={800} gutterBottom sx={{ letterSpacing: '-0.02em' }}>
            Select Ads to Compare
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto', lineHeight: 1.7 }}>
            Go to the Ad Library and check 2-3 ads using the checkboxes, then click the Compare button that appears at the bottom.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/ads')}
            sx={{
              px: 4, py: 1.25,
              background: 'linear-gradient(135deg, #F26522, #D4541A)',
              fontSize: '0.88rem', fontWeight: 700,
              borderRadius: '12px',
              textTransform: 'none',
              boxShadow: '0 4px 16px rgba(242,101,34,0.3)',
              '&:hover': { background: 'linear-gradient(135deg, #FF8A50, #F26522)' },
            }}
          >
            Go to Ad Library
          </Button>
        </Paper>
      )}

      {/* Fetch error */}
      {error && ids.length >= 2 && (
        <Paper
          sx={{
            textAlign: 'center',
            py: 8,
            border: '1px dashed rgba(239,68,68,0.3)',
            bgcolor: 'transparent',
          }}
        >
          <Typography variant="h6" fontWeight={700} color="#EF4444" gutterBottom>
            {error}
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: '#F26522', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
            onClick={() => navigate('/ads')}
          >
            Back to gallery
          </Typography>
        </Paper>
      )}

      {/* Loading state */}
      {loading && (
        <Grid container spacing={3}>
          {ids.map((id) => (
            <Grid size={{ xs: 12, md: ids.length === 2 ? 6 : 4 }} key={id}>
              <Paper sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
                <Skeleton variant="rounded" height={300} animation="wave" sx={{ borderRadius: '12px', mb: 2 }} />
                <Skeleton variant="rounded" height={250} animation="wave" sx={{ borderRadius: '12px', mb: 2 }} />
                <Skeleton variant="rounded" height={200} animation="wave" sx={{ borderRadius: '12px' }} />
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Winner analysis */}
      {!loading && !error && ads.length >= 2 && (() => {
        const validAds = ads.filter((a): a is AdResult => a !== null);
        if (validAds.length < 2) return null;
        const sorted = [...validAds].sort((a, b) =>
          b.copy_iterations[b.best_copy_index].evaluation.weighted_average
          - a.copy_iterations[a.best_copy_index].evaluation.weighted_average
        );
        const winner = sorted[0];
        const winnerScores = winner.copy_iterations[winner.best_copy_index].evaluation.scores;
        const winnerAvg = winner.copy_iterations[winner.best_copy_index].evaluation.weighted_average;
        const runnerUp = sorted[1];
        const runnerAvg = runnerUp.copy_iterations[runnerUp.best_copy_index].evaluation.weighted_average;
        const runnerScores = runnerUp.copy_iterations[runnerUp.best_copy_index].evaluation.scores;
        const winningDims = allDimensions.filter(d => (winnerScores[d]?.score ?? 0) > (runnerScores[d]?.score ?? 0));

        return (
          <Paper sx={{ p: 3, mb: 3, border: '1px solid rgba(16,185,129,0.15)', bgcolor: 'rgba(16,185,129,0.02)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1rem' }}>
                Winner Analysis
              </Typography>
              <Chip label={winner.brief_id} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem', bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)' }} />
            </Box>
            <Typography variant="body2" sx={{ lineHeight: 1.7, fontSize: '0.88rem', color: 'text.secondary' }}>
              <strong>{winner.brief_id}</strong> wins with a score of <strong>{winnerAvg.toFixed(1)}</strong> vs runner-up <strong>{runnerUp.brief_id}</strong> at <strong>{runnerAvg.toFixed(1)}</strong> (+{(winnerAvg - runnerAvg).toFixed(2)} lead).
              {winningDims.length > 0 && (
                <> It leads in {winningDims.map(d => LABEL_MAP[d] || d).join(', ')}.</>
              )}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              {allDimensions.map(d => {
                const wScore = winnerScores[d]?.score ?? 0;
                const rScore = runnerScores[d]?.score ?? 0;
                const delta = wScore - rScore;
                const deltaColor = delta > 0 ? '#10B981' : delta < 0 ? '#EF4444' : '#64748B';
                return (
                  <Chip
                    key={d}
                    label={`${LABEL_MAP[d] || d}: ${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                    size="small"
                    sx={{ fontWeight: 700, fontSize: '0.65rem', height: 22, bgcolor: `${deltaColor}12`, color: deltaColor, border: `1px solid ${deltaColor}25` }}
                  />
                );
              })}
            </Box>
          </Paper>
        );
      })()}

      {/* Comparison grid */}
      {!loading && !error && ads.length > 0 && (
        <>
          <Grid container spacing={3}>
            {ads.map((ad) => {
              if (!ad) return null;
              const bestCopy = ad.copy_iterations[ad.best_copy_index];
              const bestImage = ad.image_iterations.length > 0
                ? ad.image_iterations[ad.best_image_index]
                : null;
              const scores = bestCopy.evaluation.scores;
              const weightedAvg = bestCopy.evaluation.weighted_average;

              return (
                <Grid size={{ xs: 12, md: ids.length === 2 ? 6 : 4 }} key={ad.brief_id}>
                  <Paper
                    sx={{
                      p: 0,
                      overflow: 'hidden',
                      border: '1px solid', borderColor: 'divider',
                      borderRadius: '16px',
                    }}
                  >
                    {/* Brief ID & Score Header */}
                    <Box
                      sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid', borderColor: 'divider',
                        background: 'linear-gradient(135deg, rgba(242,101,34,0.05), transparent)',
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ letterSpacing: '-0.01em' }}>
                          {ad.brief_id}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5 }}>
                          <Chip
                            label={ad.brief.audience_segment}
                            size="small"
                            sx={{
                              fontSize: '0.65rem', height: 20,
                              bgcolor: 'rgba(242,101,34,0.1)', color: '#F26522',
                              border: '1px solid rgba(242,101,34,0.2)',
                            }}
                          />
                          <Chip
                            label={ad.brief.campaign_goal}
                            size="small"
                            sx={{
                              fontSize: '0.65rem', height: 20,
                              bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981',
                              border: '1px solid rgba(16,185,129,0.2)',
                            }}
                          />
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography
                          variant="h5"
                          fontWeight={900}
                          sx={{ color: scoreColor(weightedAvg), letterSpacing: '-0.02em' }}
                        >
                          {weightedAvg.toFixed(1)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          Overall
                        </Typography>
                      </Box>
                    </Box>

                    {/* Ad Preview (compact) */}
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                        <AdPreviewCard
                          copy={bestCopy.ad_copy}
                          imageUrl={bestImage?.image_url}
                          briefId={ad.brief_id}
                        />
                      </Box>
                    </Box>

                    {/* Score Radar */}
                    <Box sx={{ px: 2, pb: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, fontSize: '0.8rem' }}>
                        Score Breakdown
                      </Typography>
                      <ScoreRadar scores={scores} />
                    </Box>

                    {/* Dimension Score Table */}
                    <Box sx={{ px: 2, pb: 2 }}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell
                                sx={{
                                  fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary',
                                  borderBottom: '1px solid', borderColor: 'divider', py: 1,
                                }}
                              >
                                Dimension
                              </TableCell>
                              <TableCell
                                align="center"
                                sx={{
                                  fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary',
                                  borderBottom: '1px solid', borderColor: 'divider', py: 1,
                                }}
                              >
                                Score
                              </TableCell>
                              <TableCell
                                align="center"
                                sx={{
                                  fontWeight: 700, fontSize: '0.7rem', color: 'text.secondary',
                                  borderBottom: '1px solid', borderColor: 'divider', py: 1,
                                }}
                              >
                                Confidence
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {allDimensions.map((dim) => {
                              const ds: DimensionScore | undefined = scores[dim];
                              const dimScore = ds?.score ?? 0;
                              const confidence = ds?.confidence ?? 0;
                              return (
                                <TableRow key={dim}>
                                  <TableCell
                                    sx={{
                                      fontSize: '0.75rem', fontWeight: 600, py: 1,
                                      borderBottom: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                    }}
                                  >
                                    {LABEL_MAP[dim] || dim}
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{
                                      py: 1,
                                      borderBottom: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                                      <LinearProgress
                                        variant="determinate"
                                        value={dimScore * 10}
                                        sx={{
                                          width: 50, height: 5, borderRadius: 3,
                                          bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                          '& .MuiLinearProgress-bar': {
                                            borderRadius: 3,
                                            bgcolor: scoreColor(dimScore),
                                          },
                                        }}
                                      />
                                      <Typography
                                        sx={{
                                          fontSize: '0.72rem', fontWeight: 700,
                                          color: scoreColor(dimScore), minWidth: 28,
                                        }}
                                      >
                                        {dimScore.toFixed(1)}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{
                                      fontSize: '0.7rem', color: 'text.secondary', py: 1,
                                      borderBottom: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                    }}
                                  >
                                    {(confidence * 100).toFixed(0)}%
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>

                    {/* Cost footer */}
                    <Box
                      sx={{
                        px: 2, py: 1.5,
                        borderTop: '1px solid', borderColor: 'divider',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'rgba(242,101,34,0.02)',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        Cost: ${ad.total_cost_usd.toFixed(4)}
                      </Typography>
                      <Chip
                        label={`${ad.quality_per_dollar.toFixed(0)} Q/$`}
                        size="small"
                        sx={{
                          fontSize: '0.62rem', height: 20, fontWeight: 700,
                          bgcolor: 'rgba(16,185,129,0.1)', color: '#10B981',
                          border: '1px solid rgba(16,185,129,0.2)',
                        }}
                      />
                    </Box>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}
    </Box>
  );
}
