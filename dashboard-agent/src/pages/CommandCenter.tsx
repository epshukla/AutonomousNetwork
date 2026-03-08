import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ShieldCheck,
  Zap,
  Activity,
  Server,
} from 'lucide-react';
import MetricCard from '../components/common/MetricCard';
import HealthBadge from '../components/common/HealthBadge';
import DecisionFeed from '../components/agent/DecisionFeed';
import DeviceCPUChart from '../components/charts/DeviceCPUChart';
import DeviceMemoryChart from '../components/charts/DeviceMemoryChart';
import LinkUtilizationBar from '../components/charts/LinkUtilizationBar';
import LatencyLossChart from '../components/charts/LatencyLossChart';
import DeviceDrilldown from '../components/panels/DeviceDrilldown';
import { useLiveTelemetry } from '../hooks/useLiveTelemetry';
import { useIncidents } from '../hooks/useIncidents';
import {
  getPendingApprovals,
  getNetworkHealth,
  getAgentMetrics,
  getAgentStatus,
  type PendingApproval,
  type NetworkHealth,
  type AgentMetrics,
  type AgentStatus,
} from '../api/agent';

export default function CommandCenter() {
  const { activeIncidents, severityCounts } = useIncidents();
  const { links, deviceTimeseries } = useLiveTelemetry();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [health, setHealth] = useState<NetworkHealth | null>(null);
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [drilldown, setDrilldown] = useState<{ type: 'device' | 'link'; id: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [a, h, m, s] = await Promise.all([
        getPendingApprovals(),
        getNetworkHealth(),
        getAgentMetrics(),
        getAgentStatus(),
      ]);
      setApprovals(a);
      setHealth(h);
      setMetrics(m);
      setAgentStatus(s);
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const criticalApprovals = approvals.filter((a) => a.urgency === 'critical').length;

  function formatUptime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div className="space-y-3">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-noc-muted uppercase tracking-wider">Network Health</span>
            <Activity className="w-3.5 h-3.5 text-noc-cyan" />
          </div>
          <div className="flex items-center gap-3">
            <HealthBadge score={health?.overall_score || 0} size="sm" />
            <div>
              <div className="text-xl font-bold font-mono text-white">{health?.overall_score?.toFixed(1) || '--'}%</div>
              <div className="text-[10px] text-noc-muted">
                <span className="text-noc-green">{health?.healthy_count || 0}</span>
                {' / '}
                <span className="text-noc-amber">{health?.warning_count || 0}</span>
                {' / '}
                <span className="text-noc-red">{health?.critical_count || 0}</span>
              </div>
            </div>
          </div>
        </div>

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

        <div className="glass-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-noc-muted uppercase tracking-wider">Agent Status</span>
            <Zap className="w-3.5 h-3.5 text-noc-green" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              agentStatus?.state === 'running' ? 'bg-noc-green animate-pulse' : 'bg-noc-red'
            }`} />
            <span className="text-xl font-bold font-mono text-white capitalize">
              {agentStatus?.state || '--'}
            </span>
          </div>
          <div className="text-[10px] text-noc-muted mt-0.5 font-mono">
            {agentStatus ? `Loop #${agentStatus.loop_count} | Up ${formatUptime(agentStatus.uptime_seconds)} | ${agentStatus.mode}` : '--'}
          </div>
        </div>
      </div>

      {/* Charts Row — 2x2 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <DeviceCPUChart
          data={deviceTimeseries}
          onDeviceClick={(id) => setDrilldown({ type: 'device', id })}
        />
        <DeviceMemoryChart
          data={deviceTimeseries}
          onDeviceClick={(id) => setDrilldown({ type: 'device', id })}
        />
        <LinkUtilizationBar
          links={links}
          onLinkClick={(id) => setDrilldown({ type: 'link', id })}
        />
        <LatencyLossChart
          links={links}
          onLinkClick={(id) => setDrilldown({ type: 'link', id })}
        />
      </div>

      {/* Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Incident Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-noc-red" />
              <span className="text-xs font-bold text-noc-muted uppercase tracking-wider">
                Incident Feed
              </span>
            </div>
            <div className="flex gap-1.5">
              {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                const colors = { critical: 'text-noc-red', high: 'text-noc-amber', medium: 'text-noc-cyan', low: 'text-noc-muted' };
                return (
                  <span key={sev} className={`text-[10px] font-bold font-mono ${colors[sev]}`}>
                    {severityCounts[sev]}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
            {activeIncidents.slice(0, 8).map((incident) => {
              const sevColor: Record<string, string> = {
                critical: 'border-l-noc-red bg-noc-red/5',
                high: 'border-l-noc-amber bg-noc-amber/5',
                medium: 'border-l-noc-cyan bg-noc-cyan/5',
                low: 'border-l-noc-muted bg-noc-bg/40',
              };
              return (
                <div
                  key={incident.id}
                  className={`p-2 rounded border-l-2 ${sevColor[incident.severity] || 'border-l-noc-muted bg-noc-bg/40'}`}
                >
                  <div className="text-xs font-medium text-noc-text truncate">{incident.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-mono text-noc-cyan">{incident.id}</span>
                    <span className={`text-[10px] font-semibold ${
                      incident.status === 'mitigating' ? 'text-noc-amber'
                      : incident.status === 'analyzing' ? 'text-noc-cyan'
                      : 'text-noc-muted'
                    }`}>
                      {incident.status}
                    </span>
                    <span className="text-[10px] text-noc-muted truncate">
                      {incident.affected_devices?.slice(0, 2).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDrilldown({ type: 'device', id: d })}
                          className="hover:text-noc-cyan transition-colors mr-1"
                        >
                          <Server className="w-2.5 h-2.5 inline mr-0.5" />
                          {d}
                        </button>
                      ))}
                    </span>
                  </div>
                </div>
              );
            })}
            {activeIncidents.length === 0 && (
              <div className="text-center py-6 text-noc-muted text-xs">
                No active incidents
              </div>
            )}
          </div>
        </motion.div>

        {/* Decision Feed */}
        <DecisionFeed limit={8} />
      </div>

      {/* Device/Link Drill-Down Slide-Out */}
      <AnimatePresence>
        {drilldown && (
          <DeviceDrilldown
            type={drilldown.type}
            id={drilldown.id}
            onClose={() => setDrilldown(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
