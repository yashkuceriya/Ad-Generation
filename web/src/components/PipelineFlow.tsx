import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GradingRoundedIcon from '@mui/icons-material/GradingRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';

const STAGES = [
  { key: 'brief', label: 'Brief', icon: <DescriptionRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'generating', label: 'Generate', icon: <EditRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'evaluating', label: 'Evaluate', icon: <GradingRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'iterating', label: 'Iterate', icon: <AutorenewRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'compliance', label: 'Comply', icon: <VerifiedUserRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'imaging', label: 'Image', icon: <ImageRoundedIcon sx={{ fontSize: 18 }} /> },
  { key: 'done', label: 'Done', icon: <DoneAllRoundedIcon sx={{ fontSize: 18 }} /> },
];

// Map pipeline phase strings to stage index
function getStageIndex(phase: string): number {
  const p = phase.toLowerCase();
  if (p.includes('brief') || p.includes('research')) return 0;
  if (p.includes('generat') || p.includes('writing') || p.includes('copy_gen')) return 1;
  if (p.includes('eval') || p.includes('scor')) return 2;
  if (p.includes('iter') || p.includes('refin') || p.includes('edit')) return 3;
  if (p.includes('compliance') || p.includes('comply')) return 4;
  if (p.includes('image') || p.includes('imag')) return 5;
  if (p.includes('done') || p.includes('complete') || p.includes('export') || p.includes('select')) return 6;
  return -1;
}

interface Props {
  currentPhase: string;
  isRunning: boolean;
}

export default function PipelineFlow({ currentPhase, isRunning }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const activeIndex = isRunning ? getStageIndex(currentPhase) : -1;

  return (
    <Box
      role="progressbar"
      aria-label="Pipeline progress"
      aria-valuetext={isRunning ? `Current step: ${currentPhase}` : 'Pipeline idle'}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        py: 1.5,
        px: 1,
        overflowX: 'auto',
      }}
    >
      {STAGES.map((stage, i) => {
        const isComplete = isRunning && activeIndex > i;
        const isActive = isRunning && activeIndex === i;
        const isPending = !isRunning || activeIndex < i;

        return (
          <Box key={stage.key} aria-current={isActive ? 'step' : undefined} sx={{ display: 'flex', alignItems: 'center' }}>
            {/* Stage node */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                minWidth: 64,
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isComplete
                    ? 'rgba(16,185,129,0.12)'
                    : isActive
                    ? 'rgba(242,101,34,0.12)'
                    : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  border: `2px solid ${
                    isComplete ? '#10B981' : isActive ? '#F26522' : 'transparent'
                  }`,
                  color: isComplete
                    ? '#10B981'
                    : isActive
                    ? '#F26522'
                    : 'text.secondary',
                  transition: 'all 0.3s',
                  ...(isActive && {
                    animation: 'pipelinePulse 2s ease-in-out infinite',
                    '@keyframes pipelinePulse': {
                      '0%, 100%': { boxShadow: '0 0 0 0 rgba(242,101,34,0.2)' },
                      '50%': { boxShadow: '0 0 0 6px rgba(242,101,34,0.08)' },
                    },
                    '@media (prefers-reduced-motion: reduce)': {
                      animation: 'none',
                    },
                  }),
                }}
              >
                {isComplete ? (
                  <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#10B981' }} />
                ) : (
                  stage.icon
                )}
              </Box>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: isActive ? 700 : 600,
                  color: isComplete
                    ? '#10B981'
                    : isActive
                    ? '#F26522'
                    : 'text.secondary',
                  letterSpacing: '0.02em',
                }}
              >
                {stage.label}
              </Typography>
            </Box>

            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <Box
                sx={{
                  width: 24,
                  height: 2,
                  mx: 0.25,
                  mb: 2,
                  borderRadius: 1,
                  bgcolor: isComplete
                    ? '#10B981'
                    : isActive
                    ? 'rgba(242,101,34,0.3)'
                    : isPending
                    ? isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
                    : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  transition: 'all 0.3s',
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
