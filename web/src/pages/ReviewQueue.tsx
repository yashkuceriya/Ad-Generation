import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { keyframes } from '@mui/system';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Fade from '@mui/material/Fade';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import AnimatedNumber from '../components/AnimatedNumber';
import { getAds } from '../api/endpoints';
import api from '../api/client';
import { useSSE } from '../api/useSSE';
import type { AdResult, SSEEvent } from '../types';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const QUEUE_STATUSES = ['evaluator_pass', 'compliance_pass', 'needs_review', 'generated'] as const;

const STATUS_PRIORITY: Record<string, number> = {
  needs_review: 0,
  generated: 1,
  evaluator_pass: 2,
  compliance_pass: 3,
};

type SortField = 'score' | 'status' | 'age';
type SortDir = 'asc' | 'desc';

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '--';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusColor(status: string): 'success' | 'info' | 'warning' | 'error' | 'default' {
  if (status === 'human_approved' || status === 'experiment_ready' || status === 'published') return 'success';
  if (status === 'compliance_pass' || status === 'evaluator_pass') return 'info';
  if (status === 'below_threshold' || status === 'rejected') return 'error';
  return 'warning';
}

function scoreColor(score: number): string {
  if (score >= 8) return '#10B981';
  if (score >= 6) return '#F26522';
  if (score >= 4) return '#F59E0B';
  return '#EF4444';
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    human_approved: 'Approved',
    experiment_ready: 'Experiment Ready',
    compliance_pass: 'Compliance Pass',
    evaluator_pass: 'Evaluator Pass',
    below_threshold: 'Below Threshold',
    rejected: 'Rejected',
    iterating: 'Iterating',
    generated: 'Generated',
    needs_review: 'Needs Review',
    published: 'Published',
  };
  return map[status] || status;
}

export default function ReviewQueue() {
  usePageTitle('Review Queue');
  const theme = useTheme();
  const navigate = useNavigate();

  const [ads, setAds] = useState<AdResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Bulk action dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject'>('approve');
  const [approverName, setApproverName] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Snackbar
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const fetchAds = useCallback(async () => {
    try {
      const res = await getAds();
      setAds(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  const handleSSE = useCallback(
    (event: SSEEvent) => {
      if (
        event.type === 'ad_complete' ||
        event.type === 'pipeline_complete' ||
        event.type === 'ad_approved' ||
        event.type === 'ad_rejected'
      ) {
        fetchAds();
      }
    },
    [fetchAds],
  );

  useSSE(handleSSE);

  // Derived data
  const queueAds = useMemo(
    () => ads.filter((a) => (QUEUE_STATUSES as readonly string[]).includes(a.status)),
    [ads],
  );

  const pendingCount = useMemo(
    () => ads.filter((a) => ['needs_review', 'evaluator_pass', 'compliance_pass'].includes(a.status)).length,
    [ads],
  );

  const approvedTodayCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return ads.filter(
      (a) => a.status === 'human_approved' && a.approved_at && a.approved_at.startsWith(today),
    ).length;
  }, [ads]);

  const rejectedCount = useMemo(() => ads.filter((a) => a.status === 'rejected').length, [ads]);
  const experimentReadyCount = useMemo(() => ads.filter((a) => a.status === 'experiment_ready').length, [ads]);

  // Sorting
  const sortedQueue = useMemo(() => {
    const arr = [...queueAds];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'score') {
        const sa = a.copy_iterations[a.best_copy_index]?.evaluation.weighted_average ?? 0;
        const sb = b.copy_iterations[b.best_copy_index]?.evaluation.weighted_average ?? 0;
        cmp = sa - sb;
      } else if (sortField === 'status') {
        cmp = (STATUS_PRIORITY[a.status] ?? 99) - (STATUS_PRIORITY[b.status] ?? 99);
      } else if (sortField === 'age') {
        const ta = a.approved_at ? new Date(a.approved_at).getTime() : 0;
        const tb = b.approved_at ? new Date(b.approved_at).getTime() : 0;
        cmp = ta - tb;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [queueAds, sortField, sortDir]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === sortedQueue.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedQueue.map((a) => a.brief_id)));
    }
  };

  // Bulk actions
  const openDialog = (action: 'approve' | 'reject') => {
    setDialogAction(action);
    setApproverName('');
    setActionNotes('');
    setDialogOpen(true);
  };

  const handleBulkAction = async () => {
    if (!approverName.trim()) return;
    setActionLoading(true);
    try {
      const ids = Array.from(selected);
      if (dialogAction === 'approve') {
        await api.post('/ads/bulk-approve', {
          brief_ids: ids,
          approved_by: approverName.trim(),
          notes: actionNotes.trim(),
        });
      } else {
        await api.post('/ads/bulk-reject', {
          brief_ids: ids,
          rejected_by: approverName.trim(),
          reason: actionNotes.trim(),
        });
      }
      setSnack({
        open: true,
        message: `${ids.length} ad(s) ${dialogAction === 'approve' ? 'approved' : 'rejected'} successfully`,
        severity: 'success',
      });
      setSelected(new Set());
      setDialogOpen(false);
      await fetchAds();
    } catch {
      setSnack({ open: true, message: `Bulk ${dialogAction} failed`, severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Launch checklist
  const allEvaluated = useMemo(
    () => ads.length > 0 && ads.every((a) => a.status !== 'generated' && a.status !== 'iterating'),
    [ads],
  );
  const allComplianceChecked = useMemo(
    () => ads.length > 0 && ads.every((a) => a.compliance !== null),
    [ads],
  );
  const noPending = useMemo(() => pendingCount === 0, [pendingCount]);
  const hasExperimentReady = useMemo(() => experimentReadyCount > 0, [experimentReadyCount]);

  const checklistItems = [
    { label: 'All ads evaluated', pass: allEvaluated },
    { label: 'Compliance checked', pass: allComplianceChecked },
    { label: 'Human review complete', pass: noPending },
    { label: 'At least 1 experiment-ready', pass: hasExperimentReady },
  ];
  const checklistDone = checklistItems.filter((c) => c.pass).length;
  const checklistProgress = checklistItems.length > 0 ? (checklistDone / checklistItems.length) * 100 : 0;

  // Stat card helper
  const StatCard = ({
    icon,
    label,
    value,
    color,
    delay,
  }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: string;
    delay: string;
  }) => (
    <Grid size={{ xs: 6, md: 3 }}>
      <Paper
        sx={{
          p: 2.5,
          position: 'relative',
          overflow: 'hidden',
          animation: `${fadeInUp} 0.6s ease-out both`,
          animationDelay: delay,
          transition: 'transform 0.25s ease, box-shadow 0.3s ease',
          '&:hover': { transform: 'translateY(-2px)', boxShadow: 6 },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${color}18`,
              color,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              <AnimatedNumber value={value} />
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Grid>
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <Box sx={{ px: { xs: 2, md: 4 }, py: 4, maxWidth: 1600, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3, animation: `${fadeInUp} 0.6s ease-out both` }}>
        <Typography variant="h4" fontWeight={800}>
          Review Queue
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {loading ? 'Loading...' : `${queueAds.length} ad(s) awaiting review`}
        </Typography>
      </Box>

      {/* Stats Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <StatCard
          icon={<PendingActionsRoundedIcon fontSize="small" />}
          label="Pending Review"
          value={pendingCount}
          color="#F59E0B"
          delay="0.05s"
        />
        <StatCard
          icon={<CheckCircleRoundedIcon fontSize="small" />}
          label="Approved Today"
          value={approvedTodayCount}
          color="#10B981"
          delay="0.1s"
        />
        <StatCard
          icon={<CancelRoundedIcon fontSize="small" />}
          label="Rejected"
          value={rejectedCount}
          color="#EF4444"
          delay="0.15s"
        />
        <StatCard
          icon={<ScienceRoundedIcon fontSize="small" />}
          label="Experiment Ready"
          value={experimentReadyCount}
          color="#3B82F6"
          delay="0.2s"
        />
      </Grid>

      {/* Main content: table + sidebar */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {/* Queue Table */}
        <Box sx={{ flex: 1, minWidth: 0, animation: `${fadeInUp} 0.6s ease-out both`, animationDelay: '0.25s' }}>
          {/* Bulk Action Bar */}
          <Fade in={selected.size > 0}>
            <Paper
              sx={{
                mb: 2,
                px: 2.5,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {selected.size} selected
              </Typography>
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => openDialog('approve')}
              >
                Approve Selected ({selected.size})
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => openDialog('reject')}
              >
                Reject Selected ({selected.size})
              </Button>
            </Paper>
          </Fade>

          <TableContainer component={Paper}>
            {loading ? (
              <Box sx={{ p: 3 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} height={48} sx={{ mb: 1 }} />
                ))}
              </Box>
            ) : sortedQueue.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">No ads in the review queue.</Typography>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={selected.size > 0 && selected.size < sortedQueue.length}
                        checked={selected.size === sortedQueue.length && sortedQueue.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </TableCell>
                    <TableCell>Headline</TableCell>
                    <TableCell>Audience</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'score'}
                        direction={sortField === 'score' ? sortDir : 'asc'}
                        onClick={() => handleSort('score')}
                      >
                        Score
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'status'}
                        direction={sortField === 'status' ? sortDir : 'asc'}
                        onClick={() => handleSort('status')}
                      >
                        Status
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Weakest Dimension</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortField === 'age'}
                        direction={sortField === 'age' ? sortDir : 'asc'}
                        onClick={() => handleSort('age')}
                      >
                        Age
                      </TableSortLabel>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedQueue.map((ad) => {
                    const best = ad.copy_iterations[ad.best_copy_index];
                    const score = best?.evaluation.weighted_average ?? 0;
                    const weakest = best?.evaluation.weakest_dimension ?? '--';
                    const weakestScore =
                      best?.evaluation.scores[weakest]?.score ?? 0;
                    const headline = best?.ad_copy.headline ?? '--';
                    const isSelected = selected.has(ad.brief_id);

                    return (
                      <TableRow
                        key={ad.brief_id}
                        hover
                        selected={isSelected}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleSelect(ad.brief_id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell
                          onClick={() => navigate(`/ads/${ad.brief_id}`)}
                          sx={{
                            maxWidth: 260,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontWeight: 600,
                            color: theme.palette.primary.main,
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          {headline}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={ad.brief.audience_segment}
                            size="small"
                            sx={{
                              background: 'rgba(242,101,34,0.08)',
                              color: '#F26522',
                              border: '1px solid rgba(242,101,34,0.2)',
                              fontWeight: 600,
                              fontSize: '0.72rem',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{ color: scoreColor(score) }}
                          >
                            {score.toFixed(1)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusLabel(ad.status)}
                            size="small"
                            color={statusColor(ad.status)}
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={`${weakest}: ${weakestScore.toFixed(1)}`} arrow>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                              <Box sx={{ flex: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={(weakestScore / 10) * 100}
                                  sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                                    '& .MuiLinearProgress-bar': {
                                      backgroundColor: scoreColor(weakestScore),
                                      borderRadius: 3,
                                    },
                                  }}
                                />
                              </Box>
                              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 60, fontSize: '0.7rem' }}>
                                {weakest}
                              </Typography>
                            </Box>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {timeAgo(ad.approved_at)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        </Box>

        {/* Launch Checklist Sidebar */}
        <Paper
          sx={{
            width: 300,
            flexShrink: 0,
            p: 2.5,
            animation: `${fadeInUp} 0.6s ease-out both`,
            animationDelay: '0.3s',
            display: { xs: 'none', lg: 'block' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <RocketLaunchRoundedIcon sx={{ color: '#F26522' }} />
            <Typography variant="subtitle1" fontWeight={700}>
              Launch Checklist
            </Typography>
          </Box>

          <Box sx={{ mb: 2.5 }}>
            {checklistItems.map((item) => (
              <Box
                key={item.label}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2 }}
              >
                {item.pass ? (
                  <CheckCircleRoundedIcon sx={{ fontSize: 18, color: '#10B981' }} />
                ) : (
                  <CancelRoundedIcon sx={{ fontSize: 18, color: '#EF4444' }} />
                )}
                <Typography
                  variant="body2"
                  sx={{
                    color: item.pass ? 'text.primary' : 'text.secondary',
                    fontWeight: item.pass ? 600 : 400,
                  }}
                >
                  {item.label}
                </Typography>
              </Box>
            ))}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Pipeline progress: {checklistDone}/{checklistItems.length}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={checklistProgress}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
                background: checklistProgress === 100
                  ? 'linear-gradient(90deg, #10B981, #059669)'
                  : 'linear-gradient(90deg, #F26522, #F59E0B)',
              },
            }}
          />
          {checklistProgress === 100 && (
            <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#10B981', fontWeight: 600 }}>
              Ready for launch!
            </Typography>
          )}
        </Paper>
      </Box>

      {/* Bulk Action Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogAction === 'approve' ? 'Approve' : 'Reject'} {selected.size} Ad(s)
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Your name"
            value={approverName}
            onChange={(e) => setApproverName(e.target.value)}
            size="small"
            fullWidth
            required
          />
          <TextField
            label={dialogAction === 'approve' ? 'Notes (optional)' : 'Reason'}
            value={actionNotes}
            onChange={(e) => setActionNotes(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={3}
            required={dialogAction === 'reject'}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkAction}
            variant="contained"
            color={dialogAction === 'approve' ? 'success' : 'error'}
            disabled={
              actionLoading ||
              !approverName.trim() ||
              (dialogAction === 'reject' && !actionNotes.trim())
            }
          >
            {actionLoading ? 'Processing...' : dialogAction === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
