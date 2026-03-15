import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import ImageIcon from '@mui/icons-material/Image';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ScoreChip from './ScoreChip';
import type { AdResult } from '../types';

interface Props {
  ad: AdResult;
  onClick: () => void;
}

const AUDIENCE_COLORS: Record<string, string> = {
  parents: '#F26522',
  students: '#10B981',
  families: '#F59E0B',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  generated: { label: 'Generated', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.25)' },
  evaluator_pass: { label: 'Evaluator Pass', color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.25)' },
  compliance_pass: { label: 'Compliance Pass', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  published: { label: 'Published', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  human_approved: { label: 'Approved', color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.25)' },
  experiment_ready: { label: 'Experiment Ready', color: '#10B981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)' },
  below_threshold: { label: 'Below Threshold', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
  iterating: { label: 'Iterating', color: '#6B7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
  rejected: { label: 'Rejected', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
};

export default function AdCard({ ad, onClick }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const bestCopy = ad.copy_iterations[ad.best_copy_index];
  const score = bestCopy.evaluation.weighted_average;
  const hasImage = ad.image_iterations.length > 0;
  const bestImage = hasImage ? ad.image_iterations[ad.best_image_index] : null;
  const audienceColor = AUDIENCE_COLORS[ad.brief.audience_segment] || '#F26522';

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${audienceColor}, ${audienceColor}80)`,
          zIndex: 1,
        },
      }}
    >
      <CardActionArea
        onClick={onClick}
        aria-label={bestCopy.ad_copy.headline}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        {/* Image / Gradient Header */}
        {hasImage && bestImage?.image_url ? (
          <Box sx={{ height: 180, position: 'relative', overflow: 'hidden' }}>
            <Box
              component="img"
              src={bestImage.image_url}
              alt={bestCopy.ad_copy.headline}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '50%',
                background: isDark ? 'linear-gradient(transparent, rgba(18,18,24,0.9))' : 'linear-gradient(transparent, rgba(255,255,255,0.9))',
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              height: 160,
              background: isDark
                ? `linear-gradient(135deg, ${audienceColor}20 0%, rgba(30,30,40,0.8) 60%)`
                : `linear-gradient(135deg, ${audienceColor}20 0%, rgba(255,255,255,0.8) 60%)`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'flex-end',
              p: 2.5,
              position: 'relative',
              overflow: 'hidden',
              '&::after': {
                content: '""',
                position: 'absolute',
                top: -30,
                right: -30,
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: `${audienceColor}08`,
              },
            }}
          >
            <Typography
              variant="subtitle1"
              fontWeight={800}
              sx={{
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {bestCopy.ad_copy.headline}
            </Typography>
          </Box>
        )}

        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2.5, pt: 2 }}>
          {hasImage && (
            <Typography variant="subtitle2" fontWeight={700} gutterBottom noWrap sx={{ letterSpacing: '-0.01em' }}>
              {bestCopy.ad_copy.headline}
            </Typography>
          )}

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 2,
              flex: 1,
              fontSize: '0.82rem',
              lineHeight: 1.55,
            }}
          >
            {bestCopy.ad_copy.primary_text}
          </Typography>

          {/* Status + Footer */}
          {ad.status && STATUS_CONFIG[ad.status] && (
            <Box sx={{ mb: 1.5 }}>
              <Chip
                icon={(ad.status === 'published' || ad.status === 'human_approved' || ad.status === 'experiment_ready') ? <CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} /> : undefined}
                label={STATUS_CONFIG[ad.status].label}
                size="small"
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  height: 20,
                  color: STATUS_CONFIG[ad.status].color,
                  bgcolor: STATUS_CONFIG[ad.status].bg,
                  border: `1px solid ${STATUS_CONFIG[ad.status].border}`,
                  '& .MuiChip-icon': { color: STATUS_CONFIG[ad.status].color },
                }}
              />
              {ad.early_stopped && ad.early_stop_reason && (
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontSize: '0.58rem', color: 'text.secondary', opacity: 0.7 }}>
                  {ad.early_stop_reason}
                </Typography>
              )}
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={0.75} alignItems="center">
              <ScoreChip score={score} variant="glow" />
              <Chip
                label={ad.brief.audience_segment}
                size="small"
                sx={{
                  fontSize: '0.65rem',
                  height: 22,
                  bgcolor: `${audienceColor}10`,
                  color: audienceColor,
                  border: `1px solid ${audienceColor}20`,
                }}
              />
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {hasImage && <ImageIcon sx={{ fontSize: 14, color: 'text.secondary' }} />}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <AutoFixHighIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {ad.copy_iterations.length}x
                </Typography>
              </Box>
            </Stack>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
