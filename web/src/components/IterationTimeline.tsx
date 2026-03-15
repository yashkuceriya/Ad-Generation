import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import ScoreChip from './ScoreChip';
import type { CopyIteration } from '../types';

interface Props {
  iterations: CopyIteration[];
  bestIndex: number;
}

export default function IterationTimeline({ iterations, bestIndex }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
      {/* Vertical connector line */}
      <Box
        sx={{
          position: 'absolute',
          left: 23,
          top: 24,
          bottom: 24,
          width: 2,
          bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
          borderRadius: 1,
        }}
      />

      {iterations.map((iter, idx) => {
        const isBest = idx === bestIndex;
        const prevScore = idx > 0 ? iterations[idx - 1].evaluation.weighted_average : null;
        const diff = prevScore !== null ? iter.evaluation.weighted_average - prevScore : null;
        const improved = diff !== null && diff > 0;
        const accentColor = isBest ? '#10B981' : '#F26522';

        return (
          <Box key={idx} sx={{ display: 'flex', gap: 2.5, position: 'relative' }}>
            {/* Timeline dot */}
            <Box sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 48, flexShrink: 0 }}>
              <Box
                sx={{
                  width: isBest ? 14 : 10,
                  height: isBest ? 14 : 10,
                  borderRadius: '50%',
                  bgcolor: accentColor,
                  border: `2px solid ${accentColor}`,
                  boxShadow: isBest ? `0 0 12px ${accentColor}50` : 'none',
                  position: 'relative',
                  zIndex: 1,
                }}
              />
            </Box>

            {/* Content */}
            <Paper
              sx={{
                p: 2.5,
                flex: 1,
                mb: 2,
                border: isBest ? `1px solid ${accentColor}25` : undefined,
                bgcolor: isBest ? `${accentColor}${isDark ? '12' : '05'}` : undefined,
                transition: 'all 0.2s',
                '&:hover': { borderColor: `${accentColor}30` },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="overline" color="text.secondary">
                  ITERATION {iter.iteration_number}
                </Typography>
                <ScoreChip score={iter.evaluation.weighted_average} variant="glow" />
                {isBest && (
                  <Chip
                    icon={<StarRoundedIcon sx={{ fontSize: '14px !important' }} />}
                    label="BEST"
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.6rem',
                      height: 22,
                      bgcolor: 'rgba(16,185,129,0.1)',
                      color: '#10B981',
                      border: '1px solid rgba(16,185,129,0.2)',
                    }}
                  />
                )}
                {diff !== null && (
                  <Chip
                    icon={improved
                      ? <TrendingUpRoundedIcon sx={{ fontSize: '14px !important' }} />
                      : <TrendingDownRoundedIcon sx={{ fontSize: '14px !important' }} />
                    }
                    label={`${improved ? '+' : ''}${diff.toFixed(2)}`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      height: 22,
                      bgcolor: improved ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                      color: improved ? '#10B981' : '#F59E0B',
                      border: `1px solid ${improved ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}`,
                    }}
                  />
                )}
              </Box>

              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75, letterSpacing: '-0.01em', fontSize: '0.95rem' }}>
                {iter.ad_copy.headline}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.7, fontSize: '0.88rem', color: 'text.secondary' }}>
                {iter.ad_copy.primary_text}
              </Typography>

              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {Object.entries(iter.evaluation.scores).map(([dim, s]) => {
                  const isWeakest = dim === iter.evaluation.weakest_dimension;
                  const c = s.score >= 8 ? '#10B981' : s.score >= 6 ? '#F26522' : s.score >= 4 ? '#F59E0B' : '#EF4444';
                  return (
                    <Box
                      key={dim}
                      sx={{
                        px: 1.25,
                        py: 0.5,
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        bgcolor: isWeakest ? 'rgba(245,158,11,0.08)' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                        color: isWeakest ? '#F59E0B' : 'text.secondary',
                        border: `1px solid ${isWeakest ? 'rgba(245,158,11,0.15)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                        display: 'flex', alignItems: 'center', gap: 0.75,
                      }}
                    >
                      <span style={{ textTransform: 'capitalize' }}>{dim.replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 800, color: c }}>{s.score.toFixed(1)}</span>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          </Box>
        );
      })}
    </Box>
  );
}
