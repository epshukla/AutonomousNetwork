import React from 'react';
import { motion } from 'framer-motion';
import { Search, Wrench, CheckCircle2, XCircle, Clock, Brain, Shield, AlertTriangle } from 'lucide-react';
import { AgentIncident, AgentAction } from '../../api/chaos';
import { formatTimeOnly } from '../../utils/formatTimestamp';
import StatusDot from '../common/StatusDot';

interface AgentResponseProps {
  incidents: AgentIncident[];
}

const actionIcons: Record<string, React.ReactNode> = {
  detected: <AlertTriangle size={16} className="text-amber-400" />,
  investigating: <Search size={16} className="text-cyan-400" />,
  mitigating: <Wrench size={16} className="text-amber-400" />,
  resolved: <CheckCircle2 size={16} className="text-emerald-400" />,
  pending: <Clock size={16} className="text-noc-muted" />,
  executing: <Brain size={16} className="text-cyan-400" />,
  completed: <CheckCircle2 size={16} className="text-emerald-400" />,
  failed: <XCircle size={16} className="text-red-400" />,
};

const statusMessages: Record<string, { label: string; color: string }> = {
  detected: { label: 'Anomaly Detected', color: 'text-amber-400' },
  investigating: { label: 'AI Investigating', color: 'text-cyan-400' },
  mitigating: { label: 'Applying Fix', color: 'text-amber-400' },
  resolved: { label: 'Resolved', color: 'text-emerald-400' },
};

export const AgentResponse: React.FC<AgentResponseProps> = ({ incidents }) => {
  if (incidents.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-cyan-400" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-noc-muted">
            Agent Response Timeline
          </h3>
        </div>
        <div className="text-center py-8">
          <Brain size={48} className="text-noc-muted/30 mx-auto mb-3" />
          <p className="text-noc-muted">AI Agent is monitoring...</p>
          <p className="text-xs text-noc-muted/60 mt-1">Response timeline will appear when incidents are detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 scan-line">
      <div className="flex items-center gap-3 mb-4">
        <Brain size={20} className="text-cyan-400" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-noc-muted">
          Agent Response Timeline
        </h3>
        <span className="text-xs font-mono text-cyan-400 ml-auto">
          {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
        {incidents.map((incident, idx) => (
          <motion.div
            key={incident.id || idx}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="relative"
          >
            {/* Incident header */}
            <div className="flex items-start gap-3 mb-3">
              <div className="mt-0.5">
                <StatusDot status={incident.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-noc-text">{(incident as any).type || (incident as any).title || 'Incident'}</span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                    incident.severity === 'critical' ? 'bg-red-400/10 text-red-400 border border-red-400/30' :
                    incident.severity === 'high' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/30' :
                    'bg-cyan-400/10 text-cyan-400 border border-cyan-400/30'
                  }`}>
                    {incident.severity}
                  </span>
                  {statusMessages[incident.status] && (
                    <span className={`text-xs font-semibold ${statusMessages[incident.status].color}`}>
                      {statusMessages[incident.status].label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-noc-muted mt-1">{incident.description}</p>
                {incident.root_cause && (
                  <p className="text-xs text-amber-400/80 mt-1 font-mono">
                    Root cause: {incident.root_cause}
                  </p>
                )}
              </div>
              <span className="text-xs text-noc-muted font-mono whitespace-nowrap">
                {formatTimeOnly(incident.detected_at)}
              </span>
            </div>

            {/* Action timeline */}
            {incident.actions_taken && incident.actions_taken.length > 0 && (
              <div className="ml-6 border-l-2 border-noc-border pl-4 space-y-2">
                {incident.actions_taken.map((action: AgentAction, aIdx: number) => (
                  <motion.div
                    key={aIdx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 + aIdx * 0.05 }}
                    className="flex items-start gap-2 relative"
                  >
                    {/* Timeline dot */}
                    <div className="absolute -left-[1.35rem] top-1 w-2 h-2 rounded-full bg-noc-surface border-2 border-noc-border" />
                    <div className="flex-shrink-0 mt-0.5">{actionIcons[action.status] || actionIcons.pending}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-noc-text">{action.action}</p>
                      <p className="text-xs text-noc-muted">{action.description}</p>
                    </div>
                    <span className="text-xs text-noc-muted font-mono whitespace-nowrap">
                      {formatTimeOnly(action.timestamp)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Divider between incidents */}
            {idx < incidents.length - 1 && <div className="border-b border-noc-border/50 mt-4" />}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default AgentResponse;
