import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  timestamp: string;
  value: number;
  [key: string]: unknown;
}

interface LatencyChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  color?: string;
  showGrid?: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass-card p-3 border border-noc-border/50 shadow-noc-glow-lg">
      <p className="text-xs text-noc-muted mb-1">
        {new Date(label).toLocaleTimeString()}
      </p>
      <p className="text-sm font-bold text-noc-amber">
        {payload[0].value.toFixed(2)} ms
      </p>
    </div>
  );
}

export default function LatencyChart({
  data,
  title = 'Latency',
  height = 250,
  color = '#ffaa00',
  showGrid = true,
}: LatencyChartProps) {
  const gradientId = `latency-gradient-${title.replace(/\s/g, '')}`;

  return (
    <div className="glass-card p-5">
      {title && (
        <h3 className="text-sm font-semibold text-noc-text mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e2560"
              vertical={false}
            />
          )}
          <XAxis
            dataKey="timestamp"
            tickFormatter={(val) => {
              try {
                return new Date(val).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
              } catch {
                return val;
              }
            }}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#1e2560' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => `${val}ms`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{
              r: 4,
              fill: color,
              stroke: '#0a0e27',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
