import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History as HistoryIcon,
  ChevronDown,
  ChevronRight,
  Filter,
  Clock,
  Play,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pause,
} from 'lucide-react';
import { chaosApi, agentApi, HistoryEntry, SCENARIOS, AgentIncident } from '../api/chaos';

const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [incidentHistory, setIncidentHistory] = useState<AgentIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [filterScenario, setFilterScenario] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const [h, incidents] = await Promise.all([
        chaosApi.getHistory(),
        agentApi.getIncidentHistory(),
      ]);
      setHistory(h);
      setIncidentHistory(incidents);
      setLoading(false);
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter((h) => {
      const matchesScenario = filterScenario === 'all' || h.scenario_name === filterScenario;
      const matchesStatus = filterStatus === 'all' || h.status === filterStatus;
      return matchesScenario && matchesStatus;
    });
  }, [history, filterScenario, filterStatus]);

  const toggleRow = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds == null) return '--';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const computeDuration = (entry: HistoryEntry): number | null => {
    if (!entry.started_at) return null;
    const start = new Date(entry.started_at).getTime();
    if (entry.ended_at) {
      const end = new Date(entry.ended_at).getTime();
      return Math.round((end - start) / 1000);
    }
    if (entry.status === 'running') {
      return Math.round((Date.now() - start) / 1000);
    }
    return null;
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={14} className="text-emerald-400" />;
      case 'stopped': return <Pause size={14} className="text-amber-400" />;
      case 'failed': return <XCircle size={14} className="text-red-400" />;
      case 'running': return <Play size={14} className="text-cyan-400" />;
      default: return <Clock size={14} className="text-noc-muted" />;
    }
  };

  const uniqueScenarioTypes = useMemo(
    () => Array.from(new Set(history.map((h) => h.scenario_name))),
    [history]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20">
            <HistoryIcon size={24} className="text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-noc-text">Chaos History</h1>
            <p className="text-sm text-noc-muted">
              {history.length} recorded chaos run{history.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-xs text-noc-muted">Completed</p>
            <p className="text-lg font-bold font-mono text-emerald-400">
              {history.filter((h) => h.status === 'completed').length}
            </p>
          </div>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-xs text-noc-muted">Stopped</p>
            <p className="text-lg font-bold font-mono text-amber-400">
              {history.filter((h) => h.status === 'stopped').length}
            </p>
          </div>
          <div className="glass-card px-4 py-2 text-center">
            <p className="text-xs text-noc-muted">Failed</p>
            <p className="text-lg font-bold font-mono text-red-400">
              {history.filter((h) => h.status === 'failed').length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-noc-muted" />
          <span className="text-xs text-noc-muted uppercase tracking-wider font-semibold">Scenario:</span>
          <select
            value={filterScenario}
            onChange={(e) => setFilterScenario(e.target.value)}
            className="px-3 py-1.5 bg-noc-bg border border-noc-border rounded-lg text-xs text-noc-text font-mono focus:outline-none focus:border-cyan-400/50"
          >
            <option value="all">All Scenarios</option>
            {uniqueScenarioTypes.map((type) => {
              const meta = SCENARIOS.find((s) => s.name === type);
              return (
                <option key={type} value={type}>
                  {meta?.display_name || type}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-noc-muted uppercase tracking-wider font-semibold">Status:</span>
          <div className="flex gap-1.5">
            {['all', 'completed', 'stopped', 'failed', 'running'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  filterStatus === status
                    ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
                    : 'bg-noc-surface text-noc-muted border border-noc-border hover:border-noc-muted/30'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-noc-muted text-sm">Loading history...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="p-12 text-center">
            <Search size={48} className="text-noc-muted/30 mx-auto mb-4" />
            <p className="text-noc-muted text-lg">No chaos runs found</p>
            <p className="text-sm text-noc-muted/60 mt-1">
              {history.length === 0
                ? 'Launch your first chaos scenario from the Launch Pad'
                : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-noc-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-noc-muted w-8" />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-noc-muted">
                    Scenario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-noc-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-noc-muted">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-noc-muted">
                    Ended
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-noc-muted">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((entry, idx) => {
                  const meta = SCENARIOS.find((s) => s.name === entry.scenario_name);
                  const isExpanded = expandedRows.has(entry.id);

                  return (
                    <React.Fragment key={entry.id || idx}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        onClick={() => toggleRow(entry.id)}
                        className="border-b border-noc-border/30 hover:bg-noc-surface/30 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}>
                            <ChevronRight size={14} className="text-noc-muted" />
                          </motion.div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-noc-text">
                              {meta?.display_name || entry.scenario_name}
                            </span>
                            {meta && (
                              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                                meta.severity === 'emergency' ? 'bg-red-500/20 text-red-400' :
                                meta.severity === 'critical' ? 'bg-red-400/10 text-red-400' :
                                meta.severity === 'high' ? 'bg-amber-400/10 text-amber-400' :
                                'bg-cyan-400/10 text-cyan-400'
                              }`}>
                                {meta.severity}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(entry.status)}
                            <span className="text-sm text-noc-text capitalize">{entry.status}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-noc-muted font-mono">
                          {formatDate(entry.started_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-noc-muted font-mono">
                          {formatDate(entry.ended_at)}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-cyan-400">
                          {formatDuration(computeDuration(entry))}
                        </td>
                      </motion.tr>

                      {/* Expanded row */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <td colSpan={6} className="px-6 py-4 bg-noc-bg/50">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Parameters */}
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-noc-muted mb-2">
                                    Parameters
                                  </h4>
                                  <div className="glass-card p-3 space-y-1">
                                    {Object.entries(entry.params || {}).map(([k, v]) => (
                                      <div key={k} className="flex justify-between text-xs">
                                        <span className="text-noc-muted font-mono">{k}</span>
                                        <span className="text-noc-text font-mono">{String(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Timeline */}
                                <div>
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-noc-muted mb-2">
                                    Event Timeline
                                  </h4>
                                  <div className="glass-card p-3">
                                    <div className="space-y-3">
                                      {/* Scenario started */}
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-red-400/10 border border-red-400/30 flex items-center justify-center flex-shrink-0">
                                          <Play size={12} className="text-red-400" />
                                        </div>
                                        <div className="flex-1">
                                          <p className="text-xs font-semibold text-noc-text">Chaos Injected</p>
                                          <p className="text-xs text-noc-muted font-mono">{formatDate(entry.started_at)}</p>
                                        </div>
                                      </div>

                                      {/* Scenario ended */}
                                      {entry.ended_at && (
                                        <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                            entry.status === 'completed'
                                              ? 'bg-emerald-400/10 border border-emerald-400/30'
                                              : entry.status === 'stopped'
                                              ? 'bg-amber-400/10 border border-amber-400/30'
                                              : 'bg-red-400/10 border border-red-400/30'
                                          }`}>
                                            {entry.status === 'completed' ? (
                                              <CheckCircle2 size={12} className="text-emerald-400" />
                                            ) : entry.status === 'stopped' ? (
                                              <Pause size={12} className="text-amber-400" />
                                            ) : (
                                              <XCircle size={12} className="text-red-400" />
                                            )}
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-xs font-semibold text-noc-text capitalize">
                                              Scenario {entry.status}
                                            </p>
                                            <p className="text-xs text-noc-muted font-mono">{formatDate(entry.ended_at)}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
