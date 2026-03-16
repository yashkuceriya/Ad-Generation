import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import InputAdornment from '@mui/material/InputAdornment';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import HtmlRoundedIcon from '@mui/icons-material/HtmlRounded';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Fade from '@mui/material/Fade';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import AdCard from '../components/AdCard';
import { getAds } from '../api/endpoints';
import { useSSE } from '../api/useSSE';
import ListSubheader from '@mui/material/ListSubheader';
import type { AdResult, SSEEvent } from '../types';

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAdsJSON(ads: AdResult[]) {
  downloadFile(JSON.stringify(ads, null, 2), 'ads-export.json', 'application/json');
}

function exportAdsCSV(ads: AdResult[]) {
  const headers = ['brief_id', 'audience', 'headline', 'primary_text', 'description', 'score', 'cost', 'iterations_count'];
  const rows = ads.map(ad => {
    const best = ad.copy_iterations[ad.best_copy_index];
    return [
      ad.brief_id,
      ad.brief.audience_segment,
      `"${best.ad_copy.headline.replace(/"/g, '""')}"`,
      `"${best.ad_copy.primary_text.replace(/"/g, '""')}"`,
      `"${best.ad_copy.description.replace(/"/g, '""')}"`,
      best.evaluation.weighted_average.toFixed(2),
      ad.total_cost_usd.toFixed(4),
      ad.copy_iterations.length,
    ].join(',');
  });
  downloadFile([headers.join(','), ...rows].join('\n'), 'ads-export.csv', 'text/csv');
}

function exportAdsHTMLReport(ads: AdResult[]) {
  const scores = ads.map(a => a.copy_iterations[a.best_copy_index].evaluation.weighted_average);
  const avgScore = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
  const passCount = scores.filter(s => s >= 7).length;
  const passRate = scores.length ? ((passCount / scores.length) * 100).toFixed(1) : '0';
  const dateGenerated = new Date().toLocaleString();

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      human_approved: 'Approved', experiment_ready: 'Experiment Ready',
      compliance_pass: 'Compliance Pass', evaluator_pass: 'Evaluator Pass',
      below_threshold: 'Below Threshold', rejected: 'Rejected',
      iterating: 'Iterating', generated: 'Generated', published: 'Published',
    };
    return map[status] || status;
  };

  const cards = ads.map(ad => {
    const best = ad.copy_iterations[ad.best_copy_index];
    const score = best.evaluation.weighted_average;
    const scoreColor = score >= 8 ? '#10B981' : score >= 6 ? '#F26522' : score >= 4 ? '#F59E0B' : '#EF4444';
    const statusColor = ['human_approved', 'experiment_ready'].includes(ad.status) ? '#10B981'
      : ['compliance_pass', 'evaluator_pass'].includes(ad.status) ? '#3B82F6'
      : ['below_threshold', 'rejected'].includes(ad.status) ? '#EF4444' : '#F59E0B';
    return `<div class="card">
      <div class="card-score" style="background:${scoreColor}18;color:${scoreColor};border:1px solid ${scoreColor}40">${score.toFixed(1)}</div>
      <h3 class="card-headline">${best.ad_copy.headline}</h3>
      <p class="card-text">${best.ad_copy.primary_text}</p>
      <div class="card-badges">
        <span class="badge" style="background:rgba(242,101,34,0.08);color:#F26522;border:1px solid rgba(242,101,34,0.2)">${ad.brief.audience_segment}</span>
        <span class="badge" style="background:${statusColor}14;color:${statusColor};border:1px solid ${statusColor}30">${statusLabel(ad.status)}</span>
      </div>
    </div>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Ad Gallery Report</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #1a1a1a; padding: 32px; }
  .header { max-width: 1200px; margin: 0 auto 32px; padding: 28px 32px; background: linear-gradient(135deg, rgba(242,101,34,0.06), rgba(16,185,129,0.03)); border: 1px solid rgba(242,101,34,0.12); border-radius: 16px; }
  .header h1 { font-size: 24px; font-weight: 800; margin-bottom: 16px; }
  .stats { display: flex; gap: 24px; flex-wrap: wrap; }
  .stat { text-align: center; }
  .stat-value { font-size: 28px; font-weight: 800; color: #F26522; }
  .stat-label { font-size: 12px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
  .card { background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); border: 1px solid #eee; position: relative; }
  .card-score { position: absolute; top: 16px; right: 16px; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 800; }
  .card-headline { font-size: 16px; font-weight: 700; margin-bottom: 8px; padding-right: 60px; }
  .card-text { font-size: 13px; color: #555; line-height: 1.6; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .card-badges { display: flex; gap: 6px; flex-wrap: wrap; }
  .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  @media print { body { background: #fff; padding: 16px; } .card { break-inside: avoid; box-shadow: none; border: 1px solid #ddd; } }
</style>
</head>
<body>
<div class="header">
  <h1>Ad Gallery Report</h1>
  <div class="stats">
    <div class="stat"><div class="stat-value">${ads.length}</div><div class="stat-label">Total Ads</div></div>
    <div class="stat"><div class="stat-value">${avgScore.toFixed(1)}</div><div class="stat-label">Avg Score</div></div>
    <div class="stat"><div class="stat-value">${passRate}%</div><div class="stat-label">Pass Rate (&ge;7)</div></div>
    <div class="stat"><div class="stat-value" style="font-size:14px;color:#888">${dateGenerated}</div><div class="stat-label">Generated</div></div>
  </div>
</div>
<div class="grid">
${cards}
</div>
</body>
</html>`;
  downloadFile(html, 'ads-report.html', 'text/html');
}

export default function AdGallery() {
  usePageTitle('Ad Gallery');
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();
  const [ads, setAds] = useState<AdResult[] | null>(null);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'score');
  const [minScore, setMinScore] = useState(Number(searchParams.get('min') || '0'));
  const [audience, setAudience] = useState(searchParams.get('audience') || 'all');
  const [searchText, setSearchText] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [snack, setSnack] = useState<{ message: string; severity: 'success' | 'info' } | null>(null);

  // Sync filter state to URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (sortBy !== 'score') params.sort = sortBy;
    if (minScore > 0) params.min = String(minScore);
    if (audience !== 'all') params.audience = audience;
    if (searchText) params.q = searchText;
    if (statusFilter !== 'all') params.status = statusFilter;
    setSearchParams(params, { replace: true });
  }, [sortBy, minScore, audience, searchText, statusFilter, setSearchParams]);

  const toggleSelect = useCallback((briefId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(briefId)) {
        next.delete(briefId);
      } else if (next.size < 3) {
        next.add(briefId);
      }
      return next;
    });
  }, []);

  const [fetchError, setFetchError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await getAds({
        sort_by: sortBy,
        min_score: minScore,
        audience: audience === 'all' ? undefined : audience,
      });
      setAds(res.data);
      setFetchError(false);
    } catch {
      setFetchError(true);
    }
  }, [sortBy, minScore, audience]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { refresh(); }, [refresh]);

  // Debounced refresh for rapid SSE events
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => { refresh(); }, 250);
  }, [refresh]);

  useEffect(() => {
    return () => { if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current); };
  }, []);

  const handleEvent = useCallback((event: SSEEvent) => {
    if (
      event.type === 'brief_complete' ||
      event.type === 'pipeline_complete' ||
      event.type === 'copy_iteration_complete' ||
      event.type === 'image_iteration_complete' ||
      event.type === 'image_generated'
    ) {
      // Immediate for pipeline_complete, debounced for iterations
      if (event.type === 'pipeline_complete') {
        refresh();
      } else {
        debouncedRefresh();
      }
    }
  }, [refresh, debouncedRefresh]);

  useSSE(handleEvent);

  // Client-side text search + status filter
  const filteredAds = useMemo(() => {
    if (!ads) return [];
    let result = ads;
    const PASSING_STATUSES = ['published', 'human_approved', 'experiment_ready', 'compliance_pass', 'evaluator_pass'];
    const REVIEW_STATUSES = ['iterating', 'human_review', 'generated'];
    const BELOW_STATUSES = ['below_threshold', 'rejected'];
    if (statusFilter === 'group_passing') {
      result = result.filter(a => PASSING_STATUSES.includes(a.status));
    } else if (statusFilter === 'group_review') {
      result = result.filter(a => REVIEW_STATUSES.includes(a.status));
    } else if (statusFilter === 'group_below') {
      result = result.filter(a => BELOW_STATUSES.includes(a.status));
    } else if (statusFilter !== 'all') {
      result = result.filter(a => a.status === statusFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(a => {
        const best = a.copy_iterations[a.best_copy_index].ad_copy;
        return (
          best.headline.toLowerCase().includes(q) ||
          best.primary_text.toLowerCase().includes(q) ||
          best.description.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [ads, searchText, statusFilter]);

  const readyCount = filteredAds.filter(a => ['human_approved', 'experiment_ready'].includes(a.status)).length;
  const inReviewCount = filteredAds.filter(a => ['compliance_pass', 'evaluator_pass'].includes(a.status)).length;
  const needsWorkCount = filteredAds.filter(a => ['below_threshold', 'rejected'].includes(a.status)).length;

  // Loading skeleton
  if (ads === null) {
    return (
      <Box>
        <Skeleton variant="rounded" height={100} animation="wave" sx={{ mb: 3.5, borderRadius: '20px' }} />
        <Skeleton variant="rounded" height={56} animation="wave" sx={{ mb: 3, borderRadius: '12px' }} />
        <Grid container spacing={2.5}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={i}>
              <Skeleton variant="rounded" height={280} animation="wave" sx={{ borderRadius: '12px' }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      {fetchError && (
        <Alert
          severity="error"
          variant="outlined"
          action={<Button size="small" onClick={refresh} sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Retry</Button>}
          sx={{ mb: 2, borderRadius: '10px' }}
        >
          Failed to load ads. Make sure the backend is running.
        </Alert>
      )}
      {/* Header */}
      <Box
        sx={{
          mb: 3,
          p: 3,
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(242,101,34,0.06) 0%, rgba(16,185,129,0.03) 100%)',
          border: '1px solid rgba(242,101,34,0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute', top: -40, right: -40, width: 200, height: 200,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.06), transparent 70%)',
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'linear-gradient(135deg, #F26522, #D4541A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
              Ad Gallery
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
              <Box component="span" sx={{ color: '#F26522', fontWeight: 800 }}>{filteredAds.length}</Box> total
              {' · '}
              <Box component="span" sx={{ color: '#10B981' }}>{readyCount}</Box> ready
              {' · '}
              <Box component="span" sx={{ color: '#F59E0B' }}>{inReviewCount}</Box> in review
              {' · '}
              <Box component="span" sx={{ color: '#EF4444' }}>{needsWorkCount}</Box> needs work
            </Typography>
            <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => { exportAdsJSON(filteredAds); setSnack({ message: `Exported ${filteredAds.length} ads as JSON`, severity: 'success' }); }}
                disabled={filteredAds.length === 0}
                sx={{
                  fontSize: '0.7rem', fontWeight: 700, textTransform: 'none',
                  borderColor: 'rgba(242,101,34,0.3)', color: '#F26522',
                  '&:hover': { borderColor: '#F26522', bgcolor: 'rgba(242,101,34,0.06)' },
                }}
              >
                JSON
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => { exportAdsCSV(filteredAds); setSnack({ message: `Exported ${filteredAds.length} ads as CSV`, severity: 'success' }); }}
                disabled={filteredAds.length === 0}
                sx={{
                  fontSize: '0.7rem', fontWeight: 700, textTransform: 'none',
                  borderColor: 'rgba(16,185,129,0.3)', color: '#10B981',
                  '&:hover': { borderColor: '#10B981', bgcolor: 'rgba(16,185,129,0.06)' },
                }}
              >
                CSV
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<HtmlRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => { exportAdsHTMLReport(filteredAds); setSnack({ message: `Exported ${filteredAds.length} ads as HTML report`, severity: 'success' }); }}
                disabled={filteredAds.length === 0}
                sx={{
                  fontSize: '0.7rem', fontWeight: 700, textTransform: 'none',
                  borderColor: 'rgba(139,92,246,0.3)', color: '#8B5CF6',
                  '&:hover': { borderColor: '#8B5CF6', bgcolor: 'rgba(139,92,246,0.06)' },
                }}
              >
                HTML
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Filters */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        <TextField
          placeholder="Search ads..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          size="small"
          aria-label="Search ads"
          sx={{ minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          label="Sort by"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          size="small"
          aria-label="Sort order"
          sx={{ minWidth: 150 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SortRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        >
          <MenuItem value="score">Best Score</MenuItem>
          <MenuItem value="cost">Lowest Cost</MenuItem>
          <MenuItem value="brief_id">Brief ID</MenuItem>
        </TextField>

        <TextField
          select
          label="Audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          size="small"
          aria-label="Filter by audience"
          sx={{ minWidth: 150 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FilterListRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        >
          <MenuItem value="all">All Audiences</MenuItem>
          <MenuItem value="parents">Parents</MenuItem>
          <MenuItem value="students">Students</MenuItem>
          <MenuItem value="families">Families</MenuItem>
        </TextField>

        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          size="small"
          aria-label="Filter by status"
          sx={{ minWidth: 150 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FilterListRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
        >
          <MenuItem value="all">All Statuses</MenuItem>
          <MenuItem value="group_passing" sx={{ fontWeight: 700, color: '#10B981' }}>Passing (all)</MenuItem>
          <ListSubheader sx={{ fontSize: '0.65rem', lineHeight: '24px' }}>Passing</ListSubheader>
          <MenuItem value="published">Published</MenuItem>
          <MenuItem value="human_approved">Approved</MenuItem>
          <MenuItem value="experiment_ready">Experiment Ready</MenuItem>
          <MenuItem value="compliance_pass">Compliance Pass</MenuItem>
          <MenuItem value="evaluator_pass">Evaluator Pass</MenuItem>
          <MenuItem value="group_review" sx={{ fontWeight: 700, color: '#F59E0B' }}>Needs Review (all)</MenuItem>
          <ListSubheader sx={{ fontSize: '0.65rem', lineHeight: '24px' }}>Needs Review</ListSubheader>
          <MenuItem value="iterating">Iterating</MenuItem>
          <MenuItem value="human_review">Human Review</MenuItem>
          <MenuItem value="generated">Generated</MenuItem>
          <MenuItem value="group_below" sx={{ fontWeight: 700, color: '#EF4444' }}>Below (all)</MenuItem>
          <ListSubheader sx={{ fontSize: '0.65rem', lineHeight: '24px' }}>Below</ListSubheader>
          <MenuItem value="below_threshold">Below Threshold</MenuItem>
          <MenuItem value="rejected">Rejected</MenuItem>
        </TextField>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 220, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600} noWrap sx={{ fontSize: '0.7rem' }}>
            Min Score
          </Typography>
          <Slider
            value={minScore}
            onChange={(_, v) => setMinScore(v as number)}
            min={0}
            max={10}
            step={0.5}
            size="small"
            valueLabelDisplay="auto"
            sx={{
              flex: 1,
              '& .MuiSlider-thumb': {
                width: 14, height: 14,
                bgcolor: '#F26522',
                '&:hover': { boxShadow: '0 0 0 6px rgba(242,101,34,0.15)' },
              },
              '& .MuiSlider-track': {
                background: 'linear-gradient(90deg, #F26522, #10B981)',
                border: 'none',
              },
            }}
          />
          <Chip
            label={minScore.toFixed(1)}
            size="small"
            sx={{
              fontWeight: 700, fontSize: '0.72rem', minWidth: 44,
              bgcolor: 'rgba(242,101,34,0.1)', color: '#F26522',
              border: '1px solid rgba(242,101,34,0.2)',
            }}
          />
        </Box>
      </Paper>

      {/* Grid */}
      <Grid container spacing={2.5}>
        {filteredAds.map(ad => {
          const isSelected = selectedIds.has(ad.brief_id);
          return (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={ad.brief_id}>
              <Box sx={{ position: 'relative' }}>
                {/* Checkbox overlay */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 2,
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={!isSelected && selectedIds.size >= 3}
                    onChange={() => toggleSelect(ad.brief_id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={isSelected ? 'Deselect ad' : selectedIds.size >= 3 ? 'Maximum 3 ads selected' : 'Select ad for comparison'}
                    sx={{
                      p: 0.5,
                      bgcolor: isDark ? 'rgba(30,30,40,0.7)' : 'rgba(255,255,255,0.7)',
                      borderRadius: '8px',
                      backdropFilter: 'blur(4px)',
                      color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                      '&.Mui-checked': {
                        color: '#F26522',
                      },
                      '&.Mui-disabled': {
                        color: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                      },
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(30,30,40,0.85)' : 'rgba(255,255,255,0.85)',
                      },
                    }}
                    size="small"
                  />
                </Box>
                {/* Selection ring */}
                <Box
                  sx={{
                    borderRadius: '12px',
                    border: isSelected ? '2px solid #F26522' : '2px solid transparent',
                    transition: 'border-color 0.2s',
                    overflow: 'hidden',
                  }}
                >
                  <AdCard ad={ad} onClick={() => navigate(`/ads/${ad.brief_id}`)} />
                </Box>
              </Box>
            </Grid>
          );
        })}
      </Grid>

      {/* Floating Compare Button */}
      <Fade in={selectedIds.size >= 2}>
        <Box
          sx={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
          }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<CompareArrowsRoundedIcon />}
            onClick={() => {
              const idsParam = Array.from(selectedIds).join(',');
              navigate(`/ads/compare?ids=${idsParam}`);
            }}
            sx={{
              px: 4,
              py: 1.5,
              borderRadius: '16px',
              fontWeight: 800,
              fontSize: '0.9rem',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #F26522, #D4541A)',
              boxShadow: '0 8px 32px rgba(242,101,34,0.4)',
              '&:hover': {
                background: 'linear-gradient(135deg, #FF8A50, #F26522)',
                boxShadow: '0 12px 40px rgba(242,101,34,0.5)',
              },
            }}
          >
            Compare ({selectedIds.size})
          </Button>
        </Box>
      </Fade>

      {filteredAds.length === 0 && (
        <Paper
          sx={{
            textAlign: 'center',
            py: 10,
            mt: 2,
            border: '1px dashed rgba(242,101,34,0.15)',
            bgcolor: 'transparent',
          }}
        >
          <Box
            sx={{
              width: 56, height: 56, borderRadius: '16px', mx: 'auto', mb: 2,
              background: 'linear-gradient(135deg, rgba(242,101,34,0.08), rgba(16,185,129,0.04))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {ads.length > 0
              ? <FilterListRoundedIcon sx={{ fontSize: 28, color: '#F26522', opacity: 0.5 }} />
              : <SearchRoundedIcon sx={{ fontSize: 28, color: '#F26522', opacity: 0.5 }} />
            }
          </Box>
          <Typography variant="h6" fontWeight={700} color="text.secondary" gutterBottom>
            {ads.length > 0 ? 'No ads match your filters' : 'No ads yet'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7 }}>
            {ads.length > 0
              ? 'Try adjusting the criteria above to broaden your search.'
              : 'Run the pipeline to generate your first ads.'}
          </Typography>
        </Paper>
      )}

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        {snack ? <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled" sx={{ borderRadius: '10px', fontWeight: 600 }}>{snack.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
