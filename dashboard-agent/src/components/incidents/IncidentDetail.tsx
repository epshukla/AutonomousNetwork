import { motion } from 'framer-motion';
import { X, AlertCircle, Server, Clock, CheckCircle, Target, Brain } from 'lucide-react';
import { Incident } from '../../api/agent';
import ReasoningTrace from '../agent/ReasoningTrace';
import Timeline from './Timeline';

interface IncidentDetailProps {
  incident: Incident;
  onClose: () => void;
}

const severityConfig = {
  critical: { color: 'text-noc-red', bg: 'bg-noc-red/10', border: 'border-noc-red/30' },
  high: { color: 'text-noc-amber', bg: 'bg-noc-amber/10', border: 'border-noc-amber/30' },
  medium: { color: 'text-noc-cyan', bg: 'bg-noc-cyan/10', border: 'border-noc-cyan/30' },
  low: { color: 'text-noc-muted', bg: 'bg-noc-surface', border: 'border-noc-border/30' },
};

const statusConfig: Record<string, { color: string; bg: string }> = {
  detected: { color: 'text-noc-red', bg: 'bg-noc-red/10' },
  analyzing: { color: 'text-noc-cyan', bg: 'bg-noc-cyan/10' },
  mitigating: { color: 'text-noc-amber', bg: 'bg-noc-amber/10' },
  escalated: { color: 'text-noc-purple', bg: 'bg-noc-purple/10' },
  resolved: { color: 'text-noc-green', bg: 'bg-noc-green/10' },
};

export default function IncidentDetail({ incident, onClose }: IncidentDetailProps) {
  const sev = severityConfig[incident.severity] || severityConfig.medium;
  const stat = statusConfig[incident.status] || statusConfig.detected;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="glass-card p-6 overflow-y-auto max-h-[calc(100vh-120px)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono text-noc-cyan">{incident.id}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sev.color} ${sev.bg} border ${sev.border}`}>
              {incident.severity}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${stat.color} ${stat.bg}`}>
              {incident.status}
            </span>
          </div>
          <h2 className="text-lg font-bold text-noc-text">{incident.title}</h2>
          <p className="text-sm text-noc-muted mt-1">{incident.description}</p>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-noc-surface transition-colors"
        >
          <X className="w-5 h-5 text-noc-muted" />
        </button>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-noc-bg/50 border border-noc-border/20">
          <Clock className="w-4 h-4 text-noc-muted" />
          <div>
            <div className="text-xs text-noc-muted">Detected</div>
            <div className="text-sm text-noc-text font-mono">
              {new Date(incident.detected_at).toLocaleString()}
            </div>
          </div>
        </div>
        {incident.resolved_at && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-noc-bg/50 border border-noc-border/20">
            <CheckCircle className="w-4 h-4 text-noc-green" />
            <div>
              <div className="text-xs text-noc-muted">Resolved</div>
              <div className="text-sm text-noc-green font-mono">
                {new Date(incident.resolved_at).toLocaleString()}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-noc-bg/50 border border-noc-border/20">
          <Server className="w-4 h-4 text-noc-muted" />
          <div>
            <div className="text-xs text-noc-muted">Affected Devices</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {incident.affected_devices.map((d) => (
                <span
                  key={d}
                  className="text-xs px-1.5 py-0.5 rounded bg-noc-surface border border-noc-border/30 text-noc-cyan font-mono"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>
        </div>
        {(incident.root_cause || incident.root_cause_hypothesis) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-noc-bg/50 border border-noc-border/20">
            <Target className="w-4 h-4 text-noc-amber" />
            <div>
              <div className="text-xs text-noc-muted">Root Cause</div>
              <div className="text-sm text-noc-amber">{incident.root_cause || incident.root_cause_hypothesis}</div>
            </div>
          </div>
        )}
      </div>

      {/* Hypotheses */}
      {(incident.hypotheses?.length ?? 0) > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-noc-cyan" />
            Hypotheses
          </h3>
          <div className="space-y-2">
            {(incident.hypotheses || []).map((h) => (
              <div
                key={h.id}
                className="p-3 rounded-lg bg-noc-bg/40 border border-noc-border/20"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-noc-text">{h.description}</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      h.status === 'confirmed'
                        ? 'text-noc-green bg-noc-green/10'
                        : h.status === 'rejected'
                        ? 'text-noc-red bg-noc-red/10'
                        : 'text-noc-amber bg-noc-amber/10'
                    }`}
                  >
                    {h.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 h-1.5 rounded-full bg-noc-border/30 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${h.confidence * 100}%` }}
                      transition={{ duration: 1 }}
                      className={`h-full rounded-full ${
                        h.confidence >= 0.7
                          ? 'bg-noc-green'
                          : h.confidence >= 0.4
                          ? 'bg-noc-amber'
                          : 'bg-noc-red'
                      }`}
                    />
                  </div>
                  <span className="text-xs text-noc-muted font-mono">{Math.round(h.confidence * 100)}%</span>
                </div>
                {h.evidence.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {h.evidence.map((e, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-noc-surface/50 text-noc-muted"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions Taken (from actions or decisions array) */}
      {((incident.actions?.length ?? 0) > 0 || (incident.decisions?.length ?? 0) > 0) && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider mb-3">
            Actions Taken / Recommended
          </h3>
          <div className="space-y-2">
            {(incident.actions || []).map((action) => {
              const actionTier = action.tier ?? 1;
              const actionType = action.type || action.action_type || '';
              return (
                <div
                  key={action.id}
                  className={`p-3 rounded-lg border ${
                    action.status === 'executed'
                      ? 'bg-noc-green/5 border-noc-green/20'
                      : action.status === 'pending'
                      ? 'bg-noc-amber/5 border-noc-amber/20'
                      : action.status === 'failed'
                      ? 'bg-noc-red/5 border-noc-red/20'
                      : 'bg-noc-bg/40 border-noc-border/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-noc-text">
                        {actionType.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        actionTier <= 2
                          ? 'text-noc-green bg-noc-green/10 border-noc-green/30'
                          : actionTier === 3
                          ? 'text-noc-amber bg-noc-amber/10 border-noc-amber/30'
                          : 'text-noc-red bg-noc-red/10 border-noc-red/30'
                      }`}>
                        Tier {actionTier}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold ${
                      action.status === 'executed' ? 'text-noc-green'
                      : action.status === 'pending' ? 'text-noc-amber'
                      : action.status === 'failed' ? 'text-noc-red'
                      : 'text-noc-muted'
                    }`}>
                      {action.status}
                    </span>
                  </div>
                  <p className="text-xs text-noc-muted mt-1">{action.description}</p>
                  {action.outcome && (
                    <p className="text-xs text-noc-green mt-2 p-2 bg-noc-green/5 rounded">
                      Outcome: {action.outcome}
                    </p>
                  )}
                </div>
              );
            })}
            {(incident.decisions || []).map((decision) => {
              const decTier = decision.autonomy_tier ?? decision.tier ?? 1;
              return (
                <div
                  key={decision.id}
                  className={`p-3 rounded-lg border ${
                    decision.status === 'executed'
                      ? 'bg-noc-green/5 border-noc-green/20'
                      : decision.status === 'pending' || decision.status === 'pending_approval'
                      ? 'bg-noc-amber/5 border-noc-amber/20'
                      : decision.status === 'failed'
                      ? 'bg-noc-red/5 border-noc-red/20'
                      : 'bg-noc-bg/40 border-noc-border/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-noc-text">
                        {(decision.action_type || '').replace(/_/g, ' ')}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        decTier <= 2
                          ? 'text-noc-green bg-noc-green/10 border-noc-green/30'
                          : decTier === 3
                          ? 'text-noc-amber bg-noc-amber/10 border-noc-amber/30'
                          : 'text-noc-red bg-noc-red/10 border-noc-red/30'
                      }`}>
                        Tier {decTier}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold ${
                      decision.status === 'executed' ? 'text-noc-green'
                      : decision.status === 'pending' || decision.status === 'pending_approval' ? 'text-noc-amber'
                      : decision.status === 'failed' ? 'text-noc-red'
                      : 'text-noc-muted'
                    }`}>
                      {decision.status}
                    </span>
                  </div>
                  <p className="text-xs text-noc-muted mt-1">{decision.reasoning}</p>
                  {decision.outcome && (
                    <p className="text-xs text-noc-green mt-2 p-2 bg-noc-green/5 rounded">
                      Outcome: {decision.outcome}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reasoning Trace */}
      {incident.reasoning_trace && (
        <div className="mb-6">
          <ReasoningTrace trace={incident.reasoning_trace} />
        </div>
      )}

      {/* Timeline */}
      {(incident.timeline?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider mb-3">
            Event Timeline
          </h3>
          <Timeline events={incident.timeline!} />
        </div>
      )}
    </motion.div>
  );
}
