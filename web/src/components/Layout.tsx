import { useState, useCallback, useContext, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import AutoAwesomeMosaicRoundedIcon from '@mui/icons-material/AutoAwesomeMosaicRounded';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { ColorModeContext } from '../App';
import { useSSE } from '../api/useSSE';
import type { SSEEvent } from '../types';

const DRAWER_WIDTH = 240;

const NAV_SECTIONS = [
  {
    title: 'OVERVIEW',
    items: [
      { path: '/', label: 'Dashboard', icon: <DashboardRoundedIcon /> },
      { path: '/ads', label: 'Ad Library', icon: <AutoAwesomeMosaicRoundedIcon /> },
      { path: '/ads/compare', label: 'Compare', icon: <CompareArrowsRoundedIcon /> },
    ],
  },
  {
    title: 'ANALYSIS',
    items: [
      { path: '/analysis', label: 'Evaluation', icon: <InsightsRoundedIcon /> },
      { path: '/trust', label: 'Trust Center', icon: <VerifiedUserRoundedIcon /> },
      { path: '/costs', label: 'Cost Analytics', icon: <BarChartRoundedIcon /> },
      { path: '/settings', label: 'Settings', icon: <SettingsRoundedIcon /> },
    ],
  },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  const handleEvent = useCallback((event: SSEEvent) => {
    switch (event.type) {
      case 'brief_complete':
        setSnack({
          message: `Ad ${event.brief_id} completed — Score: ${(event.score as number)?.toFixed(1)}/10`,
          severity: 'success',
        });
        break;
      case 'copy_iteration_complete':
        if (event.human_steered) {
          setSnack({
            message: `Refine complete — new iteration scored ${(event.score as number)?.toFixed(1)}/10`,
            severity: 'success',
          });
        }
        break;
      case 'pipeline_complete': {
        setSnack({
          message: `Pipeline complete! ${event.total_ads} ads generated, avg ${(event.avg_score as number)?.toFixed(1)}/10`,
          severity: 'success',
        });
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if ((event.avg_score as number) >= 8.0 && !prefersReducedMotion) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#F26522', '#10B981', '#F59E0B', '#FF8A50'] });
        }
        break;
      }
      case 'pipeline_error':
        setSnack({ message: `Error: ${event.error}`, severity: 'error' });
        break;
      case 'image_error':
        setSnack({ message: `Image error: ${event.error || 'Generation failed'}`, severity: 'error' });
        break;
    }
  }, []);

  const { connected } = useSSE(handleEvent);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key.toLowerCase()) {
        case 'g': navigate('/ads'); break;
        case 'd': navigate('/'); break;
        case 'r': navigate('/run'); break;
        case 'escape': if (isMobile && mobileOpen) setMobileOpen(false); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, isMobile, mobileOpen]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/ads/compare') return location.pathname === '/ads/compare';
    if (path === '/ads') return location.pathname.startsWith('/ads') && location.pathname !== '/ads/compare';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const drawerContent = (
    <Box component="nav" aria-label="Main navigation" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <Box sx={{ px: 2.5, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #F26522 0%, #FF8A50 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => handleNavClick('/')}
        >
          <AutoAwesomeIcon sx={{ fontSize: 18, color: 'white' }} />
        </Box>
        <Box>
          <Typography
            variant="subtitle1"
            fontWeight={800}
            sx={{ fontSize: '0.92rem', color: 'white', lineHeight: 1.2, cursor: 'pointer' }}
            onClick={() => handleNavClick('/')}
          >
            Ad Engine
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em' }}>
            VARSITY TUTORS
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mx: 2 }} />

      {/* New Run CTA */}
      <Box sx={{ px: 2, pt: 2.5, pb: 1 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<RocketLaunchRoundedIcon sx={{ fontSize: 17 }} />}
          onClick={() => handleNavClick('/run')}
          sx={{
            bgcolor: '#F26522',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.82rem',
            py: 1.1,
            borderRadius: '10px',
            textTransform: 'none',
            boxShadow: '0 2px 8px rgba(242,101,34,0.3)',
            '&:hover': { bgcolor: '#D4541A', boxShadow: '0 4px 12px rgba(242,101,34,0.4)' },
          }}
        >
          New Run
        </Button>
      </Box>

      {/* Navigation Sections */}
      <Box sx={{ px: 1.5, pt: 1.5, flex: 1 }}>
        {NAV_SECTIONS.map((section) => (
          <Box key={section.title} sx={{ mb: 1.5 }}>
            <Typography
              variant="overline"
              sx={{
                px: 1.5,
                mb: 0.5,
                display: 'block',
                fontSize: '0.55rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              {section.title}
            </Typography>
            <List disablePadding aria-label={section.title}>
              {section.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <ListItemButton
                    key={item.path}
                    selected={active}
                    onClick={() => handleNavClick(item.path)}
                    sx={{
                      borderRadius: '10px',
                      mb: 0.25,
                      py: 0.9,
                      px: 1.5,
                      transition: 'all 0.15s',
                      color: active ? 'white' : 'rgba(255,255,255,0.55)',
                      '&.Mui-selected': {
                        bgcolor: 'rgba(242,101,34,0.12)',
                        '&:hover': { bgcolor: 'rgba(242,101,34,0.18)' },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: '20%',
                          bottom: '20%',
                          width: 3,
                          borderRadius: '0 3px 3px 0',
                          bgcolor: '#F26522',
                        },
                      },
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.85)',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 34,
                        color: active ? '#F26522' : 'rgba(255,255,255,0.4)',
                        '& .MuiSvgIcon-root': { fontSize: 20 },
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: active ? 700 : 500,
                        fontSize: '0.84rem',
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      {/* Bottom section */}
      <Box sx={{ px: 2, pb: 2.5 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />

        {/* Live indicator */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            borderRadius: '10px',
            bgcolor: connected ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${connected ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)'}`,
            mb: 1.5,
          }}
        >
          <FiberManualRecordIcon
            sx={{
              fontSize: 8,
              color: connected ? '#10B981' : 'rgba(255,255,255,0.3)',
              animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.3 },
              },
              '@media (prefers-reduced-motion: reduce)': {
                animation: 'none',
              },
            }}
          />
          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: connected ? '#10B981' : 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
            {connected ? 'Connected — Live updates' : 'Offline'}
          </Typography>
        </Box>

        {/* Powered by */}
        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: '10px',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
            Powered by
          </Typography>
          <Typography variant="body2" sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600, mt: 0.25 }}>
            Gemini 2.5 Flash + 2.0 Flash Lite
          </Typography>
          <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.3)' }}>
            via OpenRouter
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top bar (mobile only) */}
      {isMobile && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Toolbar sx={{ gap: 1.5, minHeight: '56px !important' }}>
            <IconButton
              aria-label="Open menu"
              edge="start"
              onClick={() => setMobileOpen(!mobileOpen)}
              sx={{ color: 'white' }}
            >
              <MenuRoundedIcon />
            </IconButton>
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #F26522 0%, #FF8A50 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 16, color: 'white' }} />
            </Box>
            <Typography variant="h6" fontWeight={800} sx={{ fontSize: '0.95rem', color: 'white', flex: 1 }}>
              Ad Engine
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Sidebar */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              bgcolor: '#1E293B',
              borderRight: '1px solid rgba(255,255,255,0.06)',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          pt: isMobile ? '56px' : 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top bar for desktop — slim with brand + status */}
        {!isMobile && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 1.5,
              px: 3,
              py: 1.5,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              bgcolor: isDark ? '#1A1D27' : 'white',
            }}
          >
            <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
              <IconButton onClick={colorMode.toggleColorMode} size="small" aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} sx={{ color: 'text.secondary' }}>
                {isDark ? <LightModeRoundedIcon sx={{ fontSize: 18 }} /> : <DarkModeRoundedIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
            <Chip
              icon={
                <FiberManualRecordIcon
                  sx={{
                    fontSize: '7px !important',
                    color: connected ? '#10B981 !important' : undefined,
                  }}
                />
              }
              label={connected ? 'Live' : 'Offline'}
              size="small"
              sx={{
                fontWeight: 600,
                fontSize: '0.68rem',
                height: 26,
                color: connected ? '#10B981' : '#94A3B8',
                bgcolor: connected ? 'rgba(16,185,129,0.06)' : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${connected ? 'rgba(16,185,129,0.15)' : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}
            />
          </Box>
        )}

        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, maxWidth: 1400 }}>
          <Outlet />
        </Box>

        {/* Footer */}
        <Box
          sx={{
            py: 1.5,
            px: 3,
            textAlign: 'center',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem' }}>
            Autonomous Ad Engine · Lab v2.0 · Powered by Gemini 2.5 Flash + 2.0 Flash Lite via OpenRouter
          </Typography>
        </Box>
      </Box>

      {/* Notifications */}
      <Snackbar
        open={!!snack}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snack ? (
          <Alert
            severity={snack.severity}
            onClose={() => setSnack(null)}
            variant="filled"
            sx={{ borderRadius: '10px', fontWeight: 600 }}
          >
            {snack.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
