import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PublicIcon from '@mui/icons-material/Public';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import type { AdCopy } from '../types';

export interface ImageGenStep {
  label: string;
  status: 'pending' | 'active' | 'done';
  detail?: string;
}

interface Props {
  copy: AdCopy;
  imageUrl?: string;
  onGenerateImage?: () => void;
  onRegenerateImage?: () => void;
  imageLoading?: boolean;
  briefId?: string;
  imageGenSteps?: ImageGenStep[];
  cacheHit?: boolean;
}

/** Simple string hash to generate deterministic pseudo-random numbers per briefId */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pseudoRandom(seed: number, min: number, max: number): number {
  return min + (seed % (max - min + 1));
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  'Crafting image prompt': <BrushRoundedIcon sx={{ fontSize: 14 }} />,
  'Generating image': <AutoFixHighIcon sx={{ fontSize: 14 }} />,
  'Evaluating quality': <VisibilityRoundedIcon sx={{ fontSize: 14 }} />,
  'Refining image': <AutorenewRoundedIcon sx={{ fontSize: 14 }} />,
};

export default function AdPreviewCard({ copy, imageUrl, onGenerateImage, onRegenerateImage, imageLoading, briefId, imageGenSteps, cacheHit }: Props) {
  // Deterministic engagement numbers based on briefId
  const seed = hashCode(briefId || 'default');
  const likes = pseudoRandom(seed, 800, 2500);
  const comments = pseudoRandom(seed >> 3, 40, 180);
  const shares = pseudoRandom(seed >> 6, 15, 65);
  const likesDisplay = likes >= 1000 ? `${(likes / 1000).toFixed(1)}K` : String(likes);

  // Split primary text to show "See more" truncation like real FB
  const showSeeMore = copy.primary_text.length > 125;
  const truncatedText = showSeeMore ? copy.primary_text.slice(0, 125) : copy.primary_text;

  return (
    <Paper
      sx={{
        maxWidth: 480,
        overflow: 'hidden',
        borderRadius: '12px',
        border: '1px solid rgba(0,0,0,0.08)',
        bgcolor: '#242526', // Facebook dark mode card color
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }}
    >
      {/* Page header — Facebook style */}
      <Box sx={{ p: 1.5, px: 2, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Avatar
          sx={{
            width: 40,
            height: 40,
            bgcolor: '#1A73E8',
            fontSize: '0.8rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}
        >
          VT
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.25, color: '#E4E6EB' }}>
            Varsity Tutors
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#B0B3B8' }}>
              Sponsored
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#B0B3B8' }}> · </Typography>
            <PublicIcon sx={{ fontSize: 12, color: '#B0B3B8' }} />
          </Box>
        </Box>
        <IconButton size="small" aria-label="More options" sx={{ color: '#B0B3B8' }}>
          <MoreHorizIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" aria-label="Close ad" sx={{ color: '#B0B3B8' }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Primary Text — with See More like Facebook */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        <Typography
          sx={{
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            fontSize: '0.93rem',
            color: '#E4E6EB',
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          }}
        >
          {showSeeMore ? (
            <>
              {truncatedText}...{' '}
              <Box component="span" sx={{ color: '#B0B3B8', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
                See more
              </Box>
            </>
          ) : copy.primary_text}
        </Typography>
      </Box>

      {/* Image area */}
      {imageUrl ? (
        <Box sx={{ position: 'relative' }}>
          <Box
            component="img"
            src={imageUrl}
            alt={copy.headline}
            sx={{
              width: '100%',
              display: 'block',
              maxHeight: 480,
              objectFit: 'cover',
            }}
          />
          {/* Cache indicator + Regenerate button overlay */}
          <Box sx={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 0.75, alignItems: 'center' }}>
            {cacheHit && (
              <Chip
                label="Cached"
                size="small"
                sx={{
                  fontWeight: 700,
                  fontSize: '0.6rem',
                  height: 22,
                  bgcolor: 'rgba(0,0,0,0.55)',
                  color: '#10B981',
                  border: '1px solid rgba(16,185,129,0.3)',
                  backdropFilter: 'blur(4px)',
                }}
              />
            )}
            {onRegenerateImage && (
              <Button
                size="small"
                variant="contained"
                startIcon={imageLoading ? <CircularProgress size={12} sx={{ color: 'inherit' }} /> : <AutorenewRoundedIcon sx={{ fontSize: 14 }} />}
                disabled={imageLoading}
                aria-label="Regenerate image"
                onClick={(e) => { e.stopPropagation(); onRegenerateImage(); }}
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  height: 26,
                  px: 1.5,
                  bgcolor: 'rgba(0,0,0,0.55)',
                  color: '#E4E6EB',
                  backdropFilter: 'blur(4px)',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.75)' },
                }}
              >
                Regenerate
              </Button>
            )}
          </Box>
        </Box>
      ) : (
        <Box
          sx={{
            height: 380,
            background: 'linear-gradient(145deg, #0a1628 0%, #0d1117 30%, #111827 60%, #1a1f2e 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            cursor: onGenerateImage && !imageLoading ? 'pointer' : 'default',
          }}
          onClick={!imageLoading ? onGenerateImage : undefined}
        >
          {/* Animated gradient blobs */}
          <Box
            sx={{
              position: 'absolute',
              width: 350, height: 350, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(26,115,232,0.15) 0%, transparent 70%)',
              top: '5%', left: '15%',
              animation: 'float 6s ease-in-out infinite',
              '@keyframes float': {
                '0%,100%': { transform: 'translate(0, 0)' },
                '50%': { transform: 'translate(15px, -10px)' },
              },
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: 250, height: 250, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
              bottom: '5%', right: '10%',
              animation: 'float2 8s ease-in-out infinite',
              '@keyframes float2': {
                '0%,100%': { transform: 'translate(0, 0)' },
                '50%': { transform: 'translate(-10px, 10px)' },
              },
            }}
          />
          <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', px: 4 }}>
            {/* Show AI analysis steps when generating */}
            {imageLoading && imageGenSteps && imageGenSteps.length > 0 ? (
              <Box sx={{ textAlign: 'left', width: '100%', maxWidth: 320, mx: 'auto' }}>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#F26522',
                    letterSpacing: '0.08em',
                    mb: 2,
                    textAlign: 'center',
                  }}
                >
                  AI IMAGE GENERATION
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {imageGenSteps.map((step, i) => {
                    const isActive = step.status === 'active';
                    const isDone = step.status === 'done';
                    const color = isDone ? '#10B981' : isActive ? '#F26522' : 'rgba(255,255,255,0.2)';
                    return (
                      <Box key={i}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Box
                            sx={{
                              width: 24, height: 24, borderRadius: '8px',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              bgcolor: isDone ? 'rgba(16,185,129,0.12)' : isActive ? 'rgba(242,101,34,0.15)' : 'rgba(0,0,0,0.03)',
                              color,
                              transition: 'all 0.3s',
                            }}
                          >
                            {isDone ? (
                              <CheckCircleRoundedIcon sx={{ fontSize: 14, color: '#10B981' }} />
                            ) : isActive ? (
                              <CircularProgress size={12} sx={{ color: '#F26522' }} />
                            ) : (
                              STEP_ICONS[step.label] || <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.15)' }} />
                            )}
                          </Box>
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              fontWeight: isActive ? 700 : 500,
                              color: isDone ? '#10B981' : isActive ? '#E4E6EB' : 'rgba(255,255,255,0.3)',
                              transition: 'all 0.3s',
                              flex: 1,
                            }}
                          >
                            {step.label}
                          </Typography>
                        </Box>
                        {step.detail && (
                          <Typography
                            sx={{
                              fontSize: '0.68rem',
                              color: isDone ? 'rgba(16,185,129,0.7)' : '#B0B3B8',
                              ml: 4.5,
                              mt: 0.25,
                            }}
                          >
                            {step.detail}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
                <LinearProgress
                  variant="indeterminate"
                  sx={{
                    mt: 2.5, height: 3, borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.05)',
                    '& .MuiLinearProgress-bar': {
                      background: 'linear-gradient(90deg, #F26522, #10B981)',
                      borderRadius: 2,
                    },
                  }}
                />
              </Box>
            ) : (
              <>
                <Typography
                  sx={{
                    fontSize: '2.2rem',
                    fontWeight: 900,
                    background: 'linear-gradient(135deg, #1A73E8, #10B981)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.03em',
                    mb: 0.5,
                    lineHeight: 1.1,
                  }}
                >
                  Varsity Tutors
                </Typography>
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                  }}
                >
                  SAT Test Prep
                </Typography>

                {onGenerateImage && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={imageLoading ? <CircularProgress size={14} sx={{ color: '#1A73E8' }} /> : <AutoFixHighIcon sx={{ fontSize: 16 }} />}
                    disabled={imageLoading}
                    aria-label={imageLoading ? 'Generating image' : 'Generate AI image'}
                    onClick={(e) => { e.stopPropagation(); onGenerateImage(); }}
                    sx={{
                      mt: 4,
                      color: '#1A73E8',
                      borderColor: 'rgba(26,115,232,0.3)',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      px: 3,
                      py: 0.75,
                      backdropFilter: 'blur(8px)',
                      bgcolor: 'rgba(26,115,232,0.05)',
                      '&:hover': {
                        borderColor: '#1A73E8',
                        bgcolor: 'rgba(26,115,232,0.1)',
                      },
                    }}
                  >
                    {imageLoading ? 'Generating...' : 'Generate AI Image'}
                  </Button>
                )}
              </>
            )}
          </Box>
        </Box>
      )}

      {/* Link preview bar — Facebook style */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          bgcolor: '#3A3B3C',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.72rem', color: '#B0B3B8', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            varsitytutors.com
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', lineHeight: 1.3, color: '#E4E6EB' }} noWrap>
            {copy.headline}
          </Typography>
          {copy.description && (
            <Typography sx={{ fontSize: '0.8rem', color: '#B0B3B8', lineHeight: 1.3 }} noWrap>
              {copy.description}
            </Typography>
          )}
        </Box>
        <Button
          variant="contained"
          size="small"
          sx={{
            whiteSpace: 'nowrap',
            flexShrink: 0,
            px: 2.5,
            py: 0.6,
            fontSize: '0.85rem',
            fontWeight: 600,
            bgcolor: '#E4E6EB',
            color: '#050505',
            borderRadius: '6px',
            textTransform: 'none',
            '&:hover': {
              bgcolor: '#D8DADF',
            },
          }}
        >
          {copy.cta_button}
        </Button>
      </Box>

      {/* Reactions + counts (like real FB) */}
      <Box sx={{ px: 2, pt: 1, pb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ display: 'flex', ml: -0.25 }}>
            <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#1877F2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #242526', zIndex: 2 }}>
              <ThumbUpOutlinedIcon sx={{ fontSize: 10, color: 'white' }} />
            </Box>
            <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#F0284A', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #242526', ml: -0.5, zIndex: 1 }}>
              <Typography sx={{ fontSize: 9 }}>❤</Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: '0.8rem', color: '#B0B3B8' }}>
            {likesDisplay}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.8rem', color: '#B0B3B8' }}>
          {comments} comments · {shares} shares
        </Typography>
      </Box>

      {/* Divider */}
      <Box sx={{ mx: 2, borderBottom: '1px solid #3A3B3C' }} />

      {/* Engagement bar — Facebook style */}
      <Box sx={{ px: 0.5, py: 0.25, display: 'flex', justifyContent: 'space-around' }}>
        {[
          { icon: <ThumbUpOutlinedIcon sx={{ fontSize: 18 }} />, label: 'Like' },
          { icon: <ChatBubbleOutlineIcon sx={{ fontSize: 18 }} />, label: 'Comment' },
          { icon: <ShareOutlinedIcon sx={{ fontSize: 18 }} />, label: 'Share' },
        ].map((action) => (
          <Box
            key={action.label}
            role="button"
            aria-label={action.label}
            tabIndex={0}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.75,
              px: 3, py: 1,
              borderRadius: '6px',
              color: '#B0B3B8',
              cursor: 'pointer',
              transition: 'background 0.15s',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
            }}
          >
            {action.icon}
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
              {action.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
