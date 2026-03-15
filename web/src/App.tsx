import { lazy, Suspense, useState, useMemo, createContext } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import type { PaletteMode } from '@mui/material';
import { createAppTheme } from './theme';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdGallery = lazy(() => import('./pages/AdGallery'));
const AdDetail = lazy(() => import('./pages/AdDetail'));
const AdCompare = lazy(() => import('./pages/AdCompare'));
const CostDashboard = lazy(() => import('./pages/CostDashboard'));
const Analysis = lazy(() => import('./pages/Analysis'));
const RunPipeline = lazy(() => import('./pages/RunPipeline'));
const Settings = lazy(() => import('./pages/Settings'));
const TrustCenter = lazy(() => import('./pages/TrustCenter'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
      <CircularProgress size={32} sx={{ color: '#F26522' }} />
    </Box>
  );
}

/* eslint-disable react-refresh/only-export-components -- ColorModeContext lives here for theme wiring */
export const ColorModeContext = createContext({ toggleColorMode: () => {} });

function getInitialMode(): PaletteMode {
  try {
    const stored = localStorage.getItem('theme-mode');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch { /* ignore */ }
  return 'light';
}

export default function App() {
  const [mode, setMode] = useState<PaletteMode>(getInitialMode);

  const colorMode = useMemo(() => ({
    toggleColorMode: () => {
      setMode((prev) => {
        const next = prev === 'light' ? 'dark' : 'light';
        try { localStorage.setItem('theme-mode', next); } catch { /* ignore */ }
        return next;
      });
    },
  }), []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/ads" element={<AdGallery />} />
                  <Route path="/ads/compare" element={<AdCompare />} />
                  <Route path="/ads/:briefId" element={<AdDetail />} />
                  <Route path="/costs" element={<CostDashboard />} />
                  <Route path="/analysis" element={<Analysis />} />
                  <Route path="/run" element={<RunPipeline />} />
                  <Route path="/trust" element={<TrustCenter />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ErrorBoundary>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
