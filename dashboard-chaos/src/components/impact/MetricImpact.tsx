import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { NetworkMetrics } from '../../api/chaos';

interface MetricImpactProps {
  title: string;
  metricKey: keyof NetworkMetrics;
  data: NetworkMetrics[];
  baseline?: number | null;
  unit?: string;
  color?: string;
  invertDanger?: boolean; // true for health_score where lower is bad
  height?: number;
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card p-3 border border-noc-border">
        <p className="text-xs text-noc-muted mb-1">{label}</p>
        <p className="text-sm font-mono font-bold text-cyan-400">
          {typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : payload[0].value}
          {unit && <span className="text-noc-muted ml-1">{unit}</span>}
        </p>
      </div>
    );
  }
  return null;
};

export const MetricImpact: React.FC<MetricImpactProps> = ({
  title,
  metricKey,
  data,
  baseline,
  unit = '',
  color = '#00d4ff',
  invertDanger = false,
  height = 200,
}) => {
  const chartData = useMemo(() => {
    return data.map((d, i) => {
      const ts = d.timestamp ? new Date(d.timestamp) : null;
      return {
        time: ts ? ts.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `T+${i}`,
        value: d[metricKey] as number,
      };
    });
  }, [data, metricKey]);

  const rawCurrentValue = chartData.length > 0 ? chartData[chartData.length - 1].value : null;
  const currentValue = typeof rawCurrentValue === 'number' && isFinite(rawCurrentValue) ? rawCurrentValue : null;

  const getStatus = () => {
    if (currentValue === null || baseline === null || baseline === undefined) return 'normal';
    const deviation = invertDanger
      ? ((baseline - currentValue) / baseline) * 100
      : ((currentValue - baseline) / (baseline || 1)) * 100;
    if (Math.abs(deviation) > 50) return 'critical';
    if (Math.abs(deviation) > 20) return 'degraded';
    return 'normal';
  };

  const status = getStatus();
  const statusColor = status === 'critical' ? '#ff4444' : status === 'degraded' ? '#ffaa00' : color;
  const gradientId = `gradient-${metricKey}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-4 ${
        status === 'critical' ? 'border-red-400/30' : status === 'degraded' ? 'border-amber-400/30' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-noc-muted">{title}</h3>
        <div className="flex items-center gap-2">
          {currentValue !== null && (
            <span className="text-lg font-mono font-bold" style={{ color: statusColor }}>
              {currentValue.toFixed(1)}
              <span className="text-xs text-noc-muted ml-1">{unit}</span>
            </span>
          )}
          {baseline !== null && baseline !== undefined && (
            <span className="text-xs text-noc-muted font-mono">
              base: {baseline.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={statusColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={statusColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 38, 80, 0.5)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: '#8892b0' }}
            stroke="rgba(30, 38, 80, 0.5)"
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#8892b0' }}
            stroke="rgba(30, 38, 80, 0.5)"
            domain={invertDanger ? [0, 100] : ['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          {baseline !== null && baseline !== undefined && (
            <ReferenceLine
              y={baseline}
              stroke="#8892b0"
              strokeDasharray="6 3"
              label={{ value: 'baseline', position: 'insideBottomRight', fill: '#8892b0', fontSize: 10 }}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={statusColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

export default MetricImpact;
