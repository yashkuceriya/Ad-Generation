import { useEffect, useState } from 'react';
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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { getTrustSignals } from '../api/endpoints';
import type { TrustSignals } from '../types';

function computeTrustScore(signals: TrustSignals['signals']): number {
  const confidence = signals.evaluator_confidence.average * 1000; // 0-1 -> 0-100
  const complianceRate = signals.compliance.pass_rate !== null ? signals.compliance.pass_rate * 100 : 100;
  const consistencyPenalty = Math.min(signals.score_consistency.avg_iteration_range * 10, 40); // cap penalty
  const consistency = 100 - consistencyPenalty;
  return confidence * 0.4 + complianceRate * 0.35 + consistency * 0.25;
}

function trustColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

const STATUS_CHIP_COLORS: Record<string, { color: string; bg: string }> = {
  generated: { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  evaluator_pass: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)' },
  compliance_pass: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  human_approved: { color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  experiment_ready: { color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  below_threshold: { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  iterating: { color: '#6B7280', bg: 'rgba(107,114,128,0.1)' },
  rejected: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
};

export default function TrustCenter() {
  usePageTitle('Trust Center');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();
  const [data, setData] = useState<TrustSignals | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getTrustSignals()
      .then(r => { setData(r.data); setError(false); })
      .catch(() => setError(true));
  }, []);

  // Loading state
  if (!data && !error) {
    return (
      <Box>
        <Skeleton variant="rounded" height={120} animation="wave" sx={{ mb: 3, borderRadius: '16px' }} />
        <Grid container spacing={2.5}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rounded" height={180} animation="wave" sx={{ borderRadius: '12px' }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // Error or no data state
  if (error || !data || data.status === 'no_data' || !data.signals?.evaluator_confidence) {
    return (
      <Box>
        {/* Header */}
        <Box
          sx={{
            mb: 3.5, p: 3.5, borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(100,116,139,0.06) 0%, rgba(242,101,34,0.03) 100%)',
            border: '1px solid rgba(100,116,139,0.15)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box
                sx={{
                  width: 36, height: 36, borderRadius: '10px',
                  background: 'linear-gradient(135deg, #64748B, #475569)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <VerifiedUserRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
              </Box>
              <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                Trust Center
              </Typography>
            </Box>
          </Box>
        </Box>

        <Paper
          sx={{
            p: 6, textAlign: 'center',
            border: '1px dashed rgba(242,101,34,0.15)',
            bgcolor: 'transparent',
          }}
        >
          <VerifiedUserRoundedIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3, mb: 2 }} />
          <Typography variant="h6" fontWeight={700} color="text.secondary" gutterBottom>
            {error ? 'Failed to load trust signals' : 'No data yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7 }}>
            {error
              ? 'Make sure the backend server is running and try again.'
              : 'Run the pipeline to generate ads, then trust signals will appear here.'}
          </Typography>
        </Paper>
      </Box>
    );
  }

  const signals = data.signals;
  const trustScore = computeTrustScore(signals);
  const tColor = trustColor(trustScore);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          mb: 3.5,
          p: 3.5,
          borderRadius: '20px',
          background: `linear-gradient(135deg, ${tColor}10 0%, rgba(242,101,34,0.03) 100%)`,
          border: `1px solid ${tColor}25`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            borderRadius: '50%', background: `radial-gradient(circle, ${tColor}12, transparent 70%)`,
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: `linear-gradient(135deg, ${tColor}, ${tColor}CC)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <VerifiedUserRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
              Trust Center
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mt: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="overline" sx={{ fontSize: '0.55rem', color: 'text.secondary', letterSpacing: '0.08em' }}>
                OVERALL TRUST
              </Typography>
              <Typography
                variant="h3"
                fontWeight={900}
                sx={{ color: tColor, lineHeight: 1 }}
              >
                {trustScore.toFixed(0)}%
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={trustScore}
                sx={{
                  height: 10, borderRadius: 5,
                  bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  '& .MuiLinearProgress-bar': { bgcolor: tColor, borderRadius: 5 },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mt: 0.5, display: 'block' }}>
                Based on evaluator confidence (40%), compliance rate (35%), and score consistency (25%)
              </Typography>
            </Box>
            <Chip
              label={`${data.total_ads} ads`}
              size="small"
              sx={{
                fontWeight: 700, fontSize: '0.7rem',
                bgcolor: 'rgba(242,101,34,0.1)', color: '#F26522',
                border: '1px solid rgba(242,101,34,0.2)',
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* Signal Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Evaluator Confidence */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Paper
            sx={{
              p: 2.5, height: '100%',
              border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary', letterSpacing: '0.08em' }}>
              EVALUATOR CONFIDENCE
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 1 }}>
              <Typography variant="h4" fontWeight={800}>
                {(signals.evaluator_confidence.average * 100).toFixed(0)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">average</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={signals.evaluator_confidence.average * 100}
              sx={{
                mt: 1.5, height: 6, borderRadius: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: signals.evaluator_confidence.average >= 0.8 ? '#10B981' : signals.evaluator_confidence.average >= 0.6 ? '#F59E0B' : '#EF4444',
                  borderRadius: 3,
                },
              }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {signals.evaluator_confidence.low_confidence_count} low-confidence
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {signals.evaluator_confidence.total_evaluations} total
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Score Consistency */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Paper
            sx={{
              p: 2.5, height: '100%',
              border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary', letterSpacing: '0.08em' }}>
              SCORE CONSISTENCY
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 1 }}>
              <Typography variant="h4" fontWeight={800}>
                {signals.score_consistency.avg_iteration_range.toFixed(2)}
              </Typography>
              <Typography variant="caption" color="text.secondary">avg range (lower is better)</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.max(0, 100 - signals.score_consistency.avg_iteration_range * 10)}
              sx={{
                mt: 1.5, height: 6, borderRadius: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: signals.score_consistency.avg_iteration_range <= 1 ? '#10B981' : signals.score_consistency.avg_iteration_range <= 3 ? '#F59E0B' : '#EF4444',
                  borderRadius: 3,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mt: 1.5, display: 'block' }}>
              {signals.score_consistency.multi_iteration_ads} ads with multiple iterations
            </Typography>
          </Paper>
        </Grid>

        {/* Compliance Rate */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Paper
            sx={{
              p: 2.5, height: '100%',
              border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary', letterSpacing: '0.08em' }}>
              COMPLIANCE RATE
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 1 }}>
              <Typography variant="h4" fontWeight={800}>
                {signals.compliance.pass_rate !== null ? `${(signals.compliance.pass_rate * 100).toFixed(0)}%` : 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">pass rate</Typography>
            </Box>
            {signals.compliance.pass_rate !== null && (
              <LinearProgress
                variant="determinate"
                value={signals.compliance.pass_rate * 100}
                sx={{
                  mt: 1.5, height: 6, borderRadius: 3,
                  bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: signals.compliance.pass_rate >= 0.9 ? '#10B981' : signals.compliance.pass_rate >= 0.7 ? '#F59E0B' : '#EF4444',
                    borderRadius: 3,
                  },
                }}
              />
            )}
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', mt: 1.5, display: 'block' }}>
              {signals.compliance.checked} ads checked
            </Typography>
          </Paper>
        </Grid>

        {/* Score Distribution */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Paper
            sx={{
              p: 2.5, height: '100%',
              border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary', letterSpacing: '0.08em' }}>
              SCORE DISTRIBUTION
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 1 }}>
              <Typography variant="h4" fontWeight={800}>
                {signals.score_distribution.mean.toFixed(1)}
              </Typography>
              <Typography variant="caption" color="text.secondary">mean score</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
              <Chip label={`Std: ${signals.score_distribution.std_dev.toFixed(2)}`} size="small" sx={{ fontSize: '0.68rem', fontWeight: 600 }} />
              <Chip label={`Min: ${signals.score_distribution.min.toFixed(1)}`} size="small" sx={{ fontSize: '0.68rem', fontWeight: 600 }} />
              <Chip label={`Max: ${signals.score_distribution.max.toFixed(1)}`} size="small" sx={{ fontSize: '0.68rem', fontWeight: 600 }} />
            </Box>
          </Paper>
        </Grid>

        {/* Dimension Agreement */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Paper
            sx={{
              p: 2.5, height: '100%',
              border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary', letterSpacing: '0.08em' }}>
              DIMENSION AGREEMENT
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5, mb: 1.5 }}>
              Spread: {signals.dimension_agreement.dimension_spread.toFixed(2)}
              {signals.dimension_agreement.dimension_spread > 2 ? ' (high variance)' : ''}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {Object.entries(signals.dimension_agreement.dimension_averages).map(([dim, avg]) => {
                const c = avg >= 8 ? '#10B981' : avg >= 6 ? '#F26522' : avg >= 4 ? '#F59E0B' : '#EF4444';
                const highVariance = signals.dimension_agreement.dimension_spread > 2;
                return (
                  <Box key={dim} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', minWidth: 90, textTransform: 'capitalize', color: 'text.secondary' }}>
                      {dim.replace(/_/g, ' ')}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={avg * 10}
                      sx={{
                        flex: 1, height: 4, borderRadius: 2,
                        bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        '& .MuiLinearProgress-bar': { bgcolor: c, borderRadius: 2 },
                      }}
                    />
                    <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.72rem', color: c, minWidth: 24, textAlign: 'right' }}>
                      {avg.toFixed(1)}
                    </Typography>
                    {highVariance && (
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#F59E0B', flexShrink: 0 }} />
                    )}
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>

        {/* Readiness Pipeline */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Paper
            sx={{
              p: 2.5, height: '100%',
              border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}
          >
            <Typography variant="overline" sx={{ fontSize: '0.6rem', color: 'text.secondary', letterSpacing: '0.08em' }}>
              READINESS PIPELINE
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1.5 }}>
              {Object.entries(signals.readiness_status).map(([status, count]) => {
                const chipColors = STATUS_CHIP_COLORS[status] || { color: '#6B7280', bg: 'rgba(107,114,128,0.1)' };
                return (
                  <Box key={status} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Chip
                      label={status.replace(/_/g, ' ')}
                      size="small"
                      sx={{
                        fontWeight: 600, fontSize: '0.68rem', textTransform: 'capitalize',
                        bgcolor: chipColors.bg, color: chipColors.color,
                        border: `1px solid ${chipColors.color}30`,
                      }}
                    />
                    <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>
                      {count}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Needs Review */}
      {data.needs_review.length > 0 && (
        <Paper
          sx={{
            p: 2.5,
            border: '1px solid rgba(245,158,11,0.2)',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(245,158,11,0.01))',
          }}
        >
          <Typography variant="overline" sx={{ fontSize: '0.6rem', color: '#F59E0B', letterSpacing: '0.08em', mb: 2, display: 'block' }}>
            NEEDS REVIEW ({data.needs_review.length})
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Brief ID</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Score</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Reasons</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }} align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.needs_review.map((item) => {
                  const chipColors = STATUS_CHIP_COLORS[item.status] || { color: '#6B7280', bg: 'rgba(107,114,128,0.1)' };
                  return (
                    <TableRow key={item.brief_id} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' } }}>
                      <TableCell sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {item.brief_id}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontWeight={700}
                          sx={{
                            fontSize: '0.85rem',
                            color: item.score >= 8 ? '#10B981' : item.score >= 6 ? '#F26522' : '#EF4444',
                          }}
                        >
                          {item.score.toFixed(1)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.status.replace(/_/g, ' ')}
                          size="small"
                          sx={{
                            fontWeight: 600, fontSize: '0.65rem', textTransform: 'capitalize',
                            bgcolor: chipColors.bg, color: chipColors.color,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {item.reasons.map((reason, i) => (
                            <Chip
                              key={i}
                              label={reason}
                              size="small"
                              sx={{
                                fontSize: '0.62rem', height: 20,
                                bgcolor: 'rgba(245,158,11,0.08)', color: '#F59E0B',
                                border: '1px solid rgba(245,158,11,0.15)',
                              }}
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 14 }} />}
                          onClick={() => navigate(`/ads/${item.brief_id}`)}
                          sx={{
                            textTransform: 'none', fontSize: '0.72rem', fontWeight: 600,
                            color: '#F26522',
                          }}
                        >
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
