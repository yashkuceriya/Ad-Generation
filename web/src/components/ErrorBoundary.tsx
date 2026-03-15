import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            p: 3,
          }}
        >
          <Paper
            sx={{
              p: 5,
              textAlign: 'center',
              maxWidth: 480,
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: '20px',
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(30,30,40,0.8))'
                : 'linear-gradient(135deg, rgba(239,68,68,0.04), rgba(255,255,255,0.8))',
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '18px',
                mx: 'auto',
                mb: 2.5,
                background: 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ErrorRoundedIcon sx={{ fontSize: 32, color: '#EF4444' }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ mb: 1, letterSpacing: '-0.02em' }}>
              Something went wrong
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
              An unexpected error occurred. You can try again or return to the dashboard.
            </Typography>
            {this.state.error && (
              <Paper
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: 'rgba(239,68,68,0.04)',
                  border: '1px solid rgba(239,68,68,0.1)',
                  borderRadius: '10px',
                  textAlign: 'left',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                    color: '#EF4444',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.message}
                </Typography>
              </Paper>
            )}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
              <Button
                variant="contained"
                startIcon={<RefreshRoundedIcon />}
                onClick={this.handleReset}
                sx={{
                  px: 3,
                  py: 1,
                  background: 'linear-gradient(135deg, #F26522, #D4541A)',
                  fontWeight: 600,
                  borderRadius: '10px',
                  '&:hover': { background: 'linear-gradient(135deg, #FF8A50, #F26522)' },
                }}
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                onClick={() => { window.location.href = '/'; }}
                sx={{
                  px: 3,
                  py: 1,
                  borderColor: 'divider',
                  color: 'text.primary',
                  borderRadius: '10px',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                Go Home
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
