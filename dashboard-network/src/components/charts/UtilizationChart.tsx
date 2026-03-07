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

interface UtilizationChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  color?: string;
  maxValue?: number;
  showGrid?: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass-card p-3 border border-noc-border/50 shadow-noc-glow-lg">
      <p className="text-xs text-noc-muted mb-1">
        {new Date(label).toLocaleTimeString()}
      </p>
      <p className="text-sm font-bold text-noc-cyan">
        {payload[0].value.toFixed(1)}%
      </p>
    </div>
  );
}

export default function UtilizationChart({
  data,
  title = 'Utilization',
  height = 250,
  color = '#00d4ff',
  maxValue = 100,
  showGrid = true,
}: UtilizationChartProps) {
  const gradientId = `util-gradient-${title.replace(/\s/g, '')}`;

  // Dynamic color based on latest value
  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
  const dynamicColor =
    latestValue > 90 ? '#ff4444' : latestValue > 70 ? '#ffaa00' : color;

  return (
    <div className="glass-card p-5">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-noc-text">{title}</h3>
          <span
            className="text-lg font-bold"
            style={{ color: dynamicColor }}
          >
            {latestValue.toFixed(1)}%
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={dynamicColor} stopOpacity={0.3} />
              <stop offset="95%" stopColor={dynamicColor} stopOpacity={0} />
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
            domain={[0, maxValue]}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => `${val}%`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={dynamicColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{
              r: 4,
              fill: dynamicColor,
              stroke: '#0a0e27',
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
