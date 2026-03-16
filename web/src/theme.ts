import { createTheme } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#F26522',
        light: '#FF8A50',
        dark: '#D4541A',
      },
      secondary: {
        main: '#06D6A0',
        light: '#34EABD',
        dark: '#05B384',
      },
      error: {
        main: '#EF4444',
      },
      warning: {
        main: '#F59E0B',
      },
      success: {
        main: '#10B981',
      },
      background: {
        default: isDark ? '#0F1117' : '#F5F6F8',
        paper: isDark ? '#1A1D27' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#E2E8F0' : '#1E293B',
        secondary: isDark ? '#94A3B8' : '#64748B',
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      h3: { fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 },
      h4: { fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15 },
      h5: { fontWeight: 700, letterSpacing: '-0.02em' },
      h6: { fontWeight: 700, letterSpacing: '-0.015em' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600, letterSpacing: '-0.01em' },
      body2: { lineHeight: 1.6 },
      caption: { letterSpacing: '0.01em' },
      overline: { fontWeight: 700, letterSpacing: '0.1em', fontSize: '0.65rem' },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? '#0F1117' : '#F5F6F8',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
              borderRadius: 3,
            },
          },
          '*::-webkit-scrollbar': { width: 5 },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
          '*::-webkit-scrollbar-thumb': {
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            borderRadius: 3,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#1A1D27' : '#FFFFFF',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              borderColor: 'rgba(242, 101, 34, 0.25)',
              transform: 'translateY(-2px)',
              boxShadow: isDark
                ? '0 8px 24px -4px rgba(0,0,0,0.4), 0 0 0 1px rgba(242, 101, 34, 0.08)'
                : '0 8px 24px -4px rgba(0,0,0,0.08), 0 0 0 1px rgba(242, 101, 34, 0.08)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#1A1D27' : '#FFFFFF',
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            boxShadow: isDark
              ? '0 2px 8px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)'
              : '0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
          },
        },
      },
      MuiChip: {
        defaultProps: {
          size: 'small' as const,
        },
        styleOverrides: {
          root: {
            fontWeight: 600,
            fontSize: '0.75rem',
            borderRadius: 8,
          },
          outlined: {
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
          },
        },
      },
      MuiTypography: {
        styleOverrides: {
          root: {
            '&.MuiTypography-caption': {
              fontSize: '0.8rem',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: 10,
            letterSpacing: '-0.01em',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 4px 12px -2px rgba(242, 101, 34, 0.3)',
            },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: '#1E293B',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: '#1E293B',
            color: '#FFFFFF',
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            letterSpacing: '-0.01em',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          },
          bar: {
            borderRadius: 4,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
              },
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#1A1D27' : '#FFFFFF',
          },
        },
      },
    },
  });
}

// Default export for backwards compatibility
const theme = createAppTheme('light');
export default theme;
