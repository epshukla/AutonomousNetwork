import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Network,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Loader2,
  AlertTriangle,
  Cable,
} from 'lucide-react';

import { useTopology } from '../hooks/useTelemetry';
import { getInterfaces, type InterfaceStats } from '../api/simulator';

// ── Helpers ───────────────────────────────────────────────

type SortKey = keyof Pick<
  InterfaceStats,
  'interface' | 'speed_gbps' | 'utilization_percent' | 'in_bps' | 'out_bps' | 'in_errors' | 'out_errors' | 'status' | 'connected_to'
>;

type SortDir = 'asc' | 'desc';

function formatBps(bps: number): string {
  if (bps >= 1e9) return `${(bps / 1e9).toFixed(2)} Gbps`;
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(2)} Mbps`;
  return `${Math.round(bps / 1000)} Kbps`;
}

function utilColor(pct: number): string {
  if (pct > 90) return 'bg-noc-red/10 border-l-noc-red';
  if (pct >= 70) return 'bg-noc-amber/10 border-l-noc-amber';
  return 'bg-noc-green/5 border-l-noc-green';
}

function comparePrimitive(a: unknown, b: unknown, dir: SortDir): number {
  const av = a ?? '';
  const bv = b ?? '';
  if (typeof av === 'number' && typeof bv === 'number') {
    return dir === 'asc' ? av - bv : bv - av;
  }
  const sa = String(av).toLowerCase();
  const sb = String(bv).toLowerCase();
  if (sa < sb) return dir === 'asc' ? -1 : 1;
  if (sa > sb) return dir === 'asc' ? 1 : -1;
  return 0;
}

// ── Column Definition ─────────────────────────────────────

interface ColumnDef {
  key: SortKey;
  label: string;
  mono?: boolean;
  align?: 'left' | 'right' | 'center';
  render: (row: InterfaceStats) => React.ReactNode;
  sortValue: (row: InterfaceStats) => string | number;
}

const columns: ColumnDef[] = [
  {
    key: 'interface',
    label: 'Interface',
    align: 'left',
    render: (r) => (
      <span className="font-semibold text-noc-text">{r.interface}</span>
    ),
    sortValue: (r) => r.interface,
  },
  {
    key: 'speed_gbps',
    label: 'Speed',
    mono: true,
    align: 'right',
    render: (r) => (
      <span className="text-noc-muted">
        {r.speed_gbps >= 1
          ? `${r.speed_gbps} Gbps`
          : `${(r.speed_gbps * 1000).toFixed(0)} Mbps`}
      </span>
    ),
    sortValue: (r) => r.speed_gbps,
  },
  {
    key: 'utilization_percent',
    label: 'Util%',
    mono: true,
    align: 'right',
    render: (r) => {
      const pct = r.utilization_percent;
      const color =
        pct > 90 ? 'text-noc-red' : pct >= 70 ? 'text-noc-amber' : 'text-noc-green';
      return <span className={`font-bold ${color}`}>{pct.toFixed(1)}%</span>;
    },
    sortValue: (r) => r.utilization_percent,
  },
  {
    key: 'in_bps',
    label: 'In (bps)',
    mono: true,
    align: 'right',
    render: (r) => <span className="text-noc-cyan">{formatBps(r.in_bps)}</span>,
    sortValue: (r) => r.in_bps,
  },
  {
    key: 'out_bps',
    label: 'Out (bps)',
    mono: true,
    align: 'right',
    render: (r) => <span className="text-noc-text">{formatBps(r.out_bps)}</span>,
    sortValue: (r) => r.out_bps,
  },
  {
    key: 'in_errors',
    label: 'Errors',
    mono: true,
    align: 'right',
    render: (r) => {
      const total = r.in_errors + r.out_errors;
      const color = total > 0 ? 'text-noc-red' : 'text-noc-muted';
      return (
        <span className={color}>
          {total > 0 ? total.toLocaleString() : '0'}
        </span>
      );
    },
    sortValue: (r) => r.in_errors + r.out_errors,
  },
  {
    key: 'status',
    label: 'Status',
    align: 'center',
    render: (r) => {
      const isUp = r.status === 'up';
      return (
        <span
          className={`
            inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border
            ${
              isUp
                ? 'bg-noc-green/15 text-noc-green border-noc-green/30'
                : 'bg-noc-red/15 text-noc-red border-noc-red/30'
            }
          `}
        >
          {r.status}
        </span>
      );
    },
    sortValue: (r) => r.status,
  },
  {
    key: 'connected_to',
    label: 'Connected To',
    align: 'left',
    render: (r) =>
      r.connected_to ? (
        <span className="text-noc-text text-xs">{r.connected_to}</span>
      ) : (
        <span className="text-noc-muted/40 text-xs italic">--</span>
      ),
    sortValue: (r) => r.connected_to || '',
  },
];

// ── Sort Header ───────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 text-noc-muted/40 ml-1" />;
  return dir === 'asc' ? (
    <ChevronUp className="w-3.5 h-3.5 text-noc-cyan ml-1" />
  ) : (
    <ChevronDown className="w-3.5 h-3.5 text-noc-cyan ml-1" />
  );
}

// ── Main Page ─────────────────────────────────────────────

export default function Interfaces() {
  const { devices } = useTopology(15000);

  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [interfaces, setInterfaces] = useState<InterfaceStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('interface');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Auto-select first device
  const activeDevice = selectedDevice || (devices.length > 0 ? devices[0].device_id : '');

  // Fetch interfaces on device change, poll every 5s
  const fetchInterfaces = useCallback(async (deviceId: string) => {
    try {
      const result = await getInterfaces(deviceId);
      setInterfaces(result.interfaces || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch interfaces');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeDevice) {
      setInterfaces([]);
      setLoading(false);
      return;
    }

    let mounted = true;

    const poll = async () => {
      if (!mounted) return;
      try {
        const result = await getInterfaces(activeDevice);
        if (mounted) {
          setInterfaces(result.interfaces || []);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch interfaces');
          setLoading(false);
        }
      }
    };

    setLoading(true);
    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [activeDevice]);

  // Sort
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedInterfaces = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return interfaces;
    return [...interfaces].sort((a, b) =>
      comparePrimitive(col.sortValue(a), col.sortValue(b), sortDir)
    );
  }, [interfaces, sortKey, sortDir]);

  // Device options
  const deviceOptions = useMemo(
    () =>
      devices.map((d) => ({
        value: d.device_id,
        label: `${d.device_id} (${d.city})`,
      })),
    [devices]
  );

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Interface Monitoring</h1>
          <p className="text-sm text-noc-muted mt-1">
            Per-interface telemetry and status
          </p>
        </div>
      </div>

      {/* Device Selector */}
      <div className="glass-card p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-sm">
            <label className="text-[10px] uppercase tracking-wider text-noc-muted font-semibold block mb-1">
              Device
            </label>
            <div className="relative">
              <select
                value={activeDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="appearance-none w-full glass-card px-3 py-2 pr-8 text-sm text-noc-text bg-noc-surface/50 border border-noc-border/50 rounded-lg focus:outline-none focus:border-noc-cyan/50 cursor-pointer"
              >
                {deviceOptions.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    className="bg-noc-bg text-noc-text"
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-noc-muted pointer-events-none" />
            </div>
          </div>

          {/* Interface count */}
          <div className="flex items-center gap-2 ml-auto">
            <Cable className="w-4 h-4 text-noc-cyan" />
            <span className="text-xs text-noc-muted">
              <span className="text-noc-cyan font-bold">{interfaces.length}</span>{' '}
              interfaces
            </span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-noc-cyan animate-spin mr-3" />
          <span className="text-noc-muted text-sm">Loading interfaces...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="glass-card p-6 border border-noc-red/30 bg-noc-red/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-noc-red flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-noc-red">Error fetching interfaces</p>
              <p className="text-xs text-noc-muted mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && activeDevice && interfaces.length === 0 && (
        <div className="glass-card p-12 flex items-center justify-center">
          <div className="text-center">
            <Network className="w-12 h-12 text-noc-muted mx-auto mb-3 opacity-50" />
            <p className="text-noc-muted text-sm">
              No interfaces found for {activeDevice}
            </p>
          </div>
        </div>
      )}

      {/* No device state */}
      {!activeDevice && !loading && (
        <div className="glass-card p-12 flex items-center justify-center">
          <div className="text-center">
            <Network className="w-12 h-12 text-noc-muted mx-auto mb-3 opacity-50" />
            <p className="text-noc-muted text-sm">Select a device to view interfaces</p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && interfaces.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-noc-border/30">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`
                        px-4 py-3 text-[10px] uppercase tracking-wider font-semibold text-noc-muted
                        cursor-pointer select-none hover:text-noc-cyan transition-colors
                        ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                      `}
                    >
                      <span className="inline-flex items-center">
                        {col.label}
                        <SortIcon active={sortKey === col.key} dir={sortDir} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedInterfaces.map((iface, idx) => (
                  <motion.tr
                    key={iface.interface}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.3) }}
                    className={`
                      border-l-2 border-b border-noc-border/10
                      ${utilColor(iface.utilization_percent)}
                      hover:bg-white/[0.03] transition-colors
                    `}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`
                          px-4 py-3
                          ${col.mono ? 'font-mono' : ''}
                          ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
                        `}
                      >
                        {col.render(iface)}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          <div className="border-t border-noc-border/20 px-4 py-3 flex items-center justify-between text-xs text-noc-muted">
            <div className="flex items-center gap-4">
              <span>
                Up:{' '}
                <span className="text-noc-green font-bold">
                  {interfaces.filter((i) => i.status === 'up').length}
                </span>
              </span>
              <span>
                Down:{' '}
                <span className="text-noc-red font-bold">
                  {interfaces.filter((i) => i.status !== 'up').length}
                </span>
              </span>
              <span>
                Errors:{' '}
                <span
                  className={`font-bold ${
                    interfaces.reduce((s, i) => s + i.in_errors + i.out_errors, 0) > 0
                      ? 'text-noc-red'
                      : 'text-noc-muted'
                  }`}
                >
                  {interfaces
                    .reduce((s, i) => s + i.in_errors + i.out_errors, 0)
                    .toLocaleString()}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-noc-green/60" />
                &lt;70%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-noc-amber/60" />
                70-90%
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-noc-red/60" />
                &gt;90%
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
