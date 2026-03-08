import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CheckCircle, XCircle, Clock, Ban, ChevronDown, ChevronUp } from 'lucide-react';
import { getDecisions, Decision } from '../../api/agent';
import { formatRelativeTime } from '../../utils/formatTimestamp';

interface DecisionFeedProps {
  limit?: number;
  compact?: boolean;
}

export default function DecisionFeed({ limit = 10, compact = false }: DecisionFeedProps) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const data = await getDecisions(limit);
      setDecisions(data.slice(0, limit));
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, [limit]);

  const outcomeConfig = {
    success: { icon: CheckCircle, color: 'text-noc-green', bg: 'bg-noc-green/10', label: 'Success' },
    failure: { icon: XCircle, color: 'text-noc-red', bg: 'bg-noc-red/10', label: 'Failed' },
    pending: { icon: Clock, color: 'text-noc-amber', bg: 'bg-noc-amber/10', label: 'Pending' },
    rejected: { icon: Ban, color: 'text-noc-muted', bg: 'bg-noc-muted/10', label: 'Rejected' },
  };

  const tierColors: Record<number, string> = {
    1: 'text-noc-green bg-noc-green/10 border-noc-green/30',
    2: 'text-noc-cyan bg-noc-cyan/10 border-noc-cyan/30',
    3: 'text-noc-amber bg-noc-amber/10 border-noc-amber/30',
    4: 'text-noc-red bg-noc-red/10 border-noc-red/30',
  };

  return (
    <div className={`glass-card ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-noc-amber" />
        <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider">Recent Decisions</h3>
        <span className="ml-auto text-xs text-noc-muted">{decisions.length} shown</span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {decisions.length === 0 && (
          <div className="text-center py-8 text-noc-muted text-sm">
            No decisions yet.
          </div>
        )}
        <AnimatePresence>
          {decisions.map((decision, index) => {
            const config = outcomeConfig[decision.outcome as keyof typeof outcomeConfig] || outcomeConfig.pending;
            const Icon = config.icon;
            const isExpanded = expanded === decision.id;

            return (
              <motion.div
                key={decision.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="bg-noc-bg/40 rounded-lg border border-noc-border/20 overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : decision.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-noc-surface/30 transition-colors text-left"
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-noc-text truncate">
                        {(decision.action_type || '').replace(/_/g, ' ')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                          tierColors[decision.tier] || tierColors[1]
                        }`}
                      >
                        T{decision.tier}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-noc-muted">{decision.incident_id}</span>
                      <span className="text-xs text-noc-muted">{formatRelativeTime(decision.timestamp)}</span>
                      <span className="text-xs text-noc-cyan font-mono">
                        {Math.round(decision.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-noc-muted" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-noc-muted" />
                  )}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-noc-border/20"
                    >
                      <div className="p-3 space-y-2">
                        <div className="text-xs text-noc-muted">{decision.reasoning}</div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-noc-muted">
                            Exec time:{' '}
                            <span className="text-noc-text font-mono">{decision.execution_time_ms}ms</span>
                          </span>
                          <span className={`font-medium ${config.color}`}>{config.label}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
