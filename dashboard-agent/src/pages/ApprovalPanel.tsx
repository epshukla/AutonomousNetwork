import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Crosshair,
  Brain,
  Server,
  ChevronDown,
  ChevronUp,
  Loader2,
  Zap,
  Link2,
} from 'lucide-react';
import {
  getActiveIncidents,
  diagnoseIncident,
  approveAction,
  rejectAction,
  resolveIncident,
  Incident,
  Decision,
} from '../api/agent';
import { formatTimestamp } from '../utils/formatTimestamp';
import ReasoningTrace from '../components/agent/ReasoningTrace';

const tierConfig: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: 'Tier 1 — Auto', color: 'text-noc-green', bg: 'bg-noc-green/10', border: 'border-noc-green/30' },
  2: { label: 'Tier 2 — Supervised', color: 'text-noc-cyan', bg: 'bg-noc-cyan/10', border: 'border-noc-cyan/30' },
  3: { label: 'Tier 3 — Approval', color: 'text-noc-amber', bg: 'bg-noc-amber/10', border: 'border-noc-amber/30' },
  4: { label: 'Tier 4 — Senior', color: 'text-noc-red', bg: 'bg-noc-red/10', border: 'border-noc-red/30' },
};

const statusStyles: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending Approval', color: 'text-noc-amber', bg: 'bg-noc-amber/10' },
  approved: { label: 'Approved', color: 'text-noc-cyan', bg: 'bg-noc-cyan/10' },
  executed: { label: 'Executed', color: 'text-noc-green', bg: 'bg-noc-green/10' },
  rejected: { label: 'Rejected', color: 'text-noc-red', bg: 'bg-noc-red/10' },
  logged: { label: 'Work Order', color: 'text-noc-muted', bg: 'bg-noc-surface' },
};

function DecisionCard({ decision, expanded, onToggle }: {
  decision: Decision;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tier = tierConfig[decision.tier] || tierConfig[3];
  const status = statusStyles[decision.status] || statusStyles.pending;
  const title = decision.description || (decision.action_type || '').replace(/_/g, ' ').toUpperCase();

  // Override status style for executed failures
  const isFailed = decision.status === 'executed' && decision.outcome_success === false;
  const statusDisplay = isFailed
    ? { label: 'Failed', color: 'text-noc-red', bg: 'bg-noc-red/10' }
    : status;

  return (
    <div className="rounded-lg border border-noc-border/30 bg-noc-surface/30 overflow-hidden">
      {/* Decision Header */}
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-noc-surface/50 transition-colors text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tier.bg} ${tier.color} ${tier.border} border`}>
              {tier.label}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${statusDisplay.bg} ${statusDisplay.color}`}>
              {statusDisplay.label}
            </span>
            {decision.category === 'physical' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-noc-purple/10 text-noc-purple border border-noc-purple/30">
                Physical
              </span>
            )}
          </div>
          <span className="text-sm font-semibold text-noc-text">{title}</span>
        </div>

        {/* Confidence */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-16 h-2 rounded-full bg-noc-border/30 overflow-hidden">
            <div
              className={`h-full rounded-full ${
                decision.confidence >= 0.8 ? 'bg-noc-green' : decision.confidence >= 0.6 ? 'bg-noc-amber' : 'bg-noc-red'
              }`}
              style={{ width: `${decision.confidence * 100}%` }}
            />
          </div>
          <span className="text-xs font-mono text-noc-muted w-8 text-right">
            {Math.round(decision.confidence * 100)}%
          </span>
        </div>

        {expanded ? <ChevronUp className="w-4 h-4 text-noc-muted" /> : <ChevronDown className="w-4 h-4 text-noc-muted" />}
      </button>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-noc-border/20 pt-3">
              {/* Reasoning */}
              {decision.reasoning && (
                <div>
                  <span className="text-[10px] font-bold text-noc-muted uppercase tracking-wider">Reasoning</span>
                  <p className="text-sm text-noc-text mt-1">{decision.reasoning}</p>
                </div>
              )}

              {/* Blast Radius */}
              {decision.blast_radius_estimate && (
                <div className="flex items-center gap-2">
                  <Crosshair className="w-3.5 h-3.5 text-noc-red" />
                  <span className="text-xs text-noc-muted">Blast Radius:</span>
                  <span className="text-xs font-semibold text-noc-text">{decision.blast_radius_estimate}</span>
                </div>
              )}

              {/* Expected Result */}
              {decision.expected_result && (
                <div className="p-3 rounded-lg bg-noc-cyan/5 border border-noc-cyan/20">
                  <span className="text-[10px] font-bold text-noc-cyan uppercase tracking-wider">Expected Result</span>
                  <p className="text-sm text-noc-text mt-1">{decision.expected_result}</p>
                </div>
              )}

              {/* Command / Parameters */}
              {Object.keys(decision.parameters || {}).length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-noc-muted uppercase tracking-wider">Command Parameters</span>
                  <pre className="mt-1 p-3 rounded-lg bg-noc-bg/80 border border-noc-cyan/20 text-xs text-noc-text font-mono overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(decision.parameters, null, 2)}
                  </pre>
                </div>
              )}

              {/* Execution Outcome */}
              {decision.status === 'executed' && decision.outcome_data && (
                <div className={`p-3 rounded-lg border ${
                  decision.outcome_success !== false
                    ? 'bg-noc-green/5 border-noc-green/20'
                    : 'bg-noc-red/5 border-noc-red/20'
                }`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    decision.outcome_success !== false ? 'text-noc-green' : 'text-noc-red'
                  }`}>
                    Execution Result
                  </span>
                  <pre className="mt-1 text-xs text-noc-text font-mono overflow-x-auto whitespace-pre-wrap">
                    {typeof decision.outcome_data === 'string'
                      ? decision.outcome_data
                      : JSON.stringify(decision.outcome_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ApprovalPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState<string | null>(null);
  const [diagnosisResults, setDiagnosisResults] = useState<Record<string, string>>({});
  const [approving, setApproving] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ incidentId: string; type: 'approve' | 'reject' } | null>(null);
  const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const data = await getActiveIncidents();
    setIncidents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleDiagnose = async (incident: Incident) => {
    setDiagnosing(incident.id);
    try {
      const result = await diagnoseIncident(incident.id);
      setDiagnosisResults((prev) => ({ ...prev, [incident.id]: result.diagnosis }));
      await fetchData();
    } catch (err: any) {
      setDiagnosisResults((prev) => ({
        ...prev,
        [incident.id]: `Error: ${err?.message || 'Diagnosis failed'}`,
      }));
    } finally {
      setDiagnosing(null);
    }
  };

  const handleApprove = async (incidentId: string) => {
    setApproving(incidentId);
    await approveAction(incidentId);
    setConfirmAction(null);
    setApproving(null);
    await fetchData();
  };

  const handleReject = async (incidentId: string) => {
    setApproving(incidentId);
    await rejectAction(incidentId, 'Rejected by operator');
    setConfirmAction(null);
    setApproving(null);
    await fetchData();
  };

  const handleResolve = async (incidentId: string) => {
    setResolving(incidentId);
    await resolveIncident(incidentId);
    await fetchData();
    setResolving(null);
  };

  const toggleDecision = (id: string) => {
    setExpandedDecisions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="glass-card p-8 animate-pulse">
            <div className="h-6 bg-noc-border/30 rounded w-1/3 mb-4" />
            <div className="h-4 bg-noc-border/30 rounded w-2/3 mb-2" />
            <div className="h-32 bg-noc-border/30 rounded mb-4" />
            <div className="h-12 bg-noc-border/30 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (incidents.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 text-center"
      >
        <ShieldCheck className="w-16 h-16 text-noc-green mx-auto mb-4" />
        <h2 className="text-xl font-bold text-noc-text mb-2">All Clear</h2>
        <p className="text-noc-muted">
          No active incidents. The network is operating normally.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="flex items-center gap-4">
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-noc-amber" />
          <div>
            <div className="text-xl font-bold text-noc-amber">{incidents.length}</div>
            <div className="text-[10px] text-noc-muted uppercase tracking-wider">Active Incidents</div>
          </div>
        </div>
      </div>

      {/* Unified Incident Cards */}
      <AnimatePresence>
        {incidents.map((incident, index) => {
          const decisions = incident.decisions || [];
          const diagnosis = diagnosisResults[incident.id] || incident.reasoning_trace;
          const isAnalyzing = diagnosing === incident.id;

          const pendingDecisions = decisions.filter((d) => d.status === 'pending');
          const softwareDecisions = decisions.filter((d) => d.category !== 'physical');
          const allSoftwareDone = softwareDecisions.length > 0 && softwareDecisions.every((d) => d.status !== 'pending');
          const anySuccess = softwareDecisions.some((d) => d.outcome_success !== false && d.status === 'executed');

          // Phase determines card appearance
          let phase: 'detected' | 'pending' | 'done';
          if (decisions.length === 0 && !diagnosis) phase = 'detected';
          else if (pendingDecisions.length > 0) phase = 'pending';
          else if (allSoftwareDone) phase = 'done';
          else phase = decisions.length > 0 ? 'pending' : 'detected';

          const borderClass = {
            detected: 'border-2 border-noc-red/40',
            pending: 'border-2 border-noc-amber/40',
            done: 'border-2 border-noc-green/40',
          }[phase];

          const bannerBg = {
            detected: 'bg-noc-red/10 border-b border-noc-red/20',
            pending: 'bg-noc-amber/10 border-b border-noc-amber/20',
            done: 'bg-noc-green/10 border-b border-noc-green/20',
          }[phase];

          const bannerText = {
            detected: 'New Incident — Awaiting AI Analysis',
            pending: 'AI Diagnosis Complete — Awaiting Approval',
            done: anySuccess ? 'Actions Executed — Review Outcome' : 'Actions Completed',
          }[phase];

          const bannerColor = {
            detected: 'text-noc-red',
            pending: 'text-noc-amber',
            done: 'text-noc-green',
          }[phase];

          const BannerIcon = {
            detected: AlertTriangle,
            pending: ShieldAlert,
            done: CheckCircle,
          }[phase];

          const isConfirming = confirmAction?.incidentId === incident.id;
          const isProcessing = approving === incident.id;

          return (
            <motion.div
              key={`inc-${incident.id}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.1 }}
              className={`glass-card overflow-hidden ${borderClass}`}
            >
              {/* Phase Banner */}
              <div className={`${bannerBg} px-6 py-2.5 flex items-center gap-2`}>
                <BannerIcon className={`w-4 h-4 ${bannerColor} ${phase === 'detected' ? 'animate-pulse' : ''}`} />
                <span className={`text-xs font-bold ${bannerColor} uppercase tracking-widest`}>
                  {bannerText}
                </span>
                <span className="ml-auto text-xs text-noc-muted font-mono">
                  {formatTimestamp(incident.detected_at)}
                </span>
              </div>

              <div className="p-6">
                {/* Incident Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-mono text-noc-cyan">INC-{incident.id}</span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        incident.severity === 'critical' ? 'text-noc-red bg-noc-red/10'
                        : incident.severity === 'high' || incident.severity === 'emergency' as any ? 'text-noc-amber bg-noc-amber/10'
                        : 'text-noc-cyan bg-noc-cyan/10'
                      }`}>
                        {(incident.severity || '').toUpperCase()}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-noc-text">{incident.title}</h2>
                  </div>
                </div>

                {/* Affected Resources */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
                  {incident.affected_devices.length > 0 && (
                    <div className="p-3 rounded-lg bg-noc-bg/50 border border-noc-border/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Server className="w-3.5 h-3.5 text-noc-muted" />
                        <span className="text-[10px] font-bold text-noc-muted uppercase tracking-wider">Affected Devices</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {incident.affected_devices.map((d) => (
                          <span key={d} className="text-xs px-2 py-0.5 rounded bg-noc-surface border border-noc-border/30 text-noc-cyan font-mono">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(incident.affected_links || []).length > 0 && (
                    <div className="p-3 rounded-lg bg-noc-bg/50 border border-noc-border/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Link2 className="w-3.5 h-3.5 text-noc-muted" />
                        <span className="text-[10px] font-bold text-noc-muted uppercase tracking-wider">Affected Links</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(incident.affected_links || []).map((l) => (
                          <span key={l} className="text-xs px-2 py-0.5 rounded bg-noc-surface border border-noc-border/30 text-noc-red font-mono">
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Anomaly Hypothesis */}
                {incident.root_cause_hypothesis && (
                  <div className="mb-5 p-3 rounded-lg bg-noc-amber/5 border border-noc-amber/20">
                    <span className="text-[10px] font-bold text-noc-amber uppercase tracking-wider">Anomaly Detection</span>
                    <p className="text-sm text-noc-text mt-1">{incident.root_cause_hypothesis}</p>
                  </div>
                )}

                {/* AI Diagnosis */}
                {diagnosis && (
                  <div className="mb-5">
                    <ReasoningTrace trace={diagnosis} title="AI Diagnosis" />
                  </div>
                )}

                {/* Decisions */}
                {decisions.length > 0 && (
                  <div className="mb-5">
                    <h3 className="text-xs font-bold text-noc-muted uppercase tracking-widest mb-3">
                      Recommended Actions ({decisions.length})
                    </h3>
                    <div className="space-y-2">
                      {decisions.map((dec) => (
                        <DecisionCard
                          key={dec.id}
                          decision={dec}
                          expanded={expandedDecisions.has(dec.id)}
                          onToggle={() => toggleDecision(dec.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="border-t border-noc-border/20 pt-5">
                  {/* Phase: DETECTED — show AI Analyze button */}
                  {phase === 'detected' && (
                    <button
                      onClick={() => handleDiagnose(incident)}
                      disabled={isAnalyzing}
                      className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 ${
                        isAnalyzing
                          ? 'bg-noc-surface text-noc-muted border border-noc-border/30 cursor-wait'
                          : 'bg-gradient-to-r from-noc-cyan/20 to-noc-purple/20 text-noc-cyan border-2 border-noc-cyan/30 hover:border-noc-cyan/60 hover:shadow-lg hover:shadow-noc-cyan/20'
                      }`}
                    >
                      {isAnalyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          AI Analyzing... (Claude API call in progress)
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          AI Analyze — Diagnose & Recommend Actions
                        </>
                      )}
                    </button>
                  )}

                  {/* Phase: PENDING — show Approve / Reject */}
                  {phase === 'pending' && pendingDecisions.length > 0 && (
                    <AnimatePresence mode="wait">
                      {isConfirming ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={`p-4 rounded-xl border-2 ${
                            confirmAction!.type === 'approve'
                              ? 'bg-noc-green/5 border-noc-green/30'
                              : 'bg-noc-red/5 border-noc-red/30'
                          }`}
                        >
                          <div className="text-center mb-3">
                            <span className={`text-sm font-bold ${
                              confirmAction!.type === 'approve' ? 'text-noc-green' : 'text-noc-red'
                            }`}>
                              {confirmAction!.type === 'approve'
                                ? `CONFIRM — Execute ${pendingDecisions.length} action(s) on the network`
                                : `CONFIRM — Reject ${pendingDecisions.length} action(s)`}
                            </span>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() =>
                                confirmAction!.type === 'approve'
                                  ? handleApprove(incident.id)
                                  : handleReject(incident.id)
                              }
                              disabled={isProcessing}
                              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                                confirmAction!.type === 'approve'
                                  ? 'bg-noc-green text-noc-bg hover:bg-noc-green/90 shadow-lg shadow-noc-green/30'
                                  : 'bg-noc-red text-white hover:bg-noc-red/90 shadow-lg shadow-noc-red/30'
                              }`}
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : confirmAction!.type === 'approve' ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <XCircle className="w-4 h-4" />
                              )}
                              {isProcessing
                                ? 'Executing...'
                                : confirmAction!.type === 'approve'
                                ? 'YES, EXECUTE ON NETWORK'
                                : 'YES, REJECT'}
                            </button>
                            <button
                              onClick={() => setConfirmAction(null)}
                              disabled={isProcessing}
                              className="px-6 py-3 rounded-xl font-bold text-sm bg-noc-surface text-noc-muted hover:bg-noc-bg transition-all border border-noc-border/30"
                            >
                              CANCEL
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex gap-4"
                        >
                          <button
                            onClick={() => setConfirmAction({ incidentId: incident.id, type: 'approve' })}
                            className="flex-1 py-4 rounded-xl font-bold text-base bg-noc-green/15 text-noc-green border-2 border-noc-green/30 hover:bg-noc-green/25 hover:border-noc-green/50 hover:shadow-lg hover:shadow-noc-green/20 transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-5 h-5" />
                            APPROVE & EXECUTE ({pendingDecisions.length})
                          </button>
                          <button
                            onClick={() => setConfirmAction({ incidentId: incident.id, type: 'reject' })}
                            className="flex-1 py-4 rounded-xl font-bold text-base bg-noc-red/15 text-noc-red border-2 border-noc-red/30 hover:bg-noc-red/25 hover:border-noc-red/50 hover:shadow-lg hover:shadow-noc-red/20 transition-all flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-5 h-5" />
                            REJECT
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}

                  {/* Phase: DONE — show outcome + Resolve */}
                  {phase === 'done' && (
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleDiagnose(incident)}
                        disabled={isAnalyzing}
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-noc-surface text-noc-cyan border border-noc-cyan/30 hover:bg-noc-cyan/10 transition-all flex items-center justify-center gap-2"
                      >
                        {isAnalyzing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Brain className="w-4 h-4" />
                        )}
                        Re-Analyze
                      </button>
                      <button
                        onClick={() => handleResolve(incident.id)}
                        disabled={resolving === incident.id}
                        className="flex-1 py-3 rounded-xl font-bold text-sm bg-noc-green/15 text-noc-green border-2 border-noc-green/30 hover:bg-noc-green/25 hover:border-noc-green/50 hover:shadow-lg hover:shadow-noc-green/20 transition-all flex items-center justify-center gap-2"
                      >
                        {resolving === incident.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Mark Resolved
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
