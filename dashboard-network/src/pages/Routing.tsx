import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Network,
  Globe,
  CheckCircle2,
  Hash,
  ArrowUpDown,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

import { useTopology } from '../hooks/useTelemetry';
import type { BgpSession } from '../api/simulator';

// ── Status Badge ──────────────────────────────────────────

const statusConfig: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  established: {
    bg: 'bg-noc-green/10',
    text: 'text-noc-green',
    border: 'border-noc-green/30',
    dot: 'bg-noc-green',
  },
  idle: {
    bg: 'bg-noc-amber/10',
    text: 'text-noc-amber',
    border: 'border-noc-amber/30',
    dot: 'bg-noc-amber',
  },
  active: {
    bg: 'bg-noc-cyan/10',
    text: 'text-noc-cyan',
    border: 'border-noc-cyan/30',
    dot: 'bg-noc-cyan',
  },
  down: {
    bg: 'bg-noc-red/10',
    text: 'text-noc-red',
    border: 'border-noc-red/30',
    dot: 'bg-noc-red',
  },
};

function BgpStatusBadge({ status }: { status: string }) {
  const normalized = (status || '').toLowerCase();
  const config = statusConfig[normalized] || statusConfig.down;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
        border ${config.bg} ${config.text} ${config.border}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </span>
  );
}

// ── Stat Box ──────────────────────────────────────────────

function StatBox({
  label,
  value,
  icon,
  color,
  delay,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  delay: number;
}) {
  const colorMap: Record<string, { text: string; iconBg: string; iconBorder: string }> = {
    cyan: {
      text: 'text-noc-cyan',
      iconBg: 'bg-noc-cyan/10',
      iconBorder: 'border-noc-cyan/20',
    },
    green: {
      text: 'text-noc-green',
      iconBg: 'bg-noc-green/10',
      iconBorder: 'border-noc-green/20',
    },
    amber: {
      text: 'text-noc-amber',
      iconBg: 'bg-noc-amber/10',
      iconBorder: 'border-noc-amber/20',
    },
  };

  const c = colorMap[color] || colorMap.cyan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass-card p-5 flex items-center gap-4"
    >
      <div className={`p-2.5 rounded-lg border ${c.iconBg} ${c.iconBorder}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-noc-muted uppercase tracking-wider">
          {label}
        </p>
        <p className={`text-2xl font-bold ${c.text} mt-0.5`}>
          {value}
        </p>
      </div>
    </motion.div>
  );
}

// ── Session Row ───────────────────────────────────────────

function SessionRow({
  sessionId,
  session,
  deviceLabel,
  index,
}: {
  sessionId: string;
  session: BgpSession;
  deviceLabel: string;
  index: number;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.6) }}
      className="border-b border-noc-border/20 hover:bg-noc-surface/40 transition-colors"
    >
      {/* Peer Name */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-noc-cyan/60 flex-shrink-0" />
          <span className="text-sm font-medium text-noc-text">
            {session.peer_name || sessionId}
          </span>
        </div>
      </td>

      {/* AS Number */}
      <td className="px-5 py-3.5">
        <span className="font-mono text-sm text-noc-muted">
          AS{session.peer_as}
        </span>
      </td>

      {/* Status */}
      <td className="px-5 py-3.5">
        <BgpStatusBadge status={session.status} />
      </td>

      {/* Prefixes Received */}
      <td className="px-5 py-3.5 text-right">
        <span className="font-mono text-sm text-noc-text">
          {(session.prefixes_received || 0).toLocaleString()}
        </span>
      </td>

      {/* Via Device */}
      <td className="px-5 py-3.5">
        <span className="text-xs font-mono text-noc-muted bg-noc-surface/50 px-2 py-1 rounded">
          {deviceLabel}
        </span>
      </td>

      {/* Flap Count */}
      <td className="px-5 py-3.5 text-right">
        <span
          className={`font-mono text-sm ${
            session.flap_count > 0 ? 'text-noc-amber' : 'text-noc-muted'
          }`}
        >
          {session.flap_count}
        </span>
      </td>
    </motion.tr>
  );
}

// ── Main Routing Page ─────────────────────────────────────

export default function Routing() {
  const { topology, devicesMap, loading, error } = useTopology(5000);

  // Parse BGP sessions into a sorted array
  const sessions = useMemo(() => {
    if (!topology?.bgp_sessions) return [];

    return Object.entries(topology.bgp_sessions)
      .map(([id, session]) => ({ id, ...session }))
      .sort((a, b) => {
        // Established first, then active, idle, down
        const order: Record<string, number> = {
          established: 0,
          active: 1,
          idle: 2,
          down: 3,
        };
        const aOrder = order[(a.status || '').toLowerCase()] ?? 4;
        const bOrder = order[(b.status || '').toLowerCase()] ?? 4;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.peer_name.localeCompare(b.peer_name);
      });
  }, [topology]);

  // Summary stats
  const summary = useMemo(() => {
    const totalSessions = sessions.length;
    const established = sessions.filter(
      (s) => (s.status || '').toLowerCase() === 'established'
    ).length;
    const totalPrefixes = sessions.reduce(
      (sum, s) => sum + (s.prefixes_received || 0),
      0
    );
    return { totalSessions, established, totalPrefixes };
  }, [sessions]);

  // Device label helper
  const getDeviceLabel = (deviceId: string) => {
    const device = devicesMap[deviceId];
    if (device) {
      return `${deviceId} (${device.city || device.type})`;
    }
    return deviceId;
  };

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 rounded-lg bg-noc-cyan/10 border border-noc-cyan/20">
              <Network className="w-5 h-5 text-noc-cyan" />
            </div>
            Routing & BGP
          </h1>
          <p className="text-sm text-noc-muted mt-1 ml-12">
            BGP peering sessions and route table summary
          </p>
        </div>
      </motion.div>

      {/* Loading / Error states */}
      {loading && (
        <div className="glass-card p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-noc-cyan animate-spin" />
          <span className="ml-3 text-noc-muted">Loading routing data...</span>
        </div>
      )}

      {error && !loading && (
        <div className="glass-card p-6 border-noc-red/30 bg-noc-red/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-noc-red" />
            <span className="text-noc-red text-sm">{error}</span>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Route Table Summary */}
          <div className="grid grid-cols-3 gap-4">
            <StatBox
              label="Total Prefixes"
              value={summary.totalPrefixes.toLocaleString()}
              icon={<Hash className="w-5 h-5 text-noc-cyan" />}
              color="cyan"
              delay={0.1}
            />
            <StatBox
              label="Total Sessions"
              value={summary.totalSessions}
              icon={<ArrowUpDown className="w-5 h-5 text-noc-amber" />}
              color="amber"
              delay={0.15}
            />
            <StatBox
              label="Established"
              value={summary.established}
              icon={<CheckCircle2 className="w-5 h-5 text-noc-green" />}
              color="green"
              delay={0.2}
            />
          </div>

          {/* BGP Sessions Table */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="glass-card overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-noc-border/20">
              <h2 className="text-sm font-semibold text-noc-text uppercase tracking-wider">
                BGP Peering Sessions
              </h2>
            </div>

            {sessions.length === 0 ? (
              <div className="p-12 text-center">
                <Network className="w-10 h-10 text-noc-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-noc-muted">
                  No BGP sessions found
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-noc-surface/30 text-left">
                      <th className="px-5 py-3 text-xs font-semibold text-noc-muted uppercase tracking-wider">
                        Peer Name
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-noc-muted uppercase tracking-wider">
                        AS Number
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-noc-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-noc-muted uppercase tracking-wider text-right">
                        Prefixes Received
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-noc-muted uppercase tracking-wider">
                        Via Device
                      </th>
                      <th className="px-5 py-3 text-xs font-semibold text-noc-muted uppercase tracking-wider text-right">
                        Flap Count
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session, index) => (
                      <SessionRow
                        key={session.id}
                        sessionId={session.id}
                        session={session}
                        deviceLabel={getDeviceLabel(session.device_id)}
                        index={index}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
