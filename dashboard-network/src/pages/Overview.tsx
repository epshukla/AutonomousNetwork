import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Cpu,
  Clock,
  Gauge,
  Server,
  Link2,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import MetricCard from '../components/common/MetricCard';
import HealthBadge from '../components/common/HealthBadge';
import { useOverview, useTopology, useWSTelemetry } from '../hooks/useTelemetry';

// ── Animated Health Gauge ──────────────────────────────────

function HealthGauge({ score, status }: { score: number; status: string }) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const offset = circumference - progress;

  const color =
    score >= 80 ? '#00ff88' : score >= 60 ? '#ffaa00' : '#ff4444';
  const glowFilter =
    score >= 80
      ? 'drop-shadow(0 0 12px rgba(0,255,136,0.5))'
      : score >= 60
      ? 'drop-shadow(0 0 12px rgba(255,170,0,0.5))'
      : 'drop-shadow(0 0 12px rgba(255,68,68,0.5))';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="glass-card p-8 flex flex-col items-center justify-center"
    >
      <h3 className="text-sm font-semibold text-noc-muted mb-4 uppercase tracking-wider">
        Network Health Score
      </h3>

      <div className="relative w-52 h-52">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 200 200"
        >
          {/* Background ring */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#1e2560"
            strokeWidth="10"
          />
          {/* Progress ring */}
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{ filter: glowFilter }}
          />
          {/* Inner decorative ring */}
          <circle
            cx="100"
            cy="100"
            r={radius - 15}
            fill="none"
            stroke="#1e2560"
            strokeWidth="1"
            strokeDasharray="3 6"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-5xl font-black tracking-tight"
            style={{
              color,
              textShadow: `0 0 20px ${color}50, 0 0 40px ${color}30`,
            }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-noc-muted font-medium mt-1">/ 100</span>
        </div>
      </div>

      <div className="mt-4">
        <HealthBadge status={status} size="lg" />
      </div>
    </motion.div>
  );
}

// ── Status Summary Ring ────────────────────────────────────

function StatusRing({
  title,
  healthy,
  degraded,
  critical,
  down,
  total,
  icon,
}: {
  title: string;
  healthy: number;
  degraded: number;
  critical: number;
  down: number;
  total: number;
  icon: React.ReactNode;
}) {
  const data = [
    { name: 'Healthy', value: healthy, color: '#00ff88' },
    { name: 'Degraded', value: degraded, color: '#ffaa00' },
    { name: 'Critical', value: critical, color: '#ff4444' },
    { name: 'Down', value: down, color: '#555555' },
  ].filter((d) => d.value > 0);

  // If all zero, show a placeholder
  if (data.length === 0) {
    data.push({ name: 'None', value: 1, color: '#1e2560' });
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-noc-cyan/10 border border-noc-cyan/20">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-noc-text">{title}</h3>
        <span className="ml-auto text-lg font-bold text-white">{total}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-20 h-20">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={38}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-1.5">
          {[
            { label: 'Healthy', value: healthy, color: 'bg-noc-green', text: 'text-noc-green' },
            { label: 'Degraded', value: degraded, color: 'bg-noc-amber', text: 'text-noc-amber' },
            { label: 'Critical', value: critical, color: 'bg-noc-red', text: 'text-noc-red' },
            { label: 'Down', value: down, color: 'bg-gray-500', text: 'text-gray-400' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${item.color}`} />
              <span className="text-xs text-noc-muted flex-1">
                {item.label}
              </span>
              <span className={`text-xs font-bold ${item.text}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Overview Page ─────────────────────────────────────

export default function Overview() {
  const { overview, overviewHistory } = useOverview(5000);
  const { devices, links } = useTopology(10000);
  const { latestTelemetry, telemetryHistory, isConnected } = useWSTelemetry(60);

  // Health score from overview API
  const healthScore = useMemo(() => {
    if (overview) {
      const score = Math.round(overview.health_score);
      const status =
        score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : score >= 30 ? 'critical' : 'down';
      return { score, status };
    }
    if (!devices.length) return { score: 0, status: 'down' };
    const healthyCount = devices.filter((d) => d.status === 'healthy').length;
    const score = Math.round((healthyCount / devices.length) * 100);
    const status =
      score >= 80 ? 'healthy' : score >= 60 ? 'degraded' : score >= 30 ? 'critical' : 'down';
    return { score, status };
  }, [overview, devices]);

  // Sparkline data from WS telemetry history
  const throughputHistory = useMemo(
    () =>
      telemetryHistory.slice(-30).map((snap) => {
        const vals = Object.values(snap.links || {});
        return vals.reduce((sum, l) => sum + (l.throughput_gbps || 0), 0);
      }),
    [telemetryHistory]
  );

  const latencyHistory = useMemo(
    () =>
      telemetryHistory.slice(-30).map((snap) => {
        const vals = Object.values(snap.links || {});
        if (vals.length === 0) return 0;
        return vals.reduce((sum, l) => sum + (l.latency_ms || 0), 0) / vals.length;
      }),
    [telemetryHistory]
  );

  const utilizationHistory = useMemo(
    () =>
      telemetryHistory.slice(-30).map((snap) => {
        const vals = Object.values(snap.links || {});
        if (vals.length === 0) return 0;
        return vals.reduce((sum, l) => sum + (l.utilization_percent || 0), 0) / vals.length;
      }),
    [telemetryHistory]
  );

  const cpuHistory = useMemo(
    () =>
      telemetryHistory.slice(-30).map((snap) => {
        const vals = Object.values(snap.devices || {});
        if (vals.length === 0) return 0;
        return vals.reduce((sum, d) => sum + (d.cpu_utilization || 0), 0) / vals.length;
      }),
    [telemetryHistory]
  );

  // Current aggregate values from overview API or fallback to topology
  const currentStats = useMemo(() => {
    if (overview) {
      const ds = overview.device_status || {};
      const ls = overview.link_status || {};
      return {
        totalThroughput: overview.total_throughput_gbps || 0,
        avgLatency: overview.avg_latency_ms || 0,
        avgUtilization: overview.avg_utilization_percent || 0,
        avgCpu: devices.length > 0
          ? devices.reduce((s, d) => s + (d.cpu_utilization || 0), 0) / devices.length
          : 0,
        activeAlerts: (ds.critical || 0) + (ds.down || 0) + (ls.down || 0),
        healthyDevices: ds.healthy || 0,
        degradedDevices: ds.degraded || 0,
        criticalDevices: ds.critical || 0,
        downDevices: ds.down || 0,
        // Link statuses: up/degraded/down
        healthyLinks: ls.up || 0,
        degradedLinks: ls.degraded || 0,
        criticalLinks: 0,
        downLinks: ls.down || 0,
      };
    }

    // Fallback: compute from topology data
    const dStatusCounts = { healthy: 0, degraded: 0, critical: 0, down: 0 };
    devices.forEach((d) => {
      if (d.status in dStatusCounts) dStatusCounts[d.status as keyof typeof dStatusCounts]++;
    });
    const lStatusCounts = { up: 0, degraded: 0, down: 0 };
    links.forEach((l) => {
      if (l.status in lStatusCounts) lStatusCounts[l.status as keyof typeof lStatusCounts]++;
    });

    return {
      totalThroughput: links.reduce((s, l) => s + (l.throughput_gbps || 0), 0),
      avgLatency:
        links.length > 0
          ? links.reduce((s, l) => s + (l.latency_ms || 0), 0) / links.length
          : 0,
      avgUtilization:
        links.length > 0
          ? links.reduce((s, l) => s + (l.utilization_percent || 0), 0) / links.length
          : 0,
      avgCpu:
        devices.length > 0
          ? devices.reduce((s, d) => s + (d.cpu_utilization || 0), 0) / devices.length
          : 0,
      activeAlerts: dStatusCounts.critical + dStatusCounts.down + lStatusCounts.down,
      healthyDevices: dStatusCounts.healthy,
      degradedDevices: dStatusCounts.degraded,
      criticalDevices: dStatusCounts.critical,
      downDevices: dStatusCounts.down,
      healthyLinks: lStatusCounts.up,
      degradedLinks: lStatusCounts.degraded,
      criticalLinks: 0,
      downLinks: lStatusCounts.down,
    };
  }, [overview, devices, links]);

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Network Overview</h1>
          <p className="text-sm text-noc-muted mt-1">
            Real-time monitoring dashboard
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
              isConnected
                ? 'bg-noc-green/10 border-noc-green/30 text-noc-green'
                : 'bg-noc-red/10 border-noc-red/30 text-noc-red'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-noc-green animate-pulse-glow' : 'bg-noc-red'
              }`}
            />
            {isConnected ? 'Live' : 'Polling'}
          </div>
          <span className="text-xs text-noc-muted font-mono">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Top section: Health Gauge + Metric Cards */}
      <div className="grid grid-cols-12 gap-6">
        {/* Health Gauge */}
        <div className="col-span-4">
          <HealthGauge score={healthScore.score} status={healthScore.status} />
        </div>

        {/* Key Metrics */}
        <div className="col-span-8 grid grid-cols-2 gap-4">
          <MetricCard
            label="Total Throughput"
            value={(currentStats.totalThroughput || 0).toFixed(1)}
            unit="Gbps"
            color="cyan"
            icon={<Zap className="w-4 h-4" />}
            sparklineData={throughputHistory}
            trend={throughputHistory.length > 1 ? (throughputHistory[throughputHistory.length - 1] >= throughputHistory[throughputHistory.length - 2] ? 'up' : 'down') : 'stable'}
            delay={0.1}
          />
          <MetricCard
            label="Avg Latency"
            value={(currentStats.avgLatency || 0).toFixed(1)}
            unit="ms"
            color="amber"
            icon={<Clock className="w-4 h-4" />}
            sparklineData={latencyHistory}
            trend={latencyHistory.length > 1 ? (latencyHistory[latencyHistory.length - 1] <= latencyHistory[latencyHistory.length - 2] ? 'up' : 'down') : 'stable'}
            delay={0.2}
          />
          <MetricCard
            label="Avg Utilization"
            value={(currentStats.avgUtilization || 0).toFixed(1)}
            unit="%"
            color="green"
            icon={<Activity className="w-4 h-4" />}
            sparklineData={utilizationHistory}
            delay={0.3}
          />
          <MetricCard
            label="Active Alerts"
            value={currentStats.activeAlerts}
            color={currentStats.activeAlerts > 0 ? 'red' : 'green'}
            icon={<AlertTriangle className="w-4 h-4" />}
            delay={0.4}
          />
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-6">
          <StatusRing
            title="Devices"
            icon={<Server className="w-4 h-4 text-noc-cyan" />}
            healthy={currentStats.healthyDevices}
            degraded={currentStats.degradedDevices}
            critical={currentStats.criticalDevices}
            down={currentStats.downDevices}
            total={overview?.device_count || devices.length}
          />
        </div>
        <div className="col-span-6">
          <StatusRing
            title="Links"
            icon={<Link2 className="w-4 h-4 text-noc-cyan" />}
            healthy={currentStats.healthyLinks}
            degraded={currentStats.degradedLinks}
            critical={currentStats.criticalLinks}
            down={currentStats.downLinks}
            total={overview?.link_count || links.length}
          />
        </div>
      </div>

      {/* Backbone Status */}
      <div>
        <h2 className="text-sm font-semibold text-noc-muted uppercase tracking-wider mb-3">Backbone Status</h2>
        <div className="grid grid-cols-2 gap-4">
          {links
            .filter((l) => l.type === 'fiber_backbone')
            .map((l) => (
              <motion.div
                key={l.link_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-noc-text">{l.link_id}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    l.status === 'up' ? 'bg-noc-green/10 text-noc-green border border-noc-green/30' :
                    l.status === 'degraded' ? 'bg-noc-amber/10 text-noc-amber border border-noc-amber/30' :
                    'bg-noc-red/10 text-noc-red border border-noc-red/30'
                  }`}>{l.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-noc-muted">Util</p>
                    <p className="text-sm font-mono font-bold text-noc-cyan">{(l.utilization_percent || 0).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-noc-muted">Latency</p>
                    <p className="text-sm font-mono font-bold text-noc-amber">{(l.latency_ms || 0).toFixed(1)} ms</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-noc-muted">Throughput</p>
                    <p className="text-sm font-mono font-bold text-noc-green">{(l.throughput_gbps || 0).toFixed(1)} G</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-noc-bg/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      l.utilization_percent > 90 ? 'bg-noc-red' : l.utilization_percent > 70 ? 'bg-noc-amber' : 'bg-noc-cyan'
                    }`}
                    style={{ width: `${Math.min(l.utilization_percent, 100)}%` }}
                  />
                </div>
              </motion.div>
            ))}
        </div>
      </div>

      {/* Per-City Health Cards */}
      <div>
        <h2 className="text-sm font-semibold text-noc-muted uppercase tracking-wider mb-3">City Health</h2>
        <div className="grid grid-cols-2 gap-4">
          {['delhi', 'mumbai'].map((city) => {
            const cityDevices = devices.filter((d) => d.city === city);
            const healthyCount = cityDevices.filter((d) => d.status === 'healthy').length;
            const avgCpu = cityDevices.length > 0
              ? cityDevices.reduce((s, d) => s + (d.cpu_utilization || 0), 0) / cityDevices.length
              : 0;
            const totalSubs = cityDevices.reduce((s, d) => s + (d.subscribers || 0), 0);
            const peeringDevice = cityDevices.find((d) => d.type === 'peering_router');

            return (
              <motion.div
                key={city}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white capitalize">{city}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    healthyCount === cityDevices.length ? 'bg-noc-green/10 text-noc-green border border-noc-green/30' :
                    healthyCount > cityDevices.length / 2 ? 'bg-noc-amber/10 text-noc-amber border border-noc-amber/30' :
                    'bg-noc-red/10 text-noc-red border border-noc-red/30'
                  }`}>
                    {healthyCount}/{cityDevices.length} healthy
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[10px] text-noc-muted">Avg CPU</p>
                    <p className="text-lg font-mono font-bold text-noc-cyan">{avgCpu.toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-noc-muted">Subscribers</p>
                    <p className="text-lg font-mono font-bold text-noc-green">{totalSubs > 0 ? `${(totalSubs / 1000).toFixed(0)}K` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-noc-muted">Peering</p>
                    <p className={`text-lg font-mono font-bold ${
                      peeringDevice?.status === 'healthy' ? 'text-noc-green' : 'text-noc-red'
                    }`}>{peeringDevice?.peer_name || '—'}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom sparkline area: CPU + Throughput wide charts */}
      <div className="grid grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-noc-purple" />
              <span className="text-sm font-semibold text-noc-text">
                Avg CPU Usage
              </span>
            </div>
            <span className="text-lg font-bold text-noc-purple">
              {(currentStats.avgCpu || 0).toFixed(1)}%
            </span>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cpuHistory.map((v, i) => ({ v, i }))}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fill="url(#cpuGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-noc-cyan" />
              <span className="text-sm font-semibold text-noc-text">
                Throughput Trend
              </span>
            </div>
            <span className="text-lg font-bold glow-text-cyan">
              {(currentStats.totalThroughput || 0).toFixed(1)} Gbps
            </span>
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={throughputHistory.map((v, i) => ({ v, i }))}>
                <defs>
                  <linearGradient id="tpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  fill="url(#tpGrad)"
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
