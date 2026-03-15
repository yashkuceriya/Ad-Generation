import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';

export default function NotFound() {
  usePageTitle('Not Found');
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', textAlign: 'center',
      }}
    >
      <Box
        sx={{
          width: 80, height: 80, borderRadius: '20px', mb: 3,
          background: 'linear-gradient(135deg, rgba(242,101,34,0.12), rgba(16,185,129,0.08))',
          border: '1px solid rgba(242,101,34,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <SearchOffRoundedIcon sx={{ fontSize: 36, color: '#F26522' }} />
      </Box>
      <Typography variant="h2" fontWeight={800} sx={{ fontSize: '4rem', letterSpacing: '-0.03em', color: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(30,41,59,0.15)' }}>
        404
      </Typography>
      <Typography variant="h5" fontWeight={700} sx={{ mt: 1, mb: 1 }}>
        Page not found
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
        The page you're looking for doesn't exist or has been moved.
      </Typography>
      <Button
        variant="contained"
        startIcon={<HomeRoundedIcon />}
        onClick={() => navigate('/')}
        sx={{
          px: 4, py: 1.25,
          background: 'linear-gradient(135deg, #F26522, #D4541A)',
          fontWeight: 700, borderRadius: '12px',
          '&:hover': { background: 'linear-gradient(135deg, #FF8A50, #F26522)' },
        }}
      >
        Back to Dashboard
      </Button>
    </Box>
  );
}
