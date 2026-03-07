import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Cpu,
  HardDrive,
  Thermometer,
  Activity,
  Clock,
  AlertTriangle,
  Gauge,
  ChevronDown,
  Radio,
} from 'lucide-react';

import { useTopology, useWSTelemetry } from '../hooks/useTelemetry';

const TIME_RANGES = [
  { label: '5m', value: '5m', points: 30 },
  { label: '30m', value: '30m', points: 60 },
  { label: '1h', value: '1h', points: 60 },
  { label: '6h', value: '6h', points: 72 },
];

// ── Custom Tooltip ─────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass-card p-3 border border-noc-border/50 shadow-noc-glow-lg min-w-[120px]">
      <p className="text-[10px] text-noc-muted mb-1">
        {typeof label === 'string' && label.includes('T')
          ? new Date(label).toLocaleTimeString()
          : label}
      </p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-bold" style={{ color: p.stroke || p.color }}>
          {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          {unit ? ` ${unit}` : ''}
        </p>
      ))}
    </div>
  );
}

// ── Time Series Chart Component ───────────────────────────

interface TimeSeriesChartProps {
  title: string;
  data: Array<{ timestamp: string; value: number }>;
  color: string;
  unit: string;
  icon: React.ReactNode;
  maxValue?: number;
  height?: number;
}

function TimeSeriesChart({
  title,
  data,
  color,
  unit,
  icon,
  maxValue,
  height = 220,
}: TimeSeriesChartProps) {
  const latestValue = data.length > 0 ? data[data.length - 1].value : 0;
  const gradientId = `grad-${title.replace(/\s+/g, '-')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="glass-card p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg border"
            style={{
              backgroundColor: `${color}15`,
              borderColor: `${color}30`,
            }}
          >
            {icon}
          </div>
          <h3 className="text-sm font-semibold text-noc-text">{title}</h3>
        </div>
        <span className="text-lg font-bold" style={{ color }}>
          {latestValue.toFixed(2)} {unit}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2560" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(val) => {
              try {
                return new Date(val).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
              } catch {
                return String(val).slice(-8);
              }
            }}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#1e2560' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={maxValue ? [0, maxValue] : ['auto', 'auto']}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => `${val}${unit}`}
          />
          <Tooltip content={<ChartTooltip unit={unit} />} />
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
    </motion.div>
  );
}

// ── Selector Dropdown ─────────────────────────────────────

interface SelectorProps {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (val: string) => void;
}

function Selector({ label, value, options, onChange }: SelectorProps) {
  return (
    <div className="relative">
      <label className="text-[10px] uppercase tracking-wider text-noc-muted font-semibold block mb-1">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full glass-card px-3 py-2 pr-8 text-sm text-noc-text bg-noc-surface/50 border border-noc-border/50 rounded-lg focus:outline-none focus:border-noc-cyan/50 cursor-pointer"
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-noc-bg text-noc-text"
            >
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-noc-muted pointer-events-none" />
      </div>
    </div>
  );
}

// ── Main Telemetry Page ───────────────────────────────────

export default function Telemetry() {
  const { devices, links } = useTopology(15000);
  const { telemetryHistory } = useWSTelemetry(120);

  const [entityType, setEntityType] = useState<'device' | 'link'>('device');
  const [selectedEntity, setSelectedEntity] = useState<string>('');
  const [timeRange, setTimeRange] = useState('5m');

  // Build entity options
  const entityOptions = useMemo(() => {
    if (entityType === 'device') {
      return devices.map((d) => ({ value: d.device_id, label: `${d.device_id} (${d.city})` }));
    }
    return links.map((l) => ({
      value: l.link_id,
      label: `${l.from} -> ${l.to}`,
    }));
  }, [entityType, devices, links]);

  // Auto-select first entity
  const activeEntity = selectedEntity || (entityOptions.length > 0 ? entityOptions[0].value : '');

  // Extract time-series data from history for the selected entity
  const timeRangeConfig = TIME_RANGES.find((r) => r.value === timeRange) || TIME_RANGES[0];
  const relevantHistory = useMemo(
    () => telemetryHistory.slice(-timeRangeConfig.points),
    [telemetryHistory, timeRangeConfig.points]
  );

  const chartData = useMemo(() => {
    if (!activeEntity) {
      return { cpu: [], memory: [], temperature: [], utilization: [], latency: [], packetLoss: [], throughput: [] };
    }

    if (entityType === 'device') {
      return {
        cpu: relevantHistory.map((snap) => ({
          timestamp: snap.timestamp,
          value: snap.devices?.[activeEntity]?.cpu_utilization ?? 0,
        })),
        memory: relevantHistory.map((snap) => ({
          timestamp: snap.timestamp,
          value: snap.devices?.[activeEntity]?.memory_utilization ?? 0,
        })),
        temperature: relevantHistory.map((snap) => ({
          timestamp: snap.timestamp,
          value: snap.devices?.[activeEntity]?.temperature_celsius ?? 0,
        })),
        utilization: [],
        latency: [],
        packetLoss: [],
        throughput: [],
      };
    } else {
      return {
        cpu: [],
        memory: [],
        temperature: [],
        utilization: relevantHistory.map((snap) => ({
          timestamp: snap.timestamp,
          value: snap.links?.[activeEntity]?.utilization_percent ?? 0,
        })),
        latency: relevantHistory.map((snap) => ({
          timestamp: snap.timestamp,
          value: snap.links?.[activeEntity]?.latency_ms ?? 0,
        })),
        packetLoss: relevantHistory.map((snap) => ({
          timestamp: snap.timestamp,
          value: snap.links?.[activeEntity]?.packet_loss_percent ?? 0,
        })),
        throughput: relevantHistory.map((snap) => ({
          timestamp: snap.timestamp,
          value: snap.links?.[activeEntity]?.throughput_gbps ?? 0,
        })),
      };
    }
  }, [entityType, activeEntity, relevantHistory]);

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Telemetry</h1>
          <p className="text-sm text-noc-muted mt-1">
            Time-series performance metrics
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-card p-4">
        <div className="flex items-end gap-4">
          {/* Entity type toggle */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-noc-muted font-semibold block mb-1">
              Entity Type
            </label>
            <div className="flex rounded-lg overflow-hidden border border-noc-border/50">
              <button
                onClick={() => {
                  setEntityType('device');
                  setSelectedEntity('');
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  entityType === 'device'
                    ? 'bg-noc-cyan/20 text-noc-cyan border-r border-noc-border/50'
                    : 'bg-noc-surface/30 text-noc-muted hover:text-noc-text border-r border-noc-border/50'
                }`}
              >
                Devices
              </button>
              <button
                onClick={() => {
                  setEntityType('link');
                  setSelectedEntity('');
                }}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  entityType === 'link'
                    ? 'bg-noc-cyan/20 text-noc-cyan'
                    : 'bg-noc-surface/30 text-noc-muted hover:text-noc-text'
                }`}
              >
                Links
              </button>
            </div>
          </div>

          {/* Entity selector */}
          <div className="flex-1 max-w-sm">
            <Selector
              label={entityType === 'device' ? 'Device' : 'Link'}
              value={activeEntity}
              options={entityOptions}
              onChange={setSelectedEntity}
            />
          </div>

          {/* Time range */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-noc-muted font-semibold block mb-1">
              Time Range
            </label>
            <div className="flex rounded-lg overflow-hidden border border-noc-border/50">
              {TIME_RANGES.map((range) => (
                <button
                  key={range.value}
                  onClick={() => setTimeRange(range.value)}
                  className={`px-3 py-2 text-xs font-medium transition-colors border-r border-noc-border/50 last:border-r-0 ${
                    timeRange === range.value
                      ? 'bg-noc-cyan/20 text-noc-cyan'
                      : 'bg-noc-surface/30 text-noc-muted hover:text-noc-text'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 ml-auto">
            <Radio className="w-4 h-4 text-noc-green animate-pulse-glow" />
            <span className="text-xs text-noc-green font-medium">
              {relevantHistory.length} samples
            </span>
          </div>
        </div>
      </div>

      {/* No entity selected state */}
      {!activeEntity && (
        <div className="glass-card p-12 flex items-center justify-center">
          <div className="text-center">
            <Activity className="w-12 h-12 text-noc-muted mx-auto mb-3 opacity-50" />
            <p className="text-noc-muted text-sm">
              Select a {entityType} to view telemetry data
            </p>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      {activeEntity && entityType === 'device' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <TimeSeriesChart
            title="CPU Usage"
            data={chartData.cpu}
            color="#00d4ff"
            unit="%"
            maxValue={100}
            icon={<Cpu className="w-4 h-4" style={{ color: '#00d4ff' }} />}
          />
          <TimeSeriesChart
            title="Memory Usage"
            data={chartData.memory}
            color="#a855f7"
            unit="%"
            maxValue={100}
            icon={<HardDrive className="w-4 h-4" style={{ color: '#a855f7' }} />}
          />
          <TimeSeriesChart
            title="Temperature"
            data={chartData.temperature}
            color="#ffaa00"
            unit=" C"
            icon={<Thermometer className="w-4 h-4" style={{ color: '#ffaa00' }} />}
          />
        </div>
      )}

      {activeEntity && entityType === 'link' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeSeriesChart
            title="Utilization"
            data={chartData.utilization}
            color="#00d4ff"
            unit="%"
            maxValue={100}
            icon={<Activity className="w-4 h-4" style={{ color: '#00d4ff' }} />}
          />
          <TimeSeriesChart
            title="Latency"
            data={chartData.latency}
            color="#ffaa00"
            unit="ms"
            icon={<Clock className="w-4 h-4" style={{ color: '#ffaa00' }} />}
          />
          <TimeSeriesChart
            title="Packet Loss"
            data={chartData.packetLoss}
            color="#ff4444"
            unit="%"
            icon={<AlertTriangle className="w-4 h-4" style={{ color: '#ff4444' }} />}
          />
          <TimeSeriesChart
            title="Throughput"
            data={chartData.throughput}
            color="#00ff88"
            unit="Gbps"
            icon={<Gauge className="w-4 h-4" style={{ color: '#00ff88' }} />}
          />
        </div>
      )}

      {/* Aggregate Overview when entity selected */}
      {activeEntity && relevantHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-5"
        >
          <h3 className="text-sm font-semibold text-noc-text mb-3">
            Statistics Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {entityType === 'device' ? (
              <>
                <StatBox
                  label="Avg CPU"
                  value={avg(chartData.cpu.map((d) => d.value))}
                  unit="%"
                  color="#00d4ff"
                />
                <StatBox
                  label="Max CPU"
                  value={max(chartData.cpu.map((d) => d.value))}
                  unit="%"
                  color="#ff4444"
                />
                <StatBox
                  label="Avg Memory"
                  value={avg(chartData.memory.map((d) => d.value))}
                  unit="%"
                  color="#a855f7"
                />
                <StatBox
                  label="Avg Temp"
                  value={avg(chartData.temperature.map((d) => d.value))}
                  unit=" C"
                  color="#ffaa00"
                />
              </>
            ) : (
              <>
                <StatBox
                  label="Avg Utilization"
                  value={avg(chartData.utilization.map((d) => d.value))}
                  unit="%"
                  color="#00d4ff"
                />
                <StatBox
                  label="Avg Latency"
                  value={avg(chartData.latency.map((d) => d.value))}
                  unit="ms"
                  color="#ffaa00"
                />
                <StatBox
                  label="Max Latency"
                  value={max(chartData.latency.map((d) => d.value))}
                  unit="ms"
                  color="#ff4444"
                />
                <StatBox
                  label="Avg Throughput"
                  value={avg(chartData.throughput.map((d) => d.value))}
                  unit="Gbps"
                  color="#00ff88"
                />
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="glass-card p-3 text-center">
      <p className="text-[10px] text-noc-muted uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-xl font-bold" style={{ color }}>
        {value.toFixed(2)}
        <span className="text-xs text-noc-muted ml-1">{unit}</span>
      </p>
    </div>
  );
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function max(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values);
}
