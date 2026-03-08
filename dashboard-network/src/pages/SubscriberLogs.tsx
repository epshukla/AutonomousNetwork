import { useState } from 'react';
import { Users, Search, ChevronLeft, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { useSubscriberLogs } from '../hooks/useTelemetry';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(1)} KB`;
  return `${bytes} B`;
}

const LIMIT = 50;

export default function SubscriberLogs() {
  const [subscriberId, setSubscriberId] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [offset, setOffset] = useState(0);

  const { data, loading } = useSubscriberLogs(
    LIMIT,
    offset,
    subscriberId || undefined
  );

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setSubscriberId(value.trim());
    setOffset(0);
  };

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + LIMIT, total);

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-noc-cyan" />
          <h1 className="text-2xl font-bold text-white">Subscriber Session Logs</h1>
          <span className="text-xs font-mono bg-noc-cyan/10 border border-noc-cyan/30 text-noc-cyan px-2 py-0.5 rounded-full">
            {total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-noc-muted" />
          <input
            type="text"
            placeholder="Filter by subscriber ID..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 bg-noc-surface/50 border border-noc-border/30 rounded-lg px-3 py-2 text-sm text-noc-text placeholder:text-noc-muted/50 focus:outline-none focus:border-noc-cyan/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card p-4 flex-1 flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-3 text-noc-muted">
              <div className="w-5 h-5 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
              <span className="text-sm">Loading subscriber data...</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-noc-surface/30 rounded-lg">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-noc-muted uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Subscriber ID</th>
                  <th className="text-left px-3 py-2">IP Address</th>
                  <th className="text-left px-3 py-2">MAC Address</th>
                  <th className="text-left px-3 py-2">OLT Device</th>
                  <th className="text-left px-3 py-2">PON Port</th>
                  <th className="text-left px-3 py-2">Start Time</th>
                  <th className="text-right px-3 py-2">Duration</th>
                  <th className="text-right px-3 py-2">Download</th>
                  <th className="text-right px-3 py-2">Upload</th>
                  <th className="text-center px-3 py-2">Protocol</th>
                  <th className="text-center px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">NAT IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-12 text-noc-muted text-sm">
                      No subscriber logs found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const isActive = (log.status || '').toLowerCase() === 'active';
                    const startTimeFormatted = (() => {
                      try {
                        const d = new Date(log.start_time);
                        if (isNaN(d.getTime())) return log.start_time || '--';
                        return d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
                      } catch {
                        return log.start_time || '--';
                      }
                    })();

                    const protocolColor =
                      (log.protocol || '').toUpperCase() === 'PPPOE'
                        ? 'bg-noc-cyan/10 text-noc-cyan border-noc-cyan/30'
                        : (log.protocol || '').toUpperCase() === 'IPOE'
                          ? 'bg-noc-green/10 text-noc-green border-noc-green/30'
                          : 'bg-noc-amber/10 text-noc-amber border-noc-amber/30';

                    return (
                      <tr
                        key={log.session_id}
                        className={`border-b border-noc-border/20 hover:bg-noc-surface/20 ${
                          isActive ? 'border-l-2 border-l-noc-green' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-noc-cyan text-xs">
                          {log.subscriber_id}
                        </td>
                        <td className="px-3 py-2 font-mono text-noc-text text-xs">
                          {log.ip_address}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-noc-text">
                          {log.mac_address}
                        </td>
                        <td className="px-3 py-2 text-xs text-noc-text">
                          {log.olt_device}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-noc-text">
                          {log.pon_port}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-noc-muted">
                          {startTimeFormatted}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-noc-text text-right">
                          {log.duration_minutes} min
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-noc-text text-right">
                          {formatBytes(log.bytes_down)}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-noc-text text-right">
                          {formatBytes(log.bytes_up)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${protocolColor}`}
                          >
                            {(log.protocol || '').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-noc-green bg-noc-green/10 border border-noc-green/30 px-1.5 py-0.5 rounded">
                              <Wifi className="w-3 h-3" />
                              active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-noc-muted bg-noc-surface/50 border border-noc-border/30 px-1.5 py-0.5 rounded">
                              <WifiOff className="w-3 h-3" />
                              closed
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[10px] text-noc-text">
                          {log.nat_ip}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && (
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-noc-border/20">
            <span className="text-xs text-noc-muted">
              Showing {rangeStart}-{rangeEnd} of {total.toLocaleString()} sessions
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-noc-border/30 text-noc-text hover:bg-noc-surface/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3 h-3" />
                Prev
              </button>
              <button
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(offset + LIMIT)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-noc-border/30 text-noc-text hover:bg-noc-surface/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
