import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Search, Filter, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Incident } from '../../api/agent';
import { formatTimestamp } from '../../utils/formatTimestamp';

interface IncidentListProps {
  incidents: Incident[];
  onSelect: (incident: Incident) => void;
  selectedId?: string | null;
}

type SortField = 'detected_at' | 'severity' | 'status';
type SortDir = 'asc' | 'desc';

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
const statusOrder = { detected: 0, analyzing: 1, mitigating: 2, escalated: 3, resolved: 4 };

const severityConfig = {
  critical: { color: 'text-noc-red', bg: 'bg-noc-red/10', border: 'border-noc-red/30', icon: AlertCircle },
  high: { color: 'text-noc-amber', bg: 'bg-noc-amber/10', border: 'border-noc-amber/30', icon: AlertTriangle },
  medium: { color: 'text-noc-cyan', bg: 'bg-noc-cyan/10', border: 'border-noc-cyan/30', icon: Info },
  low: { color: 'text-noc-muted', bg: 'bg-noc-surface', border: 'border-noc-border/30', icon: Info },
};

const statusConfig: Record<string, { color: string; bg: string }> = {
  detected: { color: 'text-noc-red', bg: 'bg-noc-red/10' },
  analyzing: { color: 'text-noc-cyan', bg: 'bg-noc-cyan/10' },
  mitigating: { color: 'text-noc-amber', bg: 'bg-noc-amber/10' },
  escalated: { color: 'text-noc-purple', bg: 'bg-noc-purple/10' },
  resolved: { color: 'text-noc-green', bg: 'bg-noc-green/10' },
};

export default function IncidentList({ incidents, onSelect, selectedId }: IncidentListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('detected_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filtered = useMemo(() => {
    let result = [...incidents];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (i) =>
          String(i.id || '').toLowerCase().includes(term) ||
          (i.title || '').toLowerCase().includes(term) ||
          (i.affected_devices || []).some((d) => String(d).toLowerCase().includes(term))
      );
    }

    if (filterSeverity !== 'all') {
      result = result.filter((i) => i.severity === filterSeverity);
    }

    if (filterStatus !== 'all') {
      result = result.filter((i) => i.status === filterStatus);
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'detected_at':
          cmp = new Date(a.detected_at || 0).getTime() - new Date(b.detected_at || 0).getTime();
          break;
        case 'severity':
          cmp = (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99);
          break;
        case 'status':
          cmp = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [incidents, searchTerm, sortField, sortDir, filterSeverity, filterStatus]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-noc-muted" />
          <input
            type="text"
            placeholder="Search incidents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="noc-input w-full pl-9"
          />
        </div>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="noc-input"
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="noc-input"
        >
          <option value="all">All Status</option>
          <option value="detected">Detected</option>
          <option value="analyzing">Analyzing</option>
          <option value="mitigating">Mitigating</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-noc-border/30">
              <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">ID</th>
              <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Title</th>
              <th
                className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider cursor-pointer hover:text-noc-cyan transition-colors"
                onClick={() => handleSort('severity')}
              >
                Severity <SortIcon field="severity" />
              </th>
              <th
                className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider cursor-pointer hover:text-noc-cyan transition-colors"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon field="status" />
              </th>
              <th
                className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider cursor-pointer hover:text-noc-cyan transition-colors"
                onClick={() => handleSort('detected_at')}
              >
                Detected <SortIcon field="detected_at" />
              </th>
              <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Devices</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((incident) => {
                const sev = severityConfig[incident.severity] || severityConfig.medium;
                const stat = statusConfig[incident.status] || statusConfig.detected;
                const isSelected = selectedId === incident.id;

                return (
                  <motion.tr
                    key={incident.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onSelect(incident)}
                    className={`border-b border-noc-border/10 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-noc-cyan/5 border-l-2 border-l-noc-cyan'
                        : 'hover:bg-noc-surface/30'
                    }`}
                  >
                    <td className="p-3">
                      <span className="text-sm font-mono text-noc-cyan">{incident.id}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-noc-text font-medium">{incident.title}</span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${sev.color} ${sev.bg} border ${sev.border}`}
                      >
                        {incident.severity}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${stat.color} ${stat.bg}`}
                      >
                        {incident.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-noc-muted font-mono">
                        {formatTimestamp(incident.detected_at)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {incident.affected_devices.map((d) => (
                          <span
                            key={d}
                            className="text-xs px-1.5 py-0.5 rounded bg-noc-surface border border-noc-border/30 text-noc-muted font-mono"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-noc-muted text-sm">
            {incidents.length === 0
              ? 'No incidents yet. The agent will detect and report incidents as they occur.'
              : 'No incidents match the current filters.'}
          </div>
        )}
      </div>
    </div>
  );
}
