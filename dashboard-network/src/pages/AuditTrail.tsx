import { useState, useEffect } from 'react';
import { ScrollText, Filter } from 'lucide-react';
import { getAuditTrail, type AuditEntry } from '../api/simulator';

// ── Category Config ──────────────────────────────────────

const categoryTabs: { label: string; value: string | null }[] = [
  { label: 'All', value: null },
  { label: 'Config Changes', value: 'config_change' },
  { label: 'Access', value: 'access' },
  { label: 'Alarms', value: 'alarm' },
  { label: 'Compliance', value: 'compliance' },
];

const categoryBadge: Record<string, { bg: string; text: string }> = {
  config_change: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  access: { bg: 'bg-cyan-500/20', text: 'text-cyan-400' },
  alarm: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  compliance: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

const categoryLabel: Record<string, string> = {
  config_change: 'CONFIG',
  access: 'ACCESS',
  alarm: 'ALARM',
  compliance: 'COMPLIANCE',
};

const resultBadge: Record<string, string> = {
  success: 'bg-noc-green/20 text-noc-green',
  failure: 'bg-noc-red/20 text-noc-red',
};

// ── Component ────────────────────────────────────────────

export default function AuditTrail() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      try {
        const data = await getAuditTrail(100, category || undefined);
        if (mounted) { setEntries(data); setLoading(false); }
      } catch { if (mounted) setLoading(false); }
    };
    setLoading(true);
    poll();
    const interval = setInterval(poll, 15000);
    return () => { mounted = false; clearInterval(interval); };
  }, [category]);

  // ── Loading State ────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-noc-muted">
        <div className="w-5 h-5 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
        <span className="text-sm">Loading audit trail...</span>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ScrollText className="w-6 h-6 text-noc-cyan" />
        <h1 className="text-xl font-bold text-noc-text">System Audit Trail</h1>
        <span className="px-2 py-0.5 rounded-full bg-noc-cyan/20 text-noc-cyan text-xs font-mono">
          {entries.length}
        </span>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-noc-muted" />
        {categoryTabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setCategory(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase transition-colors ${
              category === tab.value
                ? 'bg-noc-cyan/20 text-noc-cyan border border-noc-cyan/30'
                : 'bg-noc-surface/50 text-noc-muted border border-noc-border/20 hover:text-noc-text'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-noc-surface/30 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] text-noc-muted uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Timestamp</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Detail</th>
              <th className="px-4 py-3 text-left">Source IP</th>
              <th className="px-4 py-3 text-left">Result</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              const catStyle = categoryBadge[entry.category] || {
                bg: 'bg-noc-surface/50',
                text: 'text-noc-muted',
              };
              const catLabel = categoryLabel[entry.category] || (entry.category || '').toUpperCase();
              const resStyle = resultBadge[entry.result] || 'bg-noc-surface/50 text-noc-muted';

              return (
                <tr
                  key={idx}
                  className="border-b border-noc-border/20 hover:bg-noc-surface/20 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-[11px] text-noc-muted whitespace-nowrap">
                    {new Date(entry.timestamp).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${catStyle.bg} ${catStyle.text}`}
                    >
                      {catLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-noc-text text-xs">{entry.user}</td>
                  <td className="px-4 py-3 text-noc-text text-xs">{entry.action}</td>
                  <td className="px-4 py-3 text-noc-muted text-[11px]">{entry.detail}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-noc-muted">
                    {entry.source_ip}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${resStyle}`}>
                      {(entry.result || '').toUpperCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
