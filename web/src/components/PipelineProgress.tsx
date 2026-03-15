import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import type { PipelineStatus } from '../types';

interface Props {
  status: PipelineStatus;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  running: { color: '#F26522', bg: 'rgba(242,101,34,0.06)', border: 'rgba(242,101,34,0.2)', label: 'RUNNING' },
  completed: { color: '#10B981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.2)', label: 'COMPLETED' },
  error: { color: '#EF4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.2)', label: 'ERROR' },
  stopped: { color: '#F59E0B', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', label: 'STOPPED' },
  idle: { color: '#64748B', bg: 'transparent', border: 'rgba(100,116,139,0.15)', label: 'IDLE' },
};

export default function PipelineProgress({ status }: Props) {
  if (status.status === 'idle') return null;

  const config = STATUS_CONFIG[status.status] || STATUS_CONFIG.idle;
  const runAds = status.completed_run_ads ?? 0;
  const progress = status.total_briefs > 0
    ? (runAds / status.total_briefs) * 100
    : 0;

  const phaseLabel = status.current_phase
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Paper sx={{ p: 2.5, bgcolor: config.bg, border: `1px solid ${config.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.25,
              py: 0.4,
              borderRadius: '6px',
              bgcolor: `${config.color}15`,
              border: `1px solid ${config.color}25`,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor: config.color,
                boxShadow: status.status === 'running' ? `0 0 8px ${config.color}` : 'none',
                animation: status.status === 'running' ? 'pulse 1.5s ease-in-out infinite' : 'none',
                '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
              }}
            />
            <Typography variant="caption" fontWeight={700} sx={{ color: config.color, letterSpacing: '0.06em', fontSize: '0.65rem' }}>
              {config.label}
            </Typography>
          </Box>
          {status.status === 'running' && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
              {status.current_brief_id} — {phaseLabel}
            </Typography>
          )}
        </Box>
        <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.88rem' }}>
          {runAds}/{status.total_briefs}
        </Typography>
      </Box>

      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 5,
          '& .MuiLinearProgress-bar': {
            background: `linear-gradient(90deg, ${config.color}, ${config.color}90)`,
            boxShadow: `0 0 12px ${config.color}40`,
          },
        }}
      />

      {status.elapsed_seconds != null && status.status === 'running' && runAds > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontSize: '0.7rem' }}>
          {Math.round(status.elapsed_seconds)}s elapsed · ~{Math.round(
            (status.elapsed_seconds / runAds) * (status.total_briefs - runAds)
          )}s remaining
        </Typography>
      )}

      {status.error && (
        <Typography variant="body2" color="error" sx={{ mt: 1, fontSize: '0.82rem' }}>
          {status.error}
        </Typography>
      )}
    </Paper>
  );
}
