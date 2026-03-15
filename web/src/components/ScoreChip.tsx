import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';

interface Props {
  score: number;
  label?: string;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'glow';
}

export default function ScoreChip({ score, label, size = 'small', variant = 'filled' }: Props) {
  const color = score >= 8 ? '#10B981' : score >= 7 ? '#F26522' : score >= 5 ? '#F59E0B' : '#EF4444';
  const text = label || `${score.toFixed(1)}`;

  if (variant === 'glow') {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: size === 'medium' ? 1.5 : 1,
          py: size === 'medium' ? 0.5 : 0.25,
          borderRadius: '8px',
          background: `${color}15`,
          border: `1px solid ${color}30`,
          boxShadow: `0 0 15px ${color}10`,
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            bgcolor: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
        <Box
          component="span"
          sx={{
            fontSize: size === 'medium' ? '0.9rem' : '0.75rem',
            fontWeight: 800,
            color,
            letterSpacing: '-0.02em',
          }}
        >
          {text}
        </Box>
      </Box>
    );
  }

  return (
    <Chip
      label={text}
      size={size}
      sx={{
        fontWeight: 800,
        fontSize: size === 'medium' ? '0.9rem' : '0.75rem',
        bgcolor: `${color}18`,
        color,
        border: `1px solid ${color}30`,
        letterSpacing: '-0.02em',
        '& .MuiChip-label': { px: size === 'medium' ? 1.5 : 1 },
      }}
    />
  );
}
