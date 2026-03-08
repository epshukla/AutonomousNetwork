import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  Cable,
  HardHat,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Play,
  ChevronDown,
  ChevronUp,
  Loader2,
  Server,
  MapPin,
} from 'lucide-react';
import { getFieldTasks, updateFieldTaskStatus, FieldTask } from '../api/agent';
import { formatTimestamp } from '../utils/formatTimestamp';

const actionConfig: Record<string, { label: string; icon: typeof Wrench; color: string; bg: string }> = {
  replace_hardware: { label: 'Hardware Replacement', icon: Wrench, color: 'text-noc-amber', bg: 'bg-noc-amber/10' },
  dispatch_field_tech: { label: 'Field Tech Dispatch', icon: HardHat, color: 'text-noc-cyan', bg: 'bg-noc-cyan/10' },
  resplice_fiber: { label: 'Fiber Re-splice', icon: Cable, color: 'text-noc-red', bg: 'bg-noc-red/10' },
};

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  logged: { label: 'Awaiting Assignment', color: 'text-noc-amber', bg: 'bg-noc-amber/10', border: 'border-noc-amber/30' },
  in_progress: { label: 'In Progress', color: 'text-noc-cyan', bg: 'bg-noc-cyan/10', border: 'border-noc-cyan/30' },
  completed: { label: 'Completed', color: 'text-noc-green', bg: 'bg-noc-green/10', border: 'border-noc-green/30' },
};

export default function FieldTasks() {
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedParams, setExpandedParams] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [completionNotes, setCompletionNotes] = useState<Record<string, string>>({});
  const [showNotesFor, setShowNotesFor] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    const data = await getFieldTasks();
    setTasks(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleStartWork = async (task: FieldTask) => {
    setProcessing(task.id);
    try {
      await updateFieldTaskStatus(task.id, 'in_progress');
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'in_progress' as const } : t)));
    } catch {
      // silently fail
    }
    setProcessing(null);
  };

  const handleComplete = async (task: FieldTask) => {
    setProcessing(task.id);
    try {
      await updateFieldTaskStatus(task.id, 'completed', completionNotes[task.id] || '');
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'completed' as const } : t)));
      setShowNotesFor(null);
    } catch {
      // silently fail
    }
    setProcessing(null);
  };

  const logged = tasks.filter((t) => t.status === 'logged').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-card p-8 animate-pulse">
            <div className="h-6 bg-noc-border/30 rounded w-1/3 mb-4" />
            <div className="h-4 bg-noc-border/30 rounded w-2/3 mb-2" />
            <div className="h-24 bg-noc-border/30 rounded mb-4" />
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 text-center"
      >
        <Wrench className="w-16 h-16 text-noc-green mx-auto mb-4" />
        <h2 className="text-xl font-bold text-noc-text mb-2">No Field Tasks</h2>
        <p className="text-noc-muted">
          No physical work orders have been created. Physical tasks are generated when the AI detects
          issues requiring hands-on intervention (fiber repairs, hardware replacements).
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <HardHat className="w-5 h-5 text-noc-muted" />
          <div>
            <div className="text-xl font-bold text-noc-text">{tasks.length}</div>
            <div className="text-[10px] text-noc-muted uppercase tracking-wider">Total Tasks</div>
          </div>
        </div>
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <Clock className="w-5 h-5 text-noc-amber" />
          <div>
            <div className="text-xl font-bold text-noc-amber">{logged}</div>
            <div className="text-[10px] text-noc-muted uppercase tracking-wider">Awaiting</div>
          </div>
        </div>
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-noc-cyan" />
          <div>
            <div className="text-xl font-bold text-noc-cyan">{inProgress}</div>
            <div className="text-[10px] text-noc-muted uppercase tracking-wider">In Progress</div>
          </div>
        </div>
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-noc-green" />
          <div>
            <div className="text-xl font-bold text-noc-green">{completed}</div>
            <div className="text-[10px] text-noc-muted uppercase tracking-wider">Completed</div>
          </div>
        </div>
      </div>

      {/* Task Cards */}
      <AnimatePresence>
        {tasks.map((task, index) => {
          const action = actionConfig[task.action_type] || actionConfig.replace_hardware;
          const status = statusConfig[task.status] || statusConfig.logged;
          const ActionIcon = action.icon;
          const isProcessing = processing === task.id;
          const urgency = (task.parameters as any)?.urgency || 'medium';

          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.08 }}
              className={`glass-card overflow-hidden ${
                task.status === 'completed'
                  ? 'border border-noc-green/20 opacity-75'
                  : task.status === 'in_progress'
                  ? 'border border-noc-cyan/30'
                  : 'border border-noc-amber/20'
              }`}
            >
              {/* Category Banner */}
              <div className="bg-noc-surface/50 border-b border-noc-border/20 px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ActionIcon className={`w-4 h-4 ${action.color}`} />
                  <span className={`text-xs font-bold uppercase tracking-widest ${action.color}`}>
                    {action.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {urgency === 'critical' && (
                    <span className="flex items-center gap-1 text-xs font-bold text-noc-red">
                      <AlertTriangle className="w-3 h-3 animate-pulse" />
                      Critical
                    </span>
                  )}
                  {urgency === 'high' && (
                    <span className="text-xs font-bold text-noc-amber">High Priority</span>
                  )}
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${status.color} ${status.bg} border ${status.border}`}>
                    {status.label}
                  </span>
                </div>
              </div>

              <div className="p-6">
                {/* Task Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-noc-text">
                      {(task.action_type || '').replace(/_/g, ' ').toUpperCase()}
                    </h2>
                    <p className="text-sm text-noc-muted mt-1">{task.reasoning}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-noc-muted">Work Order</div>
                    <div className="text-sm font-mono text-noc-cyan">#{task.id}</div>
                  </div>
                </div>

                {/* Linked Incident */}
                {task.incident_title && (
                  <div className="mb-4 p-3 rounded-lg bg-noc-bg/50 border border-noc-border/20 flex items-center gap-3">
                    <Server className="w-4 h-4 text-noc-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-noc-cyan">INC-{task.incident_id}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          task.incident_severity === 'critical' || task.incident_severity === 'emergency'
                            ? 'text-noc-red bg-noc-red/10'
                            : 'text-noc-amber bg-noc-amber/10'
                        }`}>
                          {task.incident_severity}
                        </span>
                      </div>
                      <div className="text-sm text-noc-text mt-0.5 truncate">{task.incident_title}</div>
                    </div>
                  </div>
                )}

                {/* Key Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  {task.parameters && Object.entries(task.parameters).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-lg bg-noc-bg/50 border border-noc-border/20">
                      <div className="text-[10px] text-noc-muted uppercase tracking-wider mb-1">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-noc-text font-mono truncate">
                        {String(value || '-')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Full Parameters (Expandable) */}
                <div className="mb-4">
                  <button
                    onClick={() => setExpandedParams(expandedParams === task.id ? null : task.id)}
                    className="flex items-center gap-2 text-xs font-bold text-noc-muted uppercase tracking-wider hover:text-noc-cyan transition-colors"
                  >
                    Full Parameters
                    {expandedParams === task.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <AnimatePresence>
                    {expandedParams === task.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <pre className="mt-2 p-3 rounded-lg bg-noc-bg/80 border border-noc-border/20 text-xs text-noc-text font-mono overflow-x-auto">
                          {JSON.stringify(task.parameters, null, 2)}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Completion Notes (if completed) */}
                {task.status === 'completed' && task.notes && (
                  <div className="mb-4 p-3 rounded-lg bg-noc-green/5 border border-noc-green/20">
                    <div className="text-[10px] text-noc-green uppercase tracking-wider font-bold mb-1">
                      Completion Notes
                    </div>
                    <p className="text-sm text-noc-text">{task.notes}</p>
                  </div>
                )}

                {/* Timestamp */}
                <div className="flex items-center gap-2 text-xs text-noc-muted mb-4">
                  <Clock className="w-3 h-3" />
                  <span>Created: {formatTimestamp(task.created_at)}</span>
                </div>

                {/* Action Buttons */}
                {task.status !== 'completed' && (
                  <div className="border-t border-noc-border/20 pt-4">
                    {task.status === 'logged' && (
                      <button
                        onClick={() => handleStartWork(task)}
                        disabled={isProcessing}
                        className="w-full py-3 rounded-xl font-bold text-sm bg-noc-cyan/15 text-noc-cyan border-2 border-noc-cyan/30 hover:bg-noc-cyan/25 hover:border-noc-cyan/50 hover:shadow-lg hover:shadow-noc-cyan/20 transition-all flex items-center justify-center gap-2"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        {isProcessing ? 'Updating...' : 'START WORK'}
                      </button>
                    )}

                    {task.status === 'in_progress' && (
                      <div className="space-y-3">
                        {showNotesFor === task.id ? (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="space-y-3"
                          >
                            <textarea
                              placeholder="Completion notes (optional) — e.g., replaced SFP module in slot 3, link restored"
                              value={completionNotes[task.id] || ''}
                              onChange={(e) =>
                                setCompletionNotes((prev) => ({ ...prev, [task.id]: e.target.value }))
                              }
                              className="w-full p-3 rounded-lg bg-noc-bg/80 border border-noc-border/30 text-sm text-noc-text placeholder-noc-muted/50 focus:border-noc-green/50 focus:outline-none resize-none"
                              rows={2}
                            />
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleComplete(task)}
                                disabled={isProcessing}
                                className="flex-1 py-3 rounded-xl font-bold text-sm bg-noc-green/15 text-noc-green border-2 border-noc-green/30 hover:bg-noc-green/25 transition-all flex items-center justify-center gap-2"
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                CONFIRM COMPLETE
                              </button>
                              <button
                                onClick={() => setShowNotesFor(null)}
                                className="px-6 py-3 rounded-xl font-bold text-sm bg-noc-surface text-noc-muted hover:bg-noc-bg transition-all border border-noc-border/30"
                              >
                                CANCEL
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <button
                            onClick={() => setShowNotesFor(task.id)}
                            className="w-full py-3 rounded-xl font-bold text-sm bg-noc-green/15 text-noc-green border-2 border-noc-green/30 hover:bg-noc-green/25 hover:border-noc-green/50 hover:shadow-lg hover:shadow-noc-green/20 transition-all flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            MARK COMPLETE
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
