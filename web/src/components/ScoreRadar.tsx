import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  scores: Record<string, { score: number }>;
  prevScores?: Record<string, { score: number }>;
  animationKey?: string | number;
}

const LABEL_MAP: Record<string, string> = {
  clarity: 'Clarity',
  value_proposition: 'Value Prop',
  cta_strength: 'CTA Strength',
  emotional_resonance: 'Emotion',
  brand_voice: 'Brand Voice',
};

export default function ScoreRadar({ scores, prevScores, animationKey }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const data = useMemo(() => Object.entries(scores).map(([dim, s]) => ({
    dimension: LABEL_MAP[dim] || dim,
    score: s.score,
    prevScore: prevScores?.[dim]?.score ?? undefined,
    fullMark: 10,
  })), [scores, prevScores]);

  const key = animationKey ?? JSON.stringify(scores);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%" key={key}>
        <PolarGrid stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 12.5, fontWeight: 600 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 10]}
          tick={{ fill: '#94A3B8', fontSize: 10 }}
          tickCount={6}
          axisLine={false}
        />
        {/* Previous iteration ghost overlay */}
        {prevScores && (
          <Radar
            name="Previous"
            dataKey="prevScore"
            stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}
            fill={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
            fillOpacity={0.3}
            strokeWidth={1}
            strokeDasharray="4 3"
            dot={{ r: 2, fill: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)', strokeWidth: 0 }}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />
        )}
        <Radar
          name="Score"
          dataKey="score"
          stroke="#F26522"
          fill="url(#radarGradient)"
          fillOpacity={0.3}
          strokeWidth={2}
          dot={{ r: 4, fill: '#F26522', strokeWidth: 0 }}
          isAnimationActive={true}
          animationDuration={800}
          animationEasing="ease-out"
        />
        <defs>
          <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F26522" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#10B981" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{
            background: isDark ? 'rgba(26,29,39,0.98)' : 'rgba(255,255,255,0.95)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: 10,
            color: isDark ? '#E2E8F0' : '#1E293B',
            backdropFilter: 'blur(10px)',
            fontSize: '0.82rem',
          }}
          formatter={(value: unknown, name: unknown) => [
            `${value}/10`,
            name === 'Previous' ? 'Previous Iteration' : 'Current Score',
          ]}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
