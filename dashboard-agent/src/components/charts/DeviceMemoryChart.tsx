import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { HardDrive } from 'lucide-react';
import type { DeviceTelemetryPoint } from '../../api/agent';

interface Props {
  data: Record<string, DeviceTelemetryPoint[]>;
  onDeviceClick?: (deviceId: string) => void;
}

const DEVICE_COLORS: Record<string, string> = {
  'core-delhi-1': '#00d4ff',
  'core-delhi-2': '#00ff88',
  'core-mumbai-1': '#a855f7',
  'core-mumbai-2': '#ffaa00',
  'agg-delhi-1': '#ff6b6b',
  'agg-mumbai-1': '#4ecdc4',
};

const FRIENDLY: Record<string, string> = {
  'core-delhi-1': 'Delhi Core 1',
  'core-delhi-2': 'Delhi Core 2',
  'core-mumbai-1': 'Mumbai Core 1',
  'core-mumbai-2': 'Mumbai Core 2',
  'agg-delhi-1': 'Delhi Agg',
  'agg-mumbai-1': 'Mumbai Agg',
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export default function DeviceMemoryChart({ data, onDeviceClick }: Props) {
  const deviceIds = Object.keys(data);
  if (deviceIds.length === 0) {
    return (
      <div className="glass-card p-3">
        <div className="flex items-center gap-2 mb-2">
          <HardDrive className="w-3.5 h-3.5 text-noc-purple" />
          <span className="text-xs font-bold text-noc-muted uppercase tracking-wider">Memory Per Device</span>
        </div>
        <div className="h-[200px] flex items-center justify-center text-noc-muted text-xs">
          Waiting for telemetry data...
        </div>
      </div>
    );
  }

  const timeMap = new Map<string, Record<string, number | null>>();
  for (const [deviceId, points] of Object.entries(data)) {
    for (const pt of points) {
      if (!timeMap.has(pt.time)) {
        timeMap.set(pt.time, { time_raw: pt.time } as any);
      }
      const entry = timeMap.get(pt.time)!;
      (entry as any)[deviceId] = pt.memory_utilization;
    }
  }

  const merged = Array.from(timeMap.values())
    .sort((a: any, b: any) => a.time_raw?.localeCompare(b.time_raw))
    .map((entry: any) => ({
      ...entry,
      time: formatTime(entry.time_raw),
    }));

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-noc-purple" />
          <span className="text-xs font-bold text-noc-muted uppercase tracking-wider">
            Memory Per Device
          </span>
        </div>
        <span className="text-[10px] text-noc-muted">Last 10 min</span>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={merged} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            {deviceIds.map((id) => (
              <linearGradient key={id} id={`mem-grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={DEVICE_COLORS[id] || '#a855f7'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={DEVICE_COLORS[id] || '#a855f7'} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2560" strokeOpacity={0.5} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: '#8892b0' }}
            interval="preserveStartEnd"
            tickCount={5}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: '#8892b0' }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#161b4a',
              border: '1px solid #1e2560',
              borderRadius: '8px',
              fontSize: '11px',
            }}
            labelStyle={{ color: '#8892b0' }}
            formatter={(value: number, name: string) => [
              `${(value || 0).toFixed(1)}%`,
              FRIENDLY[name] || name,
            ]}
          />
          {deviceIds.map((id) => (
            <Area
              key={id}
              type="monotone"
              dataKey={id}
              stroke={DEVICE_COLORS[id] || '#a855f7'}
              fill={`url(#mem-grad-${id})`}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-3 mt-2">
        {deviceIds.map((id) => (
          <button
            key={id}
            onClick={() => onDeviceClick?.(id)}
            className="flex items-center gap-1.5 text-[10px] text-noc-muted hover:text-noc-text transition-colors"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: DEVICE_COLORS[id] || '#a855f7' }}
            />
            {FRIENDLY[id] || id}
          </button>
        ))}
      </div>
    </div>
  );
}
