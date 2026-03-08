import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Cpu, HardDrive, Activity, Radio, Network } from 'lucide-react';

import { useTopology, useWSTelemetry } from '../hooks/useTelemetry';
import type { WSTelemetryPayload } from '../api/simulator';

// ── Constants ─────────────────────────────────────────────

const TIME_RANGES = [
  { label: '5m', points: 60 },
  { label: '15m', points: 180 },
  { label: '30m', points: 360 },
  { label: '1h', points: 720 },
] as const;

const DEVICE_TYPE_COLORS: Record<string, string> = {
  core_router: '#00d4ff',
  edge_router: '#00ff88',
  aggregation_router: '#a855f7',
  peering_router: '#ffaa00',
  olt: '#ff6b6b',
};

const MEMORY_TYPE_COLORS: Record<string, string> = {
  core_router: '#38bdf8',
  edge_router: '#34d399',
  aggregation_router: '#c084fc',
  peering_router: '#fbbf24',
  olt: '#f87171',
};

const LINK_COLORS = [
  '#00d4ff', '#00ff88', '#a855f7', '#ffaa00', '#ff6b6b',
  '#38bdf8', '#34d399', '#c084fc', '#fbbf24', '#f87171',
  '#06b6d4', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
];

// ── Time formatter ────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch {
    return iso.slice(-8);
  }
}

// ── Custom Tooltip ────────────────────────────────────────

function MetricsTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="glass-card p-3 border border-noc-border/50 shadow-noc-glow-lg max-w-xs">
      <p className="text-[10px] text-noc-muted font-mono mb-2">{label}</p>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {payload
          .filter((p: any) => p.value != null)
          .map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color || p.stroke }}
              />
              <span className="text-noc-muted truncate">{p.dataKey}</span>
              <span className="font-mono font-bold ml-auto" style={{ color: p.color || p.stroke }}>
                {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Chart Section Wrapper ─────────────────────────────────

interface ChartSectionProps {
  title: string;
  icon: React.ReactNode;
  delay?: number;
  children: React.ReactNode;
}

function ChartSection({ title, icon, delay = 0, children }: ChartSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-noc-text">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

// ── Main Metrics Page ─────────────────────────────────────

export default function Metrics() {
  const { devices, links } = useTopology(15000);
  const { telemetryHistory, isConnected } = useWSTelemetry(720);

  const [timeRange, setTimeRange] = useState<string>('5m');
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const rangeConfig = TIME_RANGES.find((r) => r.label === timeRange) || TIME_RANGES[0];
  const slicedHistory = useMemo(
    () => telemetryHistory.slice(-rangeConfig.points),
    [telemetryHistory, rangeConfig.points],
  );

  // Build device ID -> type map
  const deviceTypeMap = useMemo(() => {
    const map: Record<string, string> = {};
    devices.forEach((d) => {
      map[d.device_id] = d.type || 'unknown';
    });
    return map;
  }, [devices]);

  const deviceIds = useMemo(() => devices.map((d) => d.device_id), [devices]);
  const linkIds = useMemo(() => links.map((l) => l.link_id), [links]);

  // Toggle legend series visibility
  const handleLegendClick = useCallback((dataKey: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  }, []);

  // ── CPU chart data ────────────────────────────────────
  const cpuData = useMemo(() => {
    return slicedHistory.map((snap: WSTelemetryPayload) => {
      const point: Record<string, any> = { time: formatTime(snap.timestamp) };
      deviceIds.forEach((id) => {
        point[id] = snap.devices?.[id]?.cpu_utilization ?? null;
      });
      return point;
    });
  }, [slicedHistory, deviceIds]);

  // ── Memory chart data ─────────────────────────────────
  const memoryData = useMemo(() => {
    return slicedHistory.map((snap: WSTelemetryPayload) => {
      const point: Record<string, any> = { time: formatTime(snap.timestamp) };
      deviceIds.forEach((id) => {
        point[id] = snap.devices?.[id]?.memory_utilization ?? null;
      });
      return point;
    });
  }, [slicedHistory, deviceIds]);

  // ── Link utilization chart data ───────────────────────
  const linkUtilData = useMemo(() => {
    return slicedHistory.map((snap: WSTelemetryPayload) => {
      const point: Record<string, any> = { time: formatTime(snap.timestamp) };
      linkIds.forEach((id) => {
        point[id] = snap.links?.[id]?.utilization_percent ?? null;
      });
      return point;
    });
  }, [slicedHistory, linkIds]);

  // ── Latency + Packet Loss chart data ──────────────────
  const latencyPktData = useMemo(() => {
    return slicedHistory.map((snap: WSTelemetryPayload) => {
      const point: Record<string, any> = { time: formatTime(snap.timestamp) };
      linkIds.forEach((id) => {
        point[`lat_${id}`] = snap.links?.[id]?.latency_ms ?? null;
        point[`pkt_${id}`] = snap.links?.[id]?.packet_loss_percent ?? null;
      });
      return point;
    });
  }, [slicedHistory, linkIds]);

  // Custom legend renderer with clickable items
  const renderLegend = useCallback(
    (props: any) => {
      const { payload } = props;
      if (!payload) return null;
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-2">
          {payload.map((entry: any, index: number) => {
            const isHidden = hiddenSeries.has(entry.dataKey);
            return (
              <button
                key={index}
                onClick={() => handleLegendClick(entry.dataKey)}
                className={`flex items-center gap-1 text-[10px] font-mono transition-opacity ${
                  isHidden ? 'opacity-30' : 'opacity-100'
                } hover:opacity-80`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-noc-muted">
                  {(entry.dataKey as string).replace('lat_', '').replace('pkt_', '')}
                </span>
              </button>
            );
          })}
        </div>
      );
    },
    [hiddenSeries, handleLegendClick],
  );

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Metrics</h1>
          <p className="text-sm text-noc-muted mt-1">
            Historical performance metrics across all devices and links
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <Radio
              className={`w-4 h-4 ${
                isConnected ? 'text-noc-green animate-pulse-glow' : 'text-noc-muted'
              }`}
            />
            <span
              className={`text-xs font-medium font-mono ${
                isConnected ? 'text-noc-green' : 'text-noc-muted'
              }`}
            >
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
            <span className="text-[10px] text-noc-muted font-mono">
              ({slicedHistory.length} pts)
            </span>
          </div>
        </div>
      </motion.div>

      {/* Time Range Selector */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="glass-card p-4"
      >
        <div className="flex items-center gap-4">
          <span className="text-[10px] uppercase tracking-wider text-noc-muted font-semibold">
            Time Range
          </span>
          <div className="flex rounded-lg overflow-hidden border border-noc-border/50">
            {TIME_RANGES.map((range) => (
              <button
                key={range.label}
                onClick={() => setTimeRange(range.label)}
                className={`px-4 py-2 text-xs font-medium font-mono transition-colors border-r border-noc-border/50 last:border-r-0 ${
                  timeRange === range.label
                    ? 'bg-noc-cyan/20 text-noc-cyan'
                    : 'bg-noc-surface/30 text-noc-muted hover:text-noc-text'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-noc-muted font-mono ml-auto">
            {deviceIds.length} devices &middot; {linkIds.length} links
          </span>
        </div>
      </motion.div>

      {/* ── Chart 1: CPU per Device ─────────────────────── */}
      <ChartSection
        title="CPU Utilization by Device"
        icon={<Cpu className="w-4 h-4 text-noc-cyan" />}
        delay={0.15}
      >
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={cpuData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2560" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#1e2560' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<MetricsTooltip />} />
            <Legend content={renderLegend} />
            {deviceIds.map((id) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={DEVICE_TYPE_COLORS[deviceTypeMap[id]] || '#94a3b8'}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 1 }}
                hide={hiddenSeries.has(id)}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* ── Chart 2: Memory per Device ──────────────────── */}
      <ChartSection
        title="Memory Utilization by Device"
        icon={<HardDrive className="w-4 h-4 text-[#38bdf8]" />}
        delay={0.2}
      >
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={memoryData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2560" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#1e2560' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<MetricsTooltip />} />
            <Legend content={renderLegend} />
            {deviceIds.map((id) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={MEMORY_TYPE_COLORS[deviceTypeMap[id]] || '#94a3b8'}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 1 }}
                hide={hiddenSeries.has(id)}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* ── Chart 3: Link Utilization ───────────────────── */}
      <ChartSection
        title="Link Utilization"
        icon={<Network className="w-4 h-4 text-noc-green" />}
        delay={0.25}
      >
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={linkUtilData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2560" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#1e2560' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<MetricsTooltip />} />
            <Legend content={renderLegend} />
            <ReferenceLine
              y={75}
              stroke="#ffaa00"
              strokeDasharray="6 3"
              label={{ value: '75%', position: 'right', fill: '#ffaa00', fontSize: 10 }}
            />
            <ReferenceLine
              y={90}
              stroke="#ff4444"
              strokeDasharray="6 3"
              label={{ value: '90%', position: 'right', fill: '#ff4444', fontSize: 10 }}
            />
            {linkIds.map((id, i) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={LINK_COLORS[i % LINK_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 1 }}
                hide={hiddenSeries.has(id)}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </ChartSection>

      {/* ── Chart 4: Latency + Packet Loss (Dual Y-Axis) ─ */}
      <ChartSection
        title="Latency & Packet Loss"
        icon={<Activity className="w-4 h-4 text-noc-amber" />}
        delay={0.3}
      >
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={latencyPktData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2560" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={{ stroke: '#1e2560' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="latency"
              orientation="left"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}ms`}
              label={{
                value: 'Latency (ms)',
                angle: -90,
                position: 'insideLeft',
                fill: '#94a3b8',
                fontSize: 10,
                offset: 15,
              }}
            />
            <YAxis
              yAxisId="pktloss"
              orientation="right"
              domain={[0, 'auto']}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: 'Pkt Loss (%)',
                angle: 90,
                position: 'insideRight',
                fill: '#94a3b8',
                fontSize: 10,
                offset: 15,
              }}
            />
            <Tooltip content={<MetricsTooltip />} />
            <Legend content={renderLegend} />
            {linkIds.map((id, i) => (
              <Line
                key={`lat_${id}`}
                yAxisId="latency"
                type="monotone"
                dataKey={`lat_${id}`}
                name={`lat_${id}`}
                stroke={LINK_COLORS[i % LINK_COLORS.length]}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 1 }}
                hide={hiddenSeries.has(`lat_${id}`)}
                connectNulls
              />
            ))}
            {linkIds.map((id, i) => (
              <Bar
                key={`pkt_${id}`}
                yAxisId="pktloss"
                dataKey={`pkt_${id}`}
                name={`pkt_${id}`}
                fill={LINK_COLORS[i % LINK_COLORS.length]}
                fillOpacity={0.35}
                hide={hiddenSeries.has(`pkt_${id}`)}
                barSize={3}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartSection>
    </div>
  );
}
