import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ShieldCheck,
  Activity,
  Zap,
  TrendingDown,
  Server,
  Wifi,
} from 'lucide-react';
import MetricCard from '../components/common/MetricCard';
import HealthBadge from '../components/common/HealthBadge';
import AgentStatusCard from '../components/agent/AgentStatus';
import DecisionFeed from '../components/agent/DecisionFeed';
import { useIncidents } from '../hooks/useIncidents';
import { getPendingApprovals, getNetworkHealth, getAgentMetrics, PendingApproval, NetworkHealth, AgentMetrics } from '../api/agent';

export default function CommandCenter() {
  const { activeIncidents, severityCounts } = useIncidents();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [health, setHealth] = useState<NetworkHealth | null>(null);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [a, h, m] = await Promise.all([
        getPendingApprovals(),
        getNetworkHealth(),
        getAgentMetrics(),
      ]);
      setApprovals(a);
      setHealth(h);
      setMetrics(m);
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const criticalApprovals = approvals.filter((a) => a.urgency === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Incidents"
          value={activeIncidents.length}
          subtitle={`${severityCounts.critical} critical, ${severityCounts.high} high`}
          icon={AlertTriangle}
          color={severityCounts.critical > 0 ? 'red' : severityCounts.high > 0 ? 'amber' : 'green'}
          glowing={severityCounts.critical > 0}
        />
        <MetricCard
          title="Pending Approvals"
          value={approvals.length}
          subtitle={criticalApprovals > 0 ? `${criticalApprovals} critical urgency` : 'No critical'}
          icon={ShieldCheck}
          color={criticalApprovals > 0 ? 'amber' : 'cyan'}
          glowing={criticalApprovals > 0}
        />
        <MetricCard
          title="Decision Success Rate"
          value={metrics ? `${Math.round(metrics.decision_success_rate * 100)}%` : '--'}
          subtitle={metrics ? `${metrics.total_decisions} total decisions` : ''}
          icon={Zap}
          color="green"
          trend="up"
          trendValue="2.3%"
        />
        <MetricCard
          title="Mean Time to Resolve"
          value={metrics ? `${Math.round(metrics.mttr_seconds / 60)}m` : '--'}
          subtitle="Average resolution time"
          icon={TrendingDown}
          color="cyan"
          trend="down"
          trendValue="15%"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Agent Status + Network Health */}
        <div className="space-y-6">
          <AgentStatusCard />

          {/* Network Health Gauge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider mb-4 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-noc-cyan" />
              Network Health
            </h3>
            <div className="flex items-center justify-center mb-4">
              <HealthBadge score={health?.overall_score || 0} size="lg" />
            </div>
            {health && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="text-center p-2 rounded-lg bg-noc-bg/40">
                  <div className="text-lg font-bold text-noc-green">{health.healthy_count}</div>
                  <div className="text-[10px] text-noc-muted uppercase">Healthy</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-noc-bg/40">
                  <div className="text-lg font-bold text-noc-amber">{health.warning_count}</div>
                  <div className="text-[10px] text-noc-muted uppercase">Warning</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-noc-bg/40">
                  <div className="text-lg font-bold text-noc-red">{health.critical_count}</div>
                  <div className="text-[10px] text-noc-muted uppercase">Critical</div>
                </div>
              </div>
            )}

            {health && (
              <div className="mt-4 space-y-2">
                <HealthBar label="CPU" value={health.metrics.cpu_avg} />
                <HealthBar label="Memory" value={health.metrics.memory_avg} />
                <HealthBar label="Bandwidth" value={health.metrics.bandwidth_utilization} />
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-noc-muted">Packet Loss</span>
                  <span className={`font-mono ${health.metrics.packet_loss > 0.05 ? 'text-noc-red' : 'text-noc-green'}`}>
                    {(health.metrics.packet_loss * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-noc-muted">Avg Latency</span>
                  <span className="text-noc-text font-mono">{health.metrics.latency_avg}ms</span>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Middle Column: Active Incidents Summary */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-5"
          >
            <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-noc-red" />
              Active Incidents
            </h3>

            {/* Severity Breakdown */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                const colors = {
                  critical: 'text-noc-red bg-noc-red/10 border-noc-red/20',
                  high: 'text-noc-amber bg-noc-amber/10 border-noc-amber/20',
                  medium: 'text-noc-cyan bg-noc-cyan/10 border-noc-cyan/20',
                  low: 'text-noc-muted bg-noc-surface border-noc-border/20',
                };
                return (
                  <div
                    key={sev}
                    className={`text-center p-2 rounded-lg border ${colors[sev]}`}
                  >
                    <div className="text-xl font-bold">{severityCounts[sev]}</div>
                    <div className="text-[10px] uppercase font-semibold">{sev}</div>
                  </div>
                );
              })}
            </div>

            {/* Incident List */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {activeIncidents.map((incident) => {
                const sevColor = {
                  critical: 'border-l-noc-red bg-noc-red/5',
                  high: 'border-l-noc-amber bg-noc-amber/5',
                  medium: 'border-l-noc-cyan bg-noc-cyan/5',
                  low: 'border-l-noc-muted bg-noc-bg/40',
                };
                return (
                  <motion.div
                    key={incident.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg border-l-2 ${sevColor[incident.severity]}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-noc-text">{incident.title}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-mono text-noc-cyan">{incident.id}</span>
                      <span className={`text-xs font-semibold ${
                        incident.status === 'mitigating' ? 'text-noc-amber'
                        : incident.status === 'analyzing' ? 'text-noc-cyan'
                        : incident.status === 'escalated' ? 'text-noc-purple'
                        : 'text-noc-muted'
                      }`}>
                        {incident.status}
                      </span>
                      <span className="text-xs text-noc-muted">
                        {incident.affected_devices.join(', ')}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
              {activeIncidents.length === 0 && (
                <div className="text-center py-8 text-noc-muted text-sm">
                  No active incidents. All systems operational.
                </div>
              )}
            </div>
          </motion.div>

          {/* Pending Approvals Summary */}
          {approvals.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card p-5 border border-noc-amber/20 glow-amber"
            >
              <h3 className="text-sm font-bold text-noc-amber uppercase tracking-wider mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Awaiting Approval
              </h3>
              <div className="space-y-2">
                {approvals.slice(0, 3).map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-noc-bg/40 border border-noc-border/20"
                  >
                    <div>
                      <div className="text-sm text-noc-text font-medium">
                        {(approval.action_type || '').replace(/_/g, ' ')}
                      </div>
                      <div className="text-xs text-noc-muted">{approval.incident_title}</div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        approval.urgency === 'critical'
                          ? 'text-noc-red bg-noc-red/10'
                          : 'text-noc-amber bg-noc-amber/10'
                      }`}
                    >
                      {approval.urgency}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column: Decision Feed */}
        <div>
          <DecisionFeed limit={10} />
        </div>
      </div>
    </div>
  );
}

function HealthBar({ label, value }: { label: string; value: number }) {
  const getColor = (v: number) => {
    if (v < 60) return 'bg-noc-green';
    if (v < 80) return 'bg-noc-amber';
    return 'bg-noc-red';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-noc-muted">{label}</span>
        <span className="text-noc-text font-mono">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-noc-border/30 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1 }}
          className={`h-full rounded-full ${getColor(value)}`}
        />
      </div>
    </div>
  );
}
