import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bot, Play, Pause, Clock, RotateCw, Cpu, Zap } from 'lucide-react';
import { getAgentStatus, AgentStatus as AgentStatusType } from '../../api/agent';
import { formatTimestamp } from '../../utils/formatTimestamp';
import StatusDot from '../common/StatusDot';

export default function AgentStatusCard() {
  const [status, setStatus] = useState<AgentStatusType | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const data = await getAgentStatus();
      setStatus(data);
    };
    fetch();
    const interval = setInterval(fetch, 3000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (!status) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-noc-border/30 rounded w-1/3 mb-4" />
        <div className="h-4 bg-noc-border/30 rounded w-2/3 mb-2" />
        <div className="h-4 bg-noc-border/30 rounded w-1/2" />
      </div>
    );
  }

  const stateConfig: Record<string, { color: string; bg: string; border: string; label: string; dotStatus: 'running' | 'paused' | 'stopped' | 'error' }> = {
    running: { color: 'text-noc-green', bg: 'bg-noc-green/10', border: 'border-noc-green/30', label: 'OPERATIONAL', dotStatus: 'running' },
    paused: { color: 'text-noc-amber', bg: 'bg-noc-amber/10', border: 'border-noc-amber/30', label: 'PAUSED', dotStatus: 'paused' },
    stopped: { color: 'text-noc-muted', bg: 'bg-noc-muted/10', border: 'border-noc-muted/30', label: 'OFFLINE', dotStatus: 'stopped' },
    error: { color: 'text-noc-red', bg: 'bg-noc-red/10', border: 'border-noc-red/30', label: 'ERROR', dotStatus: 'error' },
  };

  const config = stateConfig[status.state] || stateConfig.stopped;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`glass-card p-6 border ${config.border} scan-effect`}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${config.bg} border ${config.border}`}>
            <Bot className={`w-6 h-6 ${config.color}`} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-noc-text">AI Agent</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusDot status={config.dotStatus} size="sm" />
              <span className={`text-xs font-semibold uppercase tracking-widest ${config.color}`}>
                {config.label}
              </span>
            </div>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg ${config.bg} border ${config.border}`}>
          <span className={`text-xs font-bold uppercase ${config.color}`}>{status.mode}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-noc-bg/50">
          <Clock className="w-4 h-4 text-noc-muted" />
          <div>
            <div className="text-xs text-noc-muted">Uptime</div>
            <div className="text-sm font-semibold text-noc-text font-mono">
              {formatUptime(status.uptime_seconds)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-noc-bg/50">
          <RotateCw className="w-4 h-4 text-noc-muted" />
          <div>
            <div className="text-xs text-noc-muted">Loop Count</div>
            <div className="text-sm font-semibold text-noc-cyan font-mono">
              {status.loop_count.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-noc-bg/50">
          <Cpu className="w-4 h-4 text-noc-muted" />
          <div>
            <div className="text-xs text-noc-muted">Anomalies</div>
            <div className="text-sm font-semibold text-noc-text">{status.anomalies_detected}</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 p-3 rounded-lg bg-noc-bg/50">
          <Zap className="w-4 h-4 text-noc-muted" />
          <div>
            <div className="text-xs text-noc-muted">Incidents Created</div>
            <div className="text-sm font-semibold text-noc-text">
              {status.incidents_created}
            </div>
          </div>
        </div>
      </div>

      {status.started_at && (
        <div className="mt-4 pt-3 border-t border-noc-border/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-noc-muted">Started At</span>
            <span className="text-noc-text font-mono">
              {formatTimestamp(status.started_at)}
            </span>
          </div>
        </div>
      )}

      {/* Animated border glow */}
      {status.state === 'running' && (
        <motion.div
          className="absolute inset-0 rounded-xl border border-noc-green/20 pointer-events-none"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}
