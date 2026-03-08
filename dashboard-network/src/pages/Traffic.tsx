import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  Globe,
  Network,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import { useTrafficAnalytics } from '../hooks/useTelemetry';

// ── Constants ──────────────────────────────────────────────

const PROTOCOL_COLORS: Record<string, string> = {
  HTTPS: '#00d4ff',
  HTTP: '#00ff88',
  DNS: '#a855f7',
  SSH: '#ffaa00',
  Other: '#666666',
};

const DESTINATION_COLORS = [
  '#00d4ff',
  '#0099cc',
  '#00ff88',
  '#00cc6a',
  '#a855f7',
  '#666666',
];

// ── Custom Tooltips ────────────────────────────────────────

function PieTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="glass-card p-3 border border-noc-border/50 shadow-noc-glow-lg min-w-[120px]">
      <p className="text-xs text-noc-muted mb-1">{entry.name}</p>
      <p className="text-sm font-bold font-mono" style={{ color: entry.payload.fill }}>
        {(Number(entry.value) || 0).toFixed(2)} Gbps
      </p>
      <p className="text-[10px] text-noc-muted">
        {((entry.payload.percent || 0) * 100).toFixed(1)}%
      </p>
    </div>
  );
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 border border-noc-border/50 shadow-noc-glow-lg min-w-[120px]">
      <p className="text-xs text-noc-muted mb-1">{label}</p>
      <p className="text-sm font-bold font-mono text-noc-cyan">
        {(Number(payload[0].value) || 0).toFixed(2)} Gbps
      </p>
    </div>
  );
}

// ── Custom Pie Label (center donut text) ──────────────────

function renderCenterLabel(total: number) {
  return (
    <text
      x="50%"
      y="50%"
      textAnchor="middle"
      dominantBaseline="central"
    >
      <tspan
        x="50%"
        dy="-0.4em"
        fill="#00d4ff"
        fontSize="22"
        fontWeight="bold"
        fontFamily="monospace"
      >
        {total.toFixed(1)}
      </tspan>
      <tspan
        x="50%"
        dy="1.6em"
        fill="#94a3b8"
        fontSize="11"
      >
        Gbps Total
      </tspan>
    </text>
  );
}

// ── Custom Bar Label ──────────────────────────────────────

function renderBarLabel(props: any) {
  const { x, y, width, height, value } = props;
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      fill="#e2e8f0"
      fontSize={12}
      fontFamily="monospace"
      dominantBaseline="central"
    >
      {(value as number).toFixed(2)}
    </text>
  );
}

// ── Utilization Bar ───────────────────────────────────────

function UtilizationBar({ percent }: { percent: number }) {
  const color =
    percent >= 90 ? '#ff4444' : percent >= 70 ? '#ffaa00' : '#00ff88';
  return (
    <div className="w-full bg-noc-surface/50 rounded-full h-2 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(percent, 100)}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

// ── Main Traffic Page ─────────────────────────────────────

export default function Traffic() {
  const { analytics, loading, error } = useTrafficAnalytics(10000);

  // Prepare protocol breakdown data
  const protocolData = useMemo(() => {
    if (!analytics?.protocol_breakdown_gbps) return [];
    return Object.entries(analytics.protocol_breakdown_gbps)
      .map(([name, value]) => ({
        name,
        value,
        fill: PROTOCOL_COLORS[name] || PROTOCOL_COLORS.Other,
      }))
      .sort((a, b) => b.value - a.value);
  }, [analytics]);

  // Prepare destination breakdown data
  const destinationData = useMemo(() => {
    if (!analytics?.destination_breakdown_gbps) return [];
    return Object.entries(analytics.destination_breakdown_gbps)
      .map(([name, value], index) => ({
        name,
        value,
        fill: DESTINATION_COLORS[index % DESTINATION_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [analytics]);

  // Top 10 links by throughput
  const topLinks = useMemo(() => {
    if (!analytics?.link_traffic) return [];
    return [...analytics.link_traffic]
      .sort((a, b) => b.throughput_gbps - a.throughput_gbps)
      .slice(0, 10);
  }, [analytics]);

  const totalTraffic = analytics?.total_traffic_gbps ?? 0;

  // ── Loading State ──────────────────────────────────────

  if (loading && !analytics) {
    return (
      <div className="p-6 min-h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-noc-cyan animate-spin mx-auto mb-3" />
          <p className="text-sm text-noc-muted">Loading traffic analytics...</p>
        </div>
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────

  if (error && !analytics) {
    return (
      <div className="p-6 min-h-full flex items-center justify-center">
        <div className="glass-card p-8 text-center max-w-md">
          <AlertTriangle className="w-10 h-10 text-noc-red mx-auto mb-3" />
          <p className="text-sm text-noc-red mb-1">Failed to load traffic data</p>
          <p className="text-xs text-noc-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Traffic Analytics</h1>
          <p className="text-sm text-noc-muted mt-1">
            Protocol and destination traffic breakdown
          </p>
        </div>
        {analytics?.timestamp && (
          <span className="text-xs text-noc-muted font-mono">
            Last updated:{' '}
            {new Date(analytics.timestamp).toLocaleTimeString()}
          </span>
        )}
      </motion.div>

      {/* Headline: Total Traffic */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="glass-card p-6 flex items-center gap-5"
      >
        <div
          className="p-3 rounded-xl border"
          style={{
            backgroundColor: 'rgba(0,212,255,0.1)',
            borderColor: 'rgba(0,212,255,0.25)',
          }}
        >
          <Activity className="w-7 h-7 text-noc-cyan" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-noc-muted font-semibold mb-1">
            Total Network Traffic
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className="text-5xl font-black font-mono text-noc-cyan"
              style={{
                textShadow:
                  '0 0 20px rgba(0,212,255,0.4), 0 0 40px rgba(0,212,255,0.2)',
              }}
            >
              {totalTraffic.toFixed(2)}
            </span>
            <span className="text-lg text-noc-muted font-medium">Gbps</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-noc-green">
          <ArrowUpRight className="w-4 h-4" />
          <span className="text-xs font-medium">Live</span>
        </div>
      </motion.div>

      {/* Charts Grid: Protocol Pie + Destination Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Protocol Breakdown Pie Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-noc-cyan/10 border border-noc-cyan/20">
              <Globe className="w-4 h-4 text-noc-cyan" />
            </div>
            <h3 className="text-sm font-semibold text-noc-text">
              Protocol Breakdown
            </h3>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={protocolData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {protocolData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  {renderCenterLabel(totalTraffic)}
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Protocol Legend */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            {protocolData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="text-xs text-noc-muted flex-1 truncate">
                  {entry.name}
                </span>
                <span className="text-xs font-bold font-mono text-noc-text">
                  {(entry.value || 0).toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Destination Breakdown Bar Chart (horizontal) */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-noc-cyan/10 border border-noc-cyan/20">
              <Network className="w-4 h-4 text-noc-cyan" />
            </div>
            <h3 className="text-sm font-semibold text-noc-text">
              Top Destinations
            </h3>
          </div>

          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={destinationData}
                layout="vertical"
                margin={{ top: 5, right: 60, left: 5, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1e2560"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#1e2560' }}
                  tickLine={false}
                  tickFormatter={(val) => `${val}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#e2e8f0', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,212,255,0.05)' }} />
                <Bar
                  dataKey="value"
                  radius={[0, 4, 4, 0]}
                  label={renderBarLabel}
                  maxBarSize={28}
                >
                  {destinationData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Top Links by Throughput Table */}
      {topLinks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-noc-cyan/10 border border-noc-cyan/20">
              <Activity className="w-4 h-4 text-noc-cyan" />
            </div>
            <h3 className="text-sm font-semibold text-noc-text">
              Top Links by Throughput
            </h3>
            <span className="ml-auto text-xs text-noc-muted">
              Top {topLinks.length} of {analytics?.link_traffic?.length ?? 0}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-noc-border/30">
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-noc-muted font-semibold">
                    #
                  </th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-noc-muted font-semibold">
                    Link ID
                  </th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-noc-muted font-semibold">
                    Type
                  </th>
                  <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider text-noc-muted font-semibold">
                    Throughput
                  </th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-noc-muted font-semibold min-w-[180px]">
                    Utilization
                  </th>
                  <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider text-noc-muted font-semibold">
                    Util %
                  </th>
                </tr>
              </thead>
              <tbody>
                {topLinks.map((link, index) => (
                  <motion.tr
                    key={link.link_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 * index }}
                    className="border-b border-noc-border/10 hover:bg-noc-surface/30 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-noc-muted font-mono text-xs">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-3 text-noc-text font-medium">
                      {link.link_id}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          (link.type || '').toLowerCase() === 'backbone'
                            ? 'bg-noc-cyan/10 text-noc-cyan border border-noc-cyan/20'
                            : (link.type || '').toLowerCase() === 'peering'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-noc-surface/50 text-noc-muted border border-noc-border/20'
                        }`}
                      >
                        {link.type || 'unknown'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-mono font-bold text-noc-cyan">
                        {(link.throughput_gbps || 0).toFixed(2)}
                      </span>
                      <span className="text-noc-muted text-xs ml-1">Gbps</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <UtilizationBar percent={link.utilization_percent} />
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className="font-mono font-bold"
                        style={{
                          color:
                            link.utilization_percent >= 90
                              ? '#ff4444'
                              : link.utilization_percent >= 70
                              ? '#ffaa00'
                              : '#00ff88',
                        }}
                      >
                        {(link.utilization_percent || 0).toFixed(1)}%
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
