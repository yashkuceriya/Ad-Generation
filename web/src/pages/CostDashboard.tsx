import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import usePageTitle from '../hooks/usePageTitle';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import TokenRoundedIcon from '@mui/icons-material/TokenRounded';
import ApiRoundedIcon from '@mui/icons-material/ApiRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import Skeleton from '@mui/material/Skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import { getCostSummary, getCostLedger } from '../api/endpoints';
import type { CostSummary, StepCost, ParseTelemetry } from '../types';

const CHART_COLORS = ['#F26522', '#10B981', '#F59E0B', '#EF4444', '#FF8A50', '#24C6DC'];

function CostStatCard({ title, value, subtitle, icon, gradient }: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode; gradient: string;
}) {
  return (
    <Paper
      sx={{
        p: 2.5,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute', top: 0, right: 0,
          width: 100, height: 100, borderRadius: '50%',
          background: gradient, opacity: 0.06,
          transform: 'translate(30%, -30%)',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mt: 0.25, fontSize: '1.75rem', lineHeight: 1 }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontSize: '0.68rem' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: '10px',
            background: gradient, display: 'flex',
            alignItems: 'center', justifyContent: 'center', opacity: 0.8,
          }}
        >
          {icon}
        </Box>
      </Box>
    </Paper>
  );
}

export default function CostDashboard() {
  usePageTitle('Cost Analytics');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const tooltipStyle = {
    background: isDark ? 'rgba(26,29,39,0.98)' : 'rgba(255,255,255,0.95)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
    borderRadius: 10,
    color: isDark ? '#E2E8F0' : '#1E293B',
    backdropFilter: 'blur(10px)',
    fontSize: '0.82rem',
  };
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [ledger, setLedger] = useState<StepCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [parseTelemetry, setParseTelemetry] = useState<ParseTelemetry | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    setFetchError(null);
    Promise.all([
      getCostSummary().then(r => {
        setSummary(r.data);
        if (r.data.parse_telemetry) setParseTelemetry(r.data.parse_telemetry);
      }),
      getCostLedger().then(r => setLedger(r.data)),
    ]).catch(() => { setFetchError('Failed to load cost data'); }).finally(() => setLoading(false));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadData(); }, [loadData]);

  // Derived data
  const stageData = useMemo(() =>
    summary ? Object.entries(summary.cost_by_stage).map(([name, value]) => ({
      name: name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: Number(value.toFixed(6)),
    })) : []
  , [summary]);

  const modelData = useMemo(() =>
    summary ? Object.entries(summary.cost_by_model).map(([name, value]) => ({
      name: name.split('/').pop() || name,
      value: Number(value.toFixed(6)),
    })) : []
  , [summary]);

  // Per-brief cost breakdown
  const briefCosts = useMemo(() => {
    const map: Record<string, { cost: number; calls: number; tokens: number; latency: number }> = {};
    ledger.forEach(e => {
      if (!e.brief_id) return;
      if (!map[e.brief_id]) map[e.brief_id] = { cost: 0, calls: 0, tokens: 0, latency: 0 };
      map[e.brief_id].cost += e.cost_usd;
      map[e.brief_id].calls += 1;
      map[e.brief_id].tokens += e.input_tokens + e.output_tokens;
      map[e.brief_id].latency += e.latency_ms;
    });
    return Object.entries(map)
      .map(([id, v]) => ({
        name: id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id,
        fullId: id,
        cost: Number(v.cost.toFixed(6)),
        calls: v.calls,
        tokens: v.tokens,
        latency: Math.round(v.latency),
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [ledger]);

  // Step breakdown
  const stepData = useMemo(() => {
    const stepMap: Record<string, { cost: number; calls: number; avgLatency: number }> = {};
    ledger.forEach(e => {
      if (!stepMap[e.step_name]) stepMap[e.step_name] = { cost: 0, calls: 0, avgLatency: 0 };
      stepMap[e.step_name].cost += e.cost_usd;
      stepMap[e.step_name].calls += 1;
      stepMap[e.step_name].avgLatency += e.latency_ms;
    });
    return Object.entries(stepMap)
      .map(([name, v]) => ({
        name: name.replace(/_/g, ' '),
        cost: Number(v.cost.toFixed(6)),
        calls: v.calls,
        avgLatency: Math.round(v.avgLatency / v.calls),
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [ledger]);

  // Latency stats
  const latencyStats = useMemo(() => {
    if (ledger.length === 0) return null;
    const latencies = ledger.map(e => e.latency_ms).filter(l => l > 0);
    if (latencies.length === 0) return null;
    const sorted = [...latencies].sort((a, b) => a - b);
    return {
      avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      p50: Math.round(sorted[Math.floor(sorted.length * 0.5)]),
      p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
      total: Math.round(latencies.reduce((a, b) => a + b, 0)),
    };
  }, [ledger]);

  const renderCustomLabel = (props: PieLabelRenderProps) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0, name = '' } = props as { cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number; name: string };
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill={isDark ? '#94A3B8' : '#64748B'} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight={600}>
        {name} {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={100} animation="wave" sx={{ mb: 3.5, borderRadius: '20px' }} />
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid size={{ xs: 6, md: 3 }} key={i}>
              <Skeleton variant="rounded" height={100} animation="wave" sx={{ borderRadius: '12px' }} />
            </Grid>
          ))}
        </Grid>
        <Grid container spacing={2.5}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid size={{ xs: 12, md: i < 2 ? 6 : 12 }} key={i}>
              <Skeleton variant="rounded" height={280} animation="wave" sx={{ borderRadius: '12px' }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (fetchError) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={800} gutterBottom>Cost Analytics</Typography>
        <Alert severity="error" sx={{ borderRadius: '12px' }}
          action={<Button color="inherit" size="small" onClick={loadData}>Retry</Button>}
        >
          {fetchError}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          mb: 3.5,
          p: 3.5,
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Box
              sx={{
                width: 36, height: 36, borderRadius: '10px',
                background: 'linear-gradient(135deg, #10B981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <PaidRoundedIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
              Cost Analytics
            </Typography>
            <Chip
              label="via OpenRouter"
              size="small"
              sx={{
                fontWeight: 600, fontSize: '0.62rem', height: 22,
                bgcolor: 'rgba(242,101,34,0.08)', color: '#F26522',
                border: '1px solid rgba(242,101,34,0.15)',
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.6 }}>
            API usage across models and pipeline stages. All calls routed through OpenRouter.
          </Typography>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3.5 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <CostStatCard
            title="Total Cost"
            value={`$${summary?.total_cost_usd?.toFixed(4) || '0.00'}`}
            subtitle={`${summary?.total_calls || 0} API calls${summary?.image_costs?.count ? ` · incl. ${summary.image_costs.count} images` : ''}`}
            icon={<PaidRoundedIcon sx={{ fontSize: 18, color: 'white' }} />}
            gradient="linear-gradient(135deg, #F26522, #D4541A)"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <CostStatCard
            title="Total Tokens"
            value={(summary?.total_tokens || 0).toLocaleString()}
            subtitle="input + output combined"
            icon={<TokenRoundedIcon sx={{ fontSize: 18, color: 'white' }} />}
            gradient="linear-gradient(135deg, #10B981, #059669)"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <CostStatCard
            title="API Calls"
            value={String(summary?.total_calls || 0)}
            subtitle={briefCosts.length > 0 ? `across ${briefCosts.length} briefs` : undefined}
            icon={<ApiRoundedIcon sx={{ fontSize: 18, color: 'white' }} />}
            gradient="linear-gradient(135deg, #F59E0B, #F5C400)"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <CostStatCard
            title="Avg Latency"
            value={latencyStats ? `${(latencyStats.avg / 1000).toFixed(1)}s` : '—'}
            subtitle={latencyStats ? `p50: ${(latencyStats.p50 / 1000).toFixed(1)}s · p95: ${(latencyStats.p95 / 1000).toFixed(1)}s` : undefined}
            icon={<SpeedRoundedIcon sx={{ fontSize: 18, color: 'white' }} />}
            gradient="linear-gradient(135deg, #EF4444, #EE5A5A)"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        {/* Cost by Stage */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>
              Cost by Pipeline Stage
            </Typography>
            {stageData.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No cost data yet</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stageData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={95} innerRadius={45}
                    label={renderCustomLabel}
                    strokeWidth={0}
                  >
                    {stageData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.8} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v).toFixed(6)}`, 'Cost']} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Cost by Model */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>
              Cost by Model
            </Typography>
            {modelData.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No cost data yet</Typography>
              </Box>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={modelData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                      label={renderCustomLabel}
                      strokeWidth={0}
                    >
                      {modelData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} fillOpacity={0.8} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${Number(v).toFixed(6)}`, 'Cost']} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Model legend with token rates */}
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {modelData.map((m, i) => (
                    <Box key={m.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: CHART_COLORS[(i + 2) % CHART_COLORS.length] }} />
                      <Typography variant="caption" sx={{ fontSize: '0.7rem', flex: 1 }}>{m.name}</Typography>
                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.7rem' }}>
                        ${m.value.toFixed(6)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Paper>
        </Grid>

        {/* Cost by Step — detailed breakdown */}
        <Grid size={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ fontSize: '1rem' }}>
              Cost & Latency by Step
            </Typography>
            {stepData.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No cost data yet</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {stepData.map((step, i) => {
                  const maxCost = stepData[0].cost;
                  const pct = maxCost > 0 ? (step.cost / maxCost) * 100 : 0;
                  const color = CHART_COLORS[i % CHART_COLORS.length];
                  return (
                    <Box key={step.name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.84rem', textTransform: 'capitalize' }}>
                            {step.name}
                          </Typography>
                          <Chip
                            label={`${step.calls} calls`}
                            size="small"
                            sx={{ fontWeight: 600, fontSize: '0.58rem', height: 18, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                            avg {(step.avgLatency / 1000).toFixed(1)}s
                          </Typography>
                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.84rem', minWidth: 70, textAlign: 'right' }}>
                            ${step.cost.toFixed(6)}
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={pct}
                        sx={{
                          height: 6, borderRadius: 3,
                          bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                        }}
                      />
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Per-Brief Cost Breakdown */}
        {briefCosts.length > 0 && (
          <Grid size={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                  Cost per Brief
                </Typography>
                <Chip
                  label={`${briefCosts.length} briefs`}
                  size="small"
                  sx={{ fontWeight: 600, fontSize: '0.62rem', height: 20, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}
                />
              </Box>
              <ResponsiveContainer width="100%" height={Math.max(200, briefCosts.length * 40)}>
                <BarChart data={briefCosts} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <XAxis
                    type="number"
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <YAxis
                    type="category" dataKey="name"
                    tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 10, fontWeight: 600 }}
                    width={90} axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v, _name, props) => {
                      const entry = props.payload;
                      return [
                        `$${Number(v).toFixed(6)} · ${entry.calls} calls · ${entry.tokens.toLocaleString()} tokens · ${(entry.latency / 1000).toFixed(1)}s`,
                        'Cost',
                      ];
                    }}
                  />
                  <Bar dataKey="cost" radius={[0, 6, 6, 0]} barSize={20}>
                    {briefCosts.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* System Health */}
        {parseTelemetry && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
                <HealthAndSafetyRoundedIcon sx={{ fontSize: 20, color: '#10B981' }} />
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1rem' }}>
                  System Health
                </Typography>
              </Box>
              {(() => {
                const total = Object.values(parseTelemetry).reduce((a, b) => a + b, 0);
                const successRate = total > 0 ? (parseTelemetry.json_ok / total * 100) : 100;
                const healthColor = total === 0 ? '#64748B' : successRate >= 90 ? '#10B981' : successRate >= 70 ? '#F59E0B' : '#EF4444';
                const healthLabel = total === 0 ? 'No Data' : successRate >= 90 ? 'Excellent' : successRate >= 70 ? 'Good' : 'Degraded';
                return (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" fontWeight={800} sx={{ color: healthColor }}>
                          {successRate.toFixed(0)}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          Parse Success
                        </Typography>
                      </Box>
                      <Chip
                        label={healthLabel}
                        size="small"
                        sx={{
                          fontWeight: 700, fontSize: '0.7rem',
                          bgcolor: `${healthColor}15`, color: healthColor,
                          border: `1px solid ${healthColor}30`,
                        }}
                      />
                      <Box sx={{ textAlign: 'center', ml: 'auto' }}>
                        <Typography variant="h5" fontWeight={800} sx={{ color: isDark ? '#94A3B8' : '#64748B' }}>
                          {total}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          Total Evals
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {[
                        { key: 'json_ok' as const, label: 'Clean JSON', color: '#10B981' },
                        { key: 'json_extract_fallback' as const, label: 'JSON Extract', color: '#F59E0B' },
                        { key: 'regex_fallback' as const, label: 'Regex Fallback', color: '#F26522' },
                        { key: 'default_fallback' as const, label: 'Default Fallback', color: '#EF4444' },
                      ].map(({ key, label, color }) => {
                        const count = parseTelemetry[key];
                        const pct = total > 0 ? (count / total * 100) : 0;
                        return (
                          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" sx={{ fontSize: '0.78rem', minWidth: 110, color: isDark ? 'rgba(226,232,240,0.7)' : 'rgba(30,41,59,0.7)' }}>
                              {label}
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              sx={{
                                flex: 1, height: 5, borderRadius: 3,
                                bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 3 },
                              }}
                            />
                            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.78rem', color, minWidth: 24, textAlign: 'right' }}>
                              {count}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })()}
            </Paper>
          </Grid>
        )}

        {/* Pricing Context */}
        <Grid size={12}>
          <Paper sx={{ p: 2.5, bgcolor: 'rgba(242,101,34,0.02)', border: '1px solid rgba(242,101,34,0.1)' }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.82rem', mb: 1 }}>
              Pricing Notes
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', lineHeight: 1.6 }}>
                All costs are calculated using OpenRouter published rates.
                Gemini 2.5 Flash: $0.50/M input, $3.00/M output.
                Gemini 2.0 Flash Lite: $0.25/M input, $1.50/M output.
                Image generation: $0.07/image via Gemini Flash Image (now included in total cost).
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', lineHeight: 1.6 }}>
                Pipeline uses rate limiting (3s min delay between calls) to avoid 429 errors.
                Latency figures include both rate limiter wait time and API response time.
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
