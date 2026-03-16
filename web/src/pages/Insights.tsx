import { useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import PsychologyRoundedIcon from '@mui/icons-material/PsychologyRounded';
import EmojiObjectsRoundedIcon from '@mui/icons-material/EmojiObjectsRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import api from '../api/client';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

interface Insight {
  insight_type: string;
  insight_text: string;
  audience_segment?: string;
  campaign_goal?: string;
  sample_count?: number;
  avg_score_impact?: number;
}

const TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  winning_pattern: { label: 'Winning Patterns', color: '#10B981', icon: <EmojiObjectsRoundedIcon /> },
  weak_dimension: { label: 'Weak Dimensions', color: '#F59E0B', icon: <TrendingDownRoundedIcon /> },
  refinement_tip: { label: 'Refinement Tips', color: '#6366F1', icon: <TipsAndUpdatesRoundedIcon /> },
  top_performer: { label: 'Top Performers', color: '#F26522', icon: <StarRoundedIcon /> },
};

function StatCard({ label, value, color, delay }: { label: string; value: number; color: string; delay: number }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
        animation: `${fadeInUp} 0.4s ease-out ${delay}ms both`,
      }}
    >
      <Typography variant="h3" fontWeight={800} sx={{ color, mb: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
        {label}
      </Typography>
    </Paper>
  );
}

function InsightSection({ type, insights }: { type: string; insights: Insight[] }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [open, setOpen] = useState(true);
  const meta = TYPE_META[type] || { label: type, color: '#94A3B8', icon: <EmojiObjectsRoundedIcon /> };

  if (insights.length === 0) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
        overflow: 'hidden',
        mb: 2,
        animation: `${fadeInUp} 0.4s ease-out 200ms both`,
      }}
    >
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          py: 2,
          cursor: 'pointer',
          '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
        }}
      >
        <Box sx={{ color: meta.color, display: 'flex', alignItems: 'center' }}>
          {meta.icon}
        </Box>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1, fontSize: '0.92rem' }}>
          {meta.label}
        </Typography>
        <Chip label={insights.length} size="small" sx={{ fontWeight: 700, fontSize: '0.75rem', height: 24, bgcolor: `${meta.color}15`, color: meta.color }} />
        <IconButton size="small" sx={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <ExpandMoreRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Box sx={{ px: 2.5, pb: 2 }}>
          {insights.map((insight, i) => (
            <Box
              key={i}
              sx={{
                py: 1.5,
                borderTop: i > 0 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
              }}
            >
              <Typography variant="body2" sx={{ fontSize: '0.85rem', mb: 1, lineHeight: 1.6 }}>
                {insight.insight_text}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {insight.audience_segment && (
                  <Chip
                    label={insight.audience_segment}
                    size="small"
                    sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
                  />
                )}
                {insight.campaign_goal && (
                  <Chip
                    label={insight.campaign_goal}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
                  />
                )}
                {insight.sample_count != null && (
                  <Chip
                    label={`${insight.sample_count} samples`}
                    size="small"
                    sx={{
                      fontSize: '0.68rem',
                      height: 22,
                      fontWeight: 600,
                      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    }}
                  />
                )}
                {insight.avg_score_impact != null && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      color: insight.avg_score_impact >= 0 ? '#10B981' : '#EF4444',
                    }}
                  >
                    {insight.avg_score_impact >= 0 ? '+' : ''}{insight.avg_score_impact.toFixed(1)} avg impact
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function Insights() {
  usePageTitle('Insights');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/pipeline/insights').then(r => {
      setInsights(r.data.insights || []);
    }).catch(() => {
      setInsights([]);
    }).finally(() => setLoading(false));
  }, []);

  const grouped = insights.reduce<Record<string, Insight[]>>((acc, item) => {
    const t = item.insight_type || 'other';
    if (!acc[t]) acc[t] = [];
    acc[t].push(item);
    return acc;
  }, {});

  const totalInsights = insights.length;
  const winningPatterns = (grouped['winning_pattern'] || []).length;
  const weakDimensions = (grouped['weak_dimension'] || []).length;

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={300} height={36} sx={{ mb: 2, borderRadius: '10px' }} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[0, 1, 2].map(i => (
            <Grid key={i} size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={100} sx={{ borderRadius: '14px' }} />
            </Grid>
          ))}
        </Grid>
        {[0, 1].map(i => (
          <Skeleton key={i} variant="rounded" height={120} sx={{ borderRadius: '14px', mb: 2 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, animation: `${fadeInUp} 0.4s ease-out both` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <PsychologyRoundedIcon sx={{ fontSize: 28, color: '#6366F1' }} />
          <Typography variant="h5" fontWeight={800} sx={{ fontSize: '1.4rem' }}>
            System Intelligence
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', pl: 0.5 }}>
          What the engine has learned across runs
        </Typography>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard label="Total Insights" value={totalInsights} color="#6366F1" delay={0} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard label="Winning Patterns" value={winningPatterns} color="#10B981" delay={60} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard label="Weak Dimensions" value={weakDimensions} color="#F59E0B" delay={120} />
        </Grid>
      </Grid>

      {/* Insight sections */}
      {totalInsights === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 5,
            borderRadius: '14px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'white',
            textAlign: 'center',
            animation: `${fadeInUp} 0.4s ease-out 200ms both`,
          }}
        >
          <PsychologyRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
          <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
            No insights yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Run the pipeline to start learning
          </Typography>
        </Paper>
      ) : (
        ['winning_pattern', 'weak_dimension', 'refinement_tip', 'top_performer'].map(type =>
          grouped[type] ? <InsightSection key={type} type={type} insights={grouped[type]} /> : null,
        )
      )}
    </Box>
  );
}
