import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Gauge,
  Timer,
  Wifi,
  AlertTriangle,
  Heart,
  Server,
  Link2,
} from 'lucide-react';
import { useChaos } from '../hooks/useChaos';
import { useImpact } from '../hooks/useImpact';
import { SCENARIOS } from '../api/chaos';
import MetricCard from '../components/common/MetricCard';
import HealthBadge from '../components/common/HealthBadge';
import StatusDot from '../components/common/StatusDot';
import MetricImpact from '../components/impact/MetricImpact';
import AgentResponse from '../components/impact/AgentResponse';

const ImpactView: React.FC = () => {
  const { activeScenarios, agentStatus } = useChaos();
  const {
    currentMetrics,
    metricsHistory,
    baselineMetrics,
    incidents,
    getDeviation,
    getMetricStatus,
  } = useImpact();

  const [elapsedTimers, setElapsedTimers] = useState<Record<string, number>>({});

  const activeScenariosRef = useRef(activeScenarios);
  activeScenariosRef.current = activeScenarios;

  useEffect(() => {
    const interval = setInterval(() => {
      const timers: Record<string, number> = {};
      activeScenariosRef.current.forEach((s) => {
        const startTime = new Date(s.started_at).getTime();
        timers[s.scenario_name] = Math.floor((Date.now() - startTime) / 1000);
      });
      setElapsedTimers(timers);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTimer = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const hasActiveScenario = activeScenarios.length > 0;

  return (
    <div className="space-y-6">
      {/* Active chaos banner */}
      {hasActiveScenario && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 border-red-400/30"
          style={{ animation: 'pulseRed 3s ease-in-out infinite' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-400" />
              <span className="text-sm font-bold text-red-400 uppercase tracking-wider">
                Chaos Active
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {activeScenarios.map((s) => {
                const meta = SCENARIOS.find((sc) => sc.name === s.scenario_name);
                return (
                  <div key={s.scenario_name} className="flex items-center gap-2">
                    <StatusDot status="running" size="sm" label="" />
                    <span className="text-sm font-semibold text-noc-text">
                      {meta?.display_name || s.scenario_name}
                    </span>
                    <span className="text-lg font-mono font-bold text-red-400 tabular-nums">
                      {formatTimer(elapsedTimers[s.scenario_name] || 0)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-noc-muted">Agent:</span>
              <StatusDot status={agentStatus.status} size="sm" />
            </div>
          </div>
        </motion.div>
      )}

      {/* Header with health badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20">
            <Activity size={24} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-noc-text">Impact View</h1>
            <p className="text-sm text-noc-muted">
              Real-time network impact monitoring
            </p>
          </div>
        </div>
        {currentMetrics && <HealthBadge score={currentMetrics.health_score} size="lg" />}
      </div>

      {/* Top metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Health Score"
          value={currentMetrics?.health_score ?? 100}
          unit="%"
          icon={<Heart size={16} />}
          status={getMetricStatus('health_score')}
          deviation={getDeviation('health_score')}
        />
        <MetricCard
          label="Avg Utilization"
          value={currentMetrics?.avg_utilization_percent ?? 0}
          unit="%"
          icon={<Gauge size={16} />}
          status={getMetricStatus('avg_utilization_percent')}
          deviation={getDeviation('avg_utilization_percent')}
        />
        <MetricCard
          label="Avg Latency"
          value={currentMetrics?.avg_latency_ms ?? 0}
          unit="ms"
          icon={<Timer size={16} />}
          status={getMetricStatus('avg_latency_ms')}
          deviation={getDeviation('avg_latency_ms')}
        />
        <MetricCard
          label="Throughput"
          value={currentMetrics?.total_throughput_gbps ?? 0}
          unit="Gbps"
          icon={<Wifi size={16} />}
          status={getMetricStatus('total_throughput_gbps')}
          deviation={getDeviation('total_throughput_gbps')}
        />
        <MetricCard
          label="Devices"
          value={currentMetrics ? `${currentMetrics.device_status?.healthy ?? 0}/${currentMetrics.device_count}` : '--'}
          icon={<Server size={16} />}
          status={currentMetrics && (currentMetrics.device_status?.healthy ?? 0) < currentMetrics.device_count ? 'critical' : 'normal'}
        />
        <MetricCard
          label="Links"
          value={currentMetrics ? `${currentMetrics.link_status?.up ?? 0}/${currentMetrics.link_count}` : '--'}
          icon={<Link2 size={16} />}
          status={currentMetrics && (currentMetrics.link_status?.up ?? 0) < currentMetrics.link_count ? 'degraded' : 'normal'}
        />
      </div>

      {/* Main split view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Network metrics charts */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-noc-muted flex items-center gap-2">
            <Gauge size={14} />
            Network Metrics
          </h2>

          <MetricImpact
            title="Health Score"
            metricKey="health_score"
            data={metricsHistory}
            baseline={baselineMetrics?.health_score}
            unit="%"
            color="#00ff88"
            invertDanger
            height={180}
          />

          <MetricImpact
            title="Average Utilization"
            metricKey="avg_utilization_percent"
            data={metricsHistory}
            baseline={baselineMetrics?.avg_utilization_percent}
            unit="%"
            color="#00d4ff"
            height={160}
          />

          <MetricImpact
            title="Average Latency"
            metricKey="avg_latency_ms"
            data={metricsHistory}
            baseline={baselineMetrics?.avg_latency_ms}
            unit="ms"
            color="#ffaa00"
            height={160}
          />

          <MetricImpact
            title="Total Throughput"
            metricKey="total_throughput_gbps"
            data={metricsHistory}
            baseline={baselineMetrics?.total_throughput_gbps}
            unit="Gbps"
            color="#ff4444"
            height={160}
          />
        </div>

        {/* Right: Agent response */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-noc-muted flex items-center gap-2">
            <Activity size={14} />
            AI Agent Response
          </h2>

          {/* Agent status card */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-noc-muted">Agent Status</span>
              <StatusDot status={agentStatus.status} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-noc-muted">Active Incidents</span>
                <p className={`text-lg font-bold font-mono ${agentStatus.active_incidents > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {agentStatus.active_incidents}
                </p>
              </div>
              <div>
                <span className="text-xs text-noc-muted">Health Assessment</span>
                <p className="text-lg font-bold font-mono text-cyan-400">
                  {agentStatus.health_score}%
                </p>
              </div>
              {agentStatus.last_action && (
                <div className="col-span-2">
                  <span className="text-xs text-noc-muted">Last Action</span>
                  <p className="text-xs text-noc-text font-mono mt-0.5 truncate">{agentStatus.last_action}</p>
                </div>
              )}
            </div>
          </div>

          {/* Agent response timeline */}
          <AgentResponse incidents={incidents} />

          {/* No active chaos info */}
          {!hasActiveScenario && incidents.length === 0 && (
            <div className="glass-card p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center mx-auto mb-4">
                <Heart size={28} className="text-emerald-400" />
              </div>
              <p className="text-noc-text font-semibold">Network is Stable</p>
              <p className="text-sm text-noc-muted mt-1">
                Launch a chaos scenario to observe network impact and agent response
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImpactView;
