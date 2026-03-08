import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, AlertCircle, Server, Clock, CheckCircle, Target, Brain, Zap, Loader2, Crosshair } from 'lucide-react';
import { Incident, diagnoseIncident } from '../../api/agent';
import { formatTimestamp } from '../../utils/formatTimestamp';
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
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null);
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);

  const handleDiagnose = async () => {
    setDiagnosing(true);
    setDiagnosisError(null);
    try {
      const result = await diagnoseIncident(String(incident.id));
      setDiagnosisResult(result.diagnosis);
    } catch (err: any) {
      setDiagnosisError(err?.message || 'Diagnosis failed');
    } finally {
      setDiagnosing(false);
    }
  };

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
              {formatTimestamp(incident.detected_at)}
            </div>
          </div>
        </div>
        {incident.resolved_at && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-noc-bg/50 border border-noc-border/20">
            <CheckCircle className="w-4 h-4 text-noc-green" />
            <div>
              <div className="text-xs text-noc-muted">Resolved</div>
              <div className="text-sm text-noc-green font-mono">
                {formatTimestamp(incident.resolved_at)}
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

      {/* AI Diagnosis Button */}
      <div className="mb-6">
        <button
          onClick={handleDiagnose}
          disabled={diagnosing}
          className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 ${
            diagnosing
              ? 'bg-noc-surface text-noc-muted border border-noc-border/30 cursor-wait'
              : 'bg-gradient-to-r from-noc-cyan/20 to-noc-green/20 text-noc-cyan border-2 border-noc-cyan/30 hover:border-noc-cyan/60 hover:shadow-lg hover:shadow-noc-cyan/20'
          }`}
        >
          {diagnosing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              AI Diagnosing... (1 API call)
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              {diagnosisResult || incident.reasoning_trace ? 'Re-Diagnose with AI' : 'Diagnose with AI'}
            </>
          )}
        </button>
        {diagnosisError && (
          <p className="mt-2 text-sm text-noc-red text-center">{diagnosisError}</p>
        )}
      </div>

      {/* AI Diagnosis Result */}
      {(diagnosisResult || incident.reasoning_trace) && (
        <div className="mb-6">
          <ReasoningTrace trace={diagnosisResult || incident.reasoning_trace || ''} title="AI Diagnosis" />
        </div>
      )}

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
              const hasParams = decision.parameters && Object.keys(decision.parameters).length > 0;
              return (
                <div
                  key={decision.id}
                  className={`rounded-xl border overflow-hidden ${
                    decision.status === 'executed'
                      ? 'bg-noc-green/5 border-noc-green/20'
                      : decision.status === 'pending' || decision.status === 'pending_approval'
                      ? 'bg-noc-amber/5 border-noc-amber/20'
                      : decision.status === 'failed'
                      ? 'bg-noc-red/5 border-noc-red/20'
                      : 'bg-noc-bg/40 border-noc-border/20'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 border-b border-noc-border/10">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-noc-text truncate">
                          {(decision as any).description || (decision.action_type || '').replace(/_/g, ' ')}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                          decTier <= 2
                            ? 'text-noc-green bg-noc-green/10 border-noc-green/30'
                            : decTier === 3
                            ? 'text-noc-amber bg-noc-amber/10 border-noc-amber/30'
                            : 'text-noc-red bg-noc-red/10 border-noc-red/30'
                        }`}>
                          Tier {decTier}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${
                        decision.status === 'executed' ? 'text-noc-green bg-noc-green/10'
                        : decision.status === 'pending' || decision.status === 'pending_approval' ? 'text-noc-amber bg-noc-amber/10'
                        : decision.status === 'failed' ? 'text-noc-red bg-noc-red/10'
                        : decision.status === 'rejected' ? 'text-noc-red bg-noc-red/10'
                        : 'text-noc-muted bg-noc-surface'
                      }`}>
                        {decision.status === 'pending' ? 'PENDING APPROVAL' : (decision.status || '').toUpperCase()}
                      </span>
                    </div>
                    {(decision as any).description && (
                      <span className="text-[10px] text-noc-muted font-mono">
                        {(decision.action_type || '').replace(/_/g, ' ')}
                      </span>
                    )}
                    {/* Confidence & Blast Radius */}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-noc-muted uppercase">Confidence</span>
                        <div className="w-16 h-1.5 rounded-full bg-noc-border/30 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              decision.confidence >= 0.8 ? 'bg-noc-green'
                              : decision.confidence >= 0.6 ? 'bg-noc-amber'
                              : 'bg-noc-red'
                            }`}
                            style={{ width: `${decision.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-noc-text">{Math.round(decision.confidence * 100)}%</span>
                      </div>
                      {decision.blast_radius_estimate && (
                        <div className="flex items-center gap-1">
                          <Crosshair className="w-3 h-3 text-noc-red" />
                          <span className="text-[10px] text-noc-muted uppercase">Blast Radius</span>
                          <span className="text-xs font-mono text-noc-red">
                            ~{Number(decision.blast_radius_estimate).toLocaleString()} customers
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold text-noc-muted uppercase tracking-wider">Reasoning</span>
                      <p className="text-xs text-noc-muted mt-1">{decision.reasoning}</p>
                    </div>

                    {hasParams && (
                      <div>
                        <span className="text-[10px] font-bold text-noc-cyan uppercase tracking-wider">Command</span>
                        <pre className="mt-1 p-3 rounded-lg bg-noc-bg/80 border border-noc-cyan/20 text-xs text-noc-text font-mono overflow-x-auto">
                          {JSON.stringify(decision.parameters, null, 2)}
                        </pre>
                      </div>
                    )}

                    {(decision as any).expected_result && (
                      <div className="p-2.5 rounded-lg bg-noc-cyan/5 border border-noc-cyan/15">
                        <span className="text-[10px] font-bold text-noc-cyan uppercase tracking-wider">Expected Result</span>
                        <p className="text-xs text-noc-text mt-1">{(decision as any).expected_result}</p>
                      </div>
                    )}

                    {decision.outcome && decision.status === 'executed' && (
                      <div className="p-2.5 rounded-lg bg-noc-green/5 border border-noc-green/15">
                        <span className="text-[10px] font-bold text-noc-green uppercase tracking-wider">Outcome</span>
                        <p className="text-xs text-noc-green mt-1">{decision.outcome}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
