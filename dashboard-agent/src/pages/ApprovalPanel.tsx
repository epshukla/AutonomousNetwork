import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Crosshair,
  Brain,
  Server,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { getPendingApprovals, approveAction, rejectAction, PendingApproval } from '../api/agent';
import ReasoningTrace from '../components/agent/ReasoningTrace';

export default function ApprovalPanel() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{ id: string; type: 'approve' | 'reject' } | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedParams, setExpandedParams] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    const data = await getPendingApprovals();
    setApprovals(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 5000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const handleApprove = async (approval: PendingApproval) => {
    setProcessing(approval.id);
    await approveAction(approval.incident_id);
    setApprovals((prev) => prev.filter((a) => a.id !== approval.id));
    setConfirmAction(null);
    setProcessing(null);
  };

  const handleReject = async (approval: PendingApproval) => {
    setProcessing(approval.id);
    await rejectAction(approval.incident_id, 'Rejected by operator');
    setApprovals((prev) => prev.filter((a) => a.id !== approval.id));
    setConfirmAction(null);
    setProcessing(null);
  };

  const tierConfig: Record<number, { label: string; color: string; bg: string; border: string; icon: typeof ShieldCheck }> = {
    1: { label: 'Tier 1 - Auto', color: 'text-noc-green', bg: 'bg-noc-green/10', border: 'border-noc-green/30', icon: ShieldCheck },
    2: { label: 'Tier 2 - Supervised', color: 'text-noc-cyan', bg: 'bg-noc-cyan/10', border: 'border-noc-cyan/30', icon: ShieldCheck },
    3: { label: 'Tier 3 - Approval Required', color: 'text-noc-amber', bg: 'bg-noc-amber/10', border: 'border-noc-amber/30', icon: ShieldAlert },
    4: { label: 'Tier 4 - Senior Approval', color: 'text-noc-red', bg: 'bg-noc-red/10', border: 'border-noc-red/30', icon: ShieldAlert },
  };

  const urgencyConfig: Record<string, { color: string; bg: string; pulse: boolean }> = {
    critical: { color: 'text-noc-red', bg: 'bg-noc-red/10', pulse: true },
    high: { color: 'text-noc-amber', bg: 'bg-noc-amber/10', pulse: true },
    medium: { color: 'text-noc-cyan', bg: 'bg-noc-cyan/10', pulse: false },
    low: { color: 'text-noc-muted', bg: 'bg-noc-surface', pulse: false },
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card p-8 animate-pulse">
            <div className="h-6 bg-noc-border/30 rounded w-1/3 mb-4" />
            <div className="h-4 bg-noc-border/30 rounded w-2/3 mb-2" />
            <div className="h-32 bg-noc-border/30 rounded mb-4" />
            <div className="flex gap-4">
              <div className="h-12 bg-noc-border/30 rounded flex-1" />
              <div className="h-12 bg-noc-border/30 rounded flex-1" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 text-center"
      >
        <ShieldCheck className="w-16 h-16 text-noc-green mx-auto mb-4" />
        <h2 className="text-xl font-bold text-noc-text mb-2">All Clear</h2>
        <p className="text-noc-muted">
          No pending approvals. The AI agent is operating within autonomous parameters.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="flex items-center gap-4">
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-noc-amber" />
          <div>
            <div className="text-xl font-bold text-noc-amber">{approvals.length}</div>
            <div className="text-[10px] text-noc-muted uppercase tracking-wider">Pending</div>
          </div>
        </div>
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-noc-red" />
          <div>
            <div className="text-xl font-bold text-noc-red">
              {approvals.filter((a) => a.urgency === 'critical').length}
            </div>
            <div className="text-[10px] text-noc-muted uppercase tracking-wider">Critical</div>
          </div>
        </div>
      </div>

      {/* Approval Cards */}
      <AnimatePresence>
        {approvals.map((approval, index) => {
          const tier = tierConfig[approval.tier] || tierConfig[3];
          const urgency = urgencyConfig[approval.urgency || 'medium'] || urgencyConfig.medium;
          const TierIcon = tier.icon;
          const isConfirming = confirmAction?.id === approval.id;
          const isProcessing = processing === approval.id;

          return (
            <motion.div
              key={approval.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.1 }}
              className={`glass-card overflow-hidden scan-effect ${
                approval.tier >= 4 ? 'border-2 border-noc-red/30 glow-red' : 'border border-noc-amber/20'
              }`}
            >
              {/* Urgency Banner */}
              {approval.urgency === 'critical' && (
                <div className="bg-noc-red/10 border-b border-noc-red/20 px-6 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-noc-red animate-pulse" />
                  <span className="text-xs font-bold text-noc-red uppercase tracking-widest">
                    Critical Action - Immediate Review Required
                  </span>
                  {approval.expires_at && (
                    <span className="ml-auto text-xs text-noc-red font-mono">
                      Expires: {new Date(approval.expires_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              )}

              <div className="p-6">
                {/* Card Header */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${tier.color} ${tier.bg} border ${tier.border}`}>
                        <TierIcon className="w-3.5 h-3.5" />
                        {tier.label}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${urgency.color} ${urgency.bg}`}>
                        {approval.urgency} urgency
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-noc-text">
                      {(approval.action_type || '').replace(/_/g, ' ').toUpperCase()}
                    </h2>
                    <p className="text-sm text-noc-muted mt-1">{approval.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-noc-muted">Approval ID</div>
                    <div className="text-sm font-mono text-noc-cyan">{approval.id}</div>
                  </div>
                </div>

                {/* Related Incident */}
                {approval.related_incident && (
                  <div className="mb-5 p-3 rounded-lg bg-noc-bg/50 border border-noc-border/20 flex items-center gap-3">
                    <Server className="w-4 h-4 text-noc-muted" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-noc-cyan">{approval.incident_id}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          approval.related_incident.severity === 'critical' ? 'text-noc-red bg-noc-red/10' : 'text-noc-amber bg-noc-amber/10'
                        }`}>
                          {approval.related_incident.severity}
                        </span>
                      </div>
                      <div className="text-sm text-noc-text mt-0.5">{approval.related_incident.title}</div>
                    </div>
                    {approval.related_incident.affected_devices && (
                      <div className="flex gap-1">
                        {approval.related_incident.affected_devices.map((d) => (
                          <span key={d} className="text-xs px-1.5 py-0.5 rounded bg-noc-surface border border-noc-border/30 text-noc-muted font-mono">
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Claude's Reasoning */}
                <div className="mb-5">
                  <ReasoningTrace trace={approval.reasoning} />
                </div>

                {/* Blast Radius & Confidence */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div className="p-4 rounded-lg bg-noc-bg/50 border border-noc-red/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Crosshair className="w-4 h-4 text-noc-red" />
                      <span className="text-xs font-bold text-noc-red uppercase tracking-wider">
                        Blast Radius
                      </span>
                    </div>
                    <p className="text-sm text-noc-text">{approval.blast_radius}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-noc-bg/50 border border-noc-border/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-noc-cyan" />
                      <span className="text-xs font-bold text-noc-cyan uppercase tracking-wider">
                        Confidence Score
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 rounded-full bg-noc-border/30 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${approval.confidence * 100}%` }}
                          transition={{ duration: 1, delay: 0.3 }}
                          className={`h-full rounded-full ${
                            approval.confidence >= 0.8
                              ? 'bg-noc-green'
                              : approval.confidence >= 0.6
                              ? 'bg-noc-amber'
                              : 'bg-noc-red'
                          }`}
                          style={{
                            boxShadow: `0 0 10px ${
                              approval.confidence >= 0.8 ? '#00ff8840' : approval.confidence >= 0.6 ? '#ffaa0040' : '#ff444440'
                            }`,
                          }}
                        />
                      </div>
                      <span className="text-lg font-bold text-noc-text font-mono">
                        {Math.round(approval.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Parameters (Expandable) */}
                <div className="mb-5">
                  <button
                    onClick={() => setExpandedParams(expandedParams === approval.id ? null : approval.id)}
                    className="flex items-center gap-2 text-xs font-bold text-noc-muted uppercase tracking-wider hover:text-noc-cyan transition-colors"
                  >
                    Action Parameters
                    {expandedParams === approval.id ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                  <AnimatePresence>
                    {expandedParams === approval.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <pre className="mt-2 p-3 rounded-lg bg-noc-bg/80 border border-noc-border/20 text-xs text-noc-text font-mono overflow-x-auto">
                          {JSON.stringify(approval.parameters, null, 2)}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Action Buttons */}
                <div className="border-t border-noc-border/20 pt-5">
                  <AnimatePresence mode="wait">
                    {isConfirming ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`p-4 rounded-xl border-2 ${
                          confirmAction.type === 'approve'
                            ? 'bg-noc-green/5 border-noc-green/30'
                            : 'bg-noc-red/5 border-noc-red/30'
                        }`}
                      >
                        <div className="text-center mb-3">
                          <span className={`text-sm font-bold ${
                            confirmAction.type === 'approve' ? 'text-noc-green' : 'text-noc-red'
                          }`}>
                            {confirmAction.type === 'approve'
                              ? 'CONFIRM APPROVAL - This action will be executed immediately'
                              : 'CONFIRM REJECTION - This action will be discarded'}
                          </span>
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() =>
                              confirmAction.type === 'approve'
                                ? handleApprove(approval)
                                : handleReject(approval)
                            }
                            disabled={isProcessing}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                              confirmAction.type === 'approve'
                                ? 'bg-noc-green text-noc-bg hover:bg-noc-green/90 shadow-lg shadow-noc-green/30'
                                : 'bg-noc-red text-white hover:bg-noc-red/90 shadow-lg shadow-noc-red/30'
                            }`}
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : confirmAction.type === 'approve' ? (
                              <CheckCircle className="w-4 h-4" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            {isProcessing
                              ? 'Processing...'
                              : confirmAction.type === 'approve'
                              ? 'YES, EXECUTE ACTION'
                              : 'YES, REJECT ACTION'}
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
                          onClick={() => setConfirmAction({ id: approval.id, type: 'approve' })}
                          className="flex-1 py-4 rounded-xl font-bold text-base bg-noc-green/15 text-noc-green border-2 border-noc-green/30 hover:bg-noc-green/25 hover:border-noc-green/50 hover:shadow-lg hover:shadow-noc-green/20 transition-all flex items-center justify-center gap-2 group"
                        >
                          <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          APPROVE ACTION
                        </button>
                        <button
                          onClick={() => setConfirmAction({ id: approval.id, type: 'reject' })}
                          className="flex-1 py-4 rounded-xl font-bold text-base bg-noc-red/15 text-noc-red border-2 border-noc-red/30 hover:bg-noc-red/25 hover:border-noc-red/50 hover:shadow-lg hover:shadow-noc-red/20 transition-all flex items-center justify-center gap-2 group"
                        >
                          <XCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                          REJECT ACTION
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
