import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScrollText,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  Filter,
  Download,
} from 'lucide-react';
import { getDecisions, Decision } from '../api/agent';

export default function AuditLog() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'timestamp' | 'tier' | 'confidence'>('timestamp');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const fetch = async () => {
      const data = await getDecisions(100);
      setDecisions(data);
      setLoading(false);
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    let result = [...decisions];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          (d.id || '').toLowerCase().includes(term) ||
          (d.action_type || '').toLowerCase().includes(term) ||
          (d.incident_id || '').toLowerCase().includes(term) ||
          (d.reasoning || '').toLowerCase().includes(term)
      );
    }

    if (filterOutcome !== 'all') {
      result = result.filter((d) => d.outcome === filterOutcome);
    }

    if (filterTier !== 'all') {
      result = result.filter((d) => d.tier === parseInt(filterTier));
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'timestamp':
          cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'tier':
          cmp = a.tier - b.tier;
          break;
        case 'confidence':
          cmp = a.confidence - b.confidence;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [decisions, searchTerm, filterOutcome, filterTier, sortField, sortDir]);

  const handleSort = (field: 'timestamp' | 'tier' | 'confidence') => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const outcomeConfig = {
    success: { icon: CheckCircle, color: 'text-noc-green', bg: 'bg-noc-green/10' },
    failure: { icon: XCircle, color: 'text-noc-red', bg: 'bg-noc-red/10' },
    pending: { icon: Clock, color: 'text-noc-amber', bg: 'bg-noc-amber/10' },
    rejected: { icon: Ban, color: 'text-noc-muted', bg: 'bg-noc-surface' },
  };

  const tierColors: Record<number, string> = {
    1: 'text-noc-green bg-noc-green/10 border-noc-green/30',
    2: 'text-noc-cyan bg-noc-cyan/10 border-noc-cyan/30',
    3: 'text-noc-amber bg-noc-amber/10 border-noc-amber/30',
    4: 'text-noc-red bg-noc-red/10 border-noc-red/30',
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  // Summary stats
  const stats = useMemo(() => ({
    total: decisions.length,
    success: decisions.filter((d) => d.outcome === 'success').length,
    failed: decisions.filter((d) => d.outcome === 'failure').length,
    pending: decisions.filter((d) => d.outcome === 'pending').length,
    rejected: decisions.filter((d) => d.outcome === 'rejected').length,
  }), [decisions]);

  if (loading) {
    return (
      <div className="glass-card p-6 animate-pulse">
        <div className="h-6 bg-noc-border/30 rounded w-1/4 mb-6" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="h-10 bg-noc-border/30 rounded mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-noc-cyan" />
          <span className="text-sm font-bold text-noc-text">{stats.total}</span>
          <span className="text-xs text-noc-muted">Total</span>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-noc-green" />
          <span className="text-sm font-bold text-noc-green">{stats.success}</span>
          <span className="text-xs text-noc-muted">Success</span>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-noc-red" />
          <span className="text-sm font-bold text-noc-red">{stats.failed}</span>
          <span className="text-xs text-noc-muted">Failed</span>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-noc-amber" />
          <span className="text-sm font-bold text-noc-amber">{stats.pending}</span>
          <span className="text-xs text-noc-muted">Pending</span>
        </div>
        <div className="glass-card px-4 py-2 flex items-center gap-2">
          <Ban className="w-4 h-4 text-noc-muted" />
          <span className="text-sm font-bold text-noc-muted">{stats.rejected}</span>
          <span className="text-xs text-noc-muted">Rejected</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-noc-muted" />
          <input
            type="text"
            placeholder="Search decisions, incidents, action types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="noc-input w-full pl-9"
          />
        </div>
        <select
          value={filterOutcome}
          onChange={(e) => setFilterOutcome(e.target.value)}
          className="noc-input"
        >
          <option value="all">All Outcomes</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value)}
          className="noc-input"
        >
          <option value="all">All Tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
          <option value="4">Tier 4</option>
        </select>
        <span className="text-xs text-noc-muted">
          {filtered.length} of {decisions.length} records
        </span>
      </div>

      {/* Audit Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-noc-border/30">
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">ID</th>
                <th
                  className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider cursor-pointer hover:text-noc-cyan transition-colors"
                  onClick={() => handleSort('timestamp')}
                >
                  Timestamp <SortIcon field="timestamp" />
                </th>
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Incident</th>
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Action Type</th>
                <th
                  className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider cursor-pointer hover:text-noc-cyan transition-colors"
                  onClick={() => handleSort('tier')}
                >
                  Tier <SortIcon field="tier" />
                </th>
                <th
                  className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider cursor-pointer hover:text-noc-cyan transition-colors"
                  onClick={() => handleSort('confidence')}
                >
                  Confidence <SortIcon field="confidence" />
                </th>
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Outcome</th>
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Exec Time</th>
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((decision) => {
                const outcome = outcomeConfig[decision.outcome as keyof typeof outcomeConfig] || outcomeConfig.pending;
                const OutcomeIcon = outcome.icon;
                const isExpanded = expandedRow === decision.id;

                return (
                  <motion.tbody key={decision.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <tr
                      className={`border-b border-noc-border/10 cursor-pointer transition-colors ${
                        isExpanded ? 'bg-noc-surface/20' : 'hover:bg-noc-surface/10'
                      }`}
                      onClick={() => setExpandedRow(isExpanded ? null : decision.id)}
                    >
                      <td className="p-3">
                        <span className="text-xs font-mono text-noc-muted">{decision.id}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm font-mono text-noc-text whitespace-nowrap">
                          {new Date(decision.timestamp).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm font-mono text-noc-cyan">{decision.incident_id}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-sm text-noc-text">
                          {(decision.action_type || '').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                            tierColors[decision.tier] || tierColors[1]
                          }`}
                        >
                          T{decision.tier}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-noc-border/30 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                decision.confidence >= 0.8
                                  ? 'bg-noc-green'
                                  : decision.confidence >= 0.6
                                  ? 'bg-noc-amber'
                                  : 'bg-noc-red'
                              }`}
                              style={{ width: `${decision.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-noc-text">
                            {Math.round(decision.confidence * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`flex items-center gap-1 text-xs font-semibold ${outcome.color}`}>
                          <OutcomeIcon className="w-3.5 h-3.5" />
                          {decision.outcome}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs font-mono text-noc-muted">{decision.execution_time_ms}ms</span>
                      </td>
                      <td className="p-3">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-noc-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-noc-muted" />
                        )}
                      </td>
                    </tr>

                    {/* Expanded Detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <tr>
                          <td colSpan={9}>
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-b border-noc-border/20 overflow-hidden"
                            >
                              <div className="p-4 bg-noc-bg/40 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-xs font-bold text-noc-cyan uppercase tracking-wider mb-2">
                                    Reasoning
                                  </h4>
                                  <p className="text-sm text-noc-muted leading-relaxed">{decision.reasoning}</p>
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-noc-cyan uppercase tracking-wider mb-2">
                                    Parameters
                                  </h4>
                                  <pre className="text-xs text-noc-text font-mono bg-noc-bg/60 p-3 rounded-lg border border-noc-border/20 overflow-x-auto">
                                    {JSON.stringify(decision.parameters, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </motion.tbody>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-noc-muted text-sm">
            {decisions.length === 0
              ? 'No decisions yet. The agent will log decisions as it operates.'
              : 'No audit records match the current filters.'}
          </div>
        )}
      </div>
    </div>
  );
}
