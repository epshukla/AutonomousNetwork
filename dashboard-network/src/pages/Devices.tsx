import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Router,
  Globe,
  Layers,
  Radio,
  Thermometer,
  Clock,
  Cpu,
  MemoryStick,
  Network,
  Users,
  ChevronDown,
  ChevronUp,
  Plug,
  Fan,
  ArrowRightLeft,
  CircleDot,
  Server,
} from 'lucide-react';

import { useTopology, useWSTelemetry } from '../hooks/useTelemetry';
import type { DeviceData, LinkData } from '../api/simulator';

// ── Constants ────────────────────────────────────────────────

type DeviceType = 'core_router' | 'edge_router' | 'aggregation_router' | 'peering_router' | 'olt';

const DEVICE_TYPE_ICONS: Record<string, React.ElementType> = {
  core_router: Router,
  edge_router: Router,
  aggregation_router: Layers,
  peering_router: Globe,
  olt: Radio,
};

const DEVICE_TYPE_LABELS: Record<string, string> = {
  core_router: 'Core Router',
  edge_router: 'Edge Router',
  aggregation_router: 'Aggregation Router',
  peering_router: 'Peering Router',
  olt: 'OLT',
};

const FILTER_TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'core_router', label: 'Core Router' },
  { key: 'aggregation_router', label: 'Aggregation Router' },
  { key: 'edge_router', label: 'Edge Router' },
  { key: 'olt', label: 'OLT' },
  { key: 'peering_router', label: 'Peering Router' },
];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  healthy: {
    label: 'Healthy',
    bg: 'bg-noc-green/10',
    text: 'text-noc-green',
    dot: 'bg-noc-green',
    border: 'border-noc-green/30',
  },
  degraded: {
    label: 'Degraded',
    bg: 'bg-noc-amber/10',
    text: 'text-noc-amber',
    dot: 'bg-noc-amber',
    border: 'border-noc-amber/30',
  },
  critical: {
    label: 'Critical',
    bg: 'bg-noc-red/10',
    text: 'text-noc-red',
    dot: 'bg-noc-red',
    border: 'border-noc-red/30',
  },
  down: {
    label: 'Down',
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    dot: 'bg-gray-500',
    border: 'border-gray-500/30',
  },
};

// ── Helpers ──────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function friendlyName(deviceId: string): string {
  return deviceId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Progress Bar ─────────────────────────────────────────────

function ProgressBar({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  const clamped = Math.min(Math.max(value || 0, 0), 100);
  const barColor =
    clamped > 90 ? 'bg-noc-red' : clamped > 70 ? 'bg-noc-amber' : 'bg-noc-cyan';

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 w-12 shrink-0">
        {icon}
        <span className="text-[10px] text-noc-muted font-medium">{label}</span>
      </div>
      <div className="flex-1 h-2 bg-noc-bg/80 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono text-noc-text w-10 text-right">
        {clamped.toFixed(1)}%
      </span>
    </div>
  );
}

// ── Device Card ──────────────────────────────────────────────

interface DeviceCardProps {
  device: DeviceData;
  connectedLinks: LinkData[];
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  wsCpu?: number;
  wsMem?: number;
  wsTemp?: number;
  wsStatus?: string;
  wsUptime?: number;
}

function DeviceCard({
  device,
  connectedLinks,
  index,
  isExpanded,
  onToggle,
  wsCpu,
  wsMem,
  wsTemp,
  wsStatus,
  wsUptime,
}: DeviceCardProps) {
  const Icon = DEVICE_TYPE_ICONS[device.type] || Server;
  const typeLabel = DEVICE_TYPE_LABELS[device.type] || device.type.replace(/_/g, ' ');

  // Use WS values if available, fallback to topology
  const cpu = wsCpu ?? device.cpu_utilization ?? 0;
  const mem = wsMem ?? device.memory_utilization ?? 0;
  const temp = wsTemp ?? device.temperature_celsius ?? 0;
  const status = (wsStatus ?? device.status ?? 'down') as keyof typeof STATUS_CONFIG;
  const uptime = wsUptime ?? device.uptime_seconds ?? 0;

  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG.down;

  const tempColor =
    temp > 80 ? 'text-noc-red' : temp > 65 ? 'text-noc-amber' : 'text-noc-green';

  const powerOk = device.power_status === 'ok' || device.power_status === 'normal';
  const fanOk = device.fan_status === 'ok' || device.fan_status === 'normal';
  const psuActive = device.psu_active ?? 0;
  const psuCount = device.psu_count ?? 0;

  const interfaceCount = device.interfaces?.length ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.97 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
      className="glass-card overflow-hidden"
    >
      {/* Main card content */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-white/[0.02] transition-colors"
      >
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg border ${
                status === 'healthy'
                  ? 'bg-noc-cyan/10 border-noc-cyan/20'
                  : status === 'degraded'
                  ? 'bg-noc-amber/10 border-noc-amber/20'
                  : status === 'critical'
                  ? 'bg-noc-red/10 border-noc-red/20'
                  : 'bg-gray-500/10 border-gray-500/20'
              }`}
            >
              <Icon
                className={`w-5 h-5 ${
                  status === 'healthy'
                    ? 'text-noc-cyan'
                    : status === 'degraded'
                    ? 'text-noc-amber'
                    : status === 'critical'
                    ? 'text-noc-red'
                    : 'text-gray-400'
                }`}
              />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">
                {friendlyName(device.device_id)}
              </h3>
              <p className="text-[10px] text-noc-muted mt-0.5">
                {device.vendor && device.model
                  ? `${device.vendor} ${device.model}`
                  : typeLabel}
                {device.city ? ` \u2014 ${device.city}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${statusConf.dot} ${
                  status === 'healthy' ? 'animate-pulse-glow' : ''
                }`}
              />
              {statusConf.label}
            </span>

            {/* Expand indicator */}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-noc-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-noc-muted" />
            )}
          </div>
        </div>

        {/* CPU + Memory bars */}
        <div className="space-y-1.5 mb-3">
          <ProgressBar
            label="CPU"
            value={cpu}
            icon={<Cpu className="w-3 h-3 text-noc-muted" />}
          />
          <ProgressBar
            label="MEM"
            value={mem}
            icon={<MemoryStick className="w-3 h-3 text-noc-muted" />}
          />
        </div>

        {/* Bottom metrics row */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5">
          {/* Temperature */}
          <div className="flex items-center gap-1">
            <Thermometer className={`w-3 h-3 ${tempColor}`} />
            <span className={`text-xs font-mono font-semibold ${tempColor}`}>
              {temp.toFixed(1)}&deg;C
            </span>
          </div>

          {/* Power/PSU */}
          {psuCount > 0 && (
            <div className="flex items-center gap-1">
              <Plug className={`w-3 h-3 ${powerOk ? 'text-noc-green' : 'text-noc-red'}`} />
              <span
                className={`text-[10px] font-mono font-semibold ${
                  powerOk ? 'text-noc-green' : 'text-noc-red'
                }`}
              >
                {psuActive}/{psuCount} PSU
              </span>
            </div>
          )}

          {/* Fan */}
          {(device.fan_count ?? 0) > 0 && (
            <div className="flex items-center gap-1">
              <Fan className={`w-3 h-3 ${fanOk ? 'text-noc-green' : 'text-noc-red'}`} />
              <span
                className={`text-[10px] font-mono font-semibold ${
                  fanOk ? 'text-noc-green' : 'text-noc-red'
                }`}
              >
                {fanOk ? 'OK' : 'FAIL'}
              </span>
            </div>
          )}

          {/* Interfaces */}
          {interfaceCount > 0 && (
            <div className="flex items-center gap-1">
              <Network className="w-3 h-3 text-noc-muted" />
              <span className="text-[10px] font-mono text-noc-text">
                {interfaceCount} intf
              </span>
            </div>
          )}

          {/* Subscribers (OLT only) */}
          {device.type === 'olt' && device.subscribers != null && (
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-noc-cyan" />
              <span className="text-[10px] font-mono text-noc-cyan font-semibold">
                {device.subscribers.toLocaleString()} subs
              </span>
            </div>
          )}

          {/* Uptime - always show, pushed to right */}
          <div className="flex items-center gap-1 ml-auto">
            <Clock className="w-3 h-3 text-noc-muted" />
            <span className="text-[10px] font-mono text-noc-text">
              {formatUptime(uptime)}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded detail: connected links */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 border-t border-noc-border/30">
              <h4 className="text-xs font-semibold text-noc-muted uppercase tracking-wider mb-2 mt-2">
                Connected Links &amp; Interfaces
              </h4>

              {connectedLinks.length === 0 ? (
                <p className="text-xs text-noc-muted/60 italic">No connected links found</p>
              ) : (
                <div className="space-y-1.5">
                  {connectedLinks.map((link) => {
                    const isSource = link.from === device.device_id;
                    const peer = isSource ? link.to : link.from;
                    const iface = isSource ? link.interface_from : link.interface_to;

                    const linkStatusColor =
                      link.status === 'up'
                        ? 'text-noc-green'
                        : link.status === 'degraded'
                        ? 'text-noc-amber'
                        : 'text-noc-red';

                    const linkStatusBg =
                      link.status === 'up'
                        ? 'bg-noc-green/10 border-noc-green/20'
                        : link.status === 'degraded'
                        ? 'bg-noc-amber/10 border-noc-amber/20'
                        : 'bg-noc-red/10 border-noc-red/20';

                    return (
                      <div
                        key={link.link_id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${linkStatusBg}`}
                      >
                        <ArrowRightLeft className={`w-3.5 h-3.5 shrink-0 ${linkStatusColor}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-noc-text truncate">
                              {friendlyName(peer)}
                            </span>
                            {iface && (
                              <span className="text-[9px] font-mono text-noc-muted bg-noc-surface/60 px-1.5 py-0.5 rounded">
                                {iface}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] text-noc-muted capitalize">
                            {link.type.replace(/_/g, ' ')} &middot; {link.capacity_gbps} Gbps
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] font-mono text-noc-text block">
                              {(link.utilization_percent || 0).toFixed(1)}%
                            </span>
                            <span className="text-[8px] text-noc-muted">util</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-mono text-noc-text block">
                              {(link.latency_ms || 0).toFixed(1)}ms
                            </span>
                            <span className="text-[8px] text-noc-muted">latency</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-mono text-noc-text block">
                              {(link.throughput_gbps || 0).toFixed(2)}
                            </span>
                            <span className="text-[8px] text-noc-muted">Gbps</span>
                          </div>
                          <CircleDot className={`w-3 h-3 ${linkStatusColor}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function Devices() {
  const { devices, links, loading } = useTopology(5000);
  const { latestTelemetry } = useWSTelemetry(60);

  const [activeFilter, setActiveFilter] = useState('all');
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);

  // Build a map of device_id -> connected links
  const connectedLinksMap = useMemo(() => {
    const map: Record<string, LinkData[]> = {};
    for (const link of links) {
      if (!map[link.from]) map[link.from] = [];
      if (!map[link.to]) map[link.to] = [];
      map[link.from].push(link);
      map[link.to].push(link);
    }
    return map;
  }, [links]);

  // Filter devices
  const filteredDevices = useMemo(() => {
    const sorted = [...devices].sort((a, b) => {
      // Sort: critical > degraded > down > healthy for visibility
      const order: Record<string, number> = { critical: 0, down: 1, degraded: 2, healthy: 3 };
      const oa = order[a.status] ?? 4;
      const ob = order[b.status] ?? 4;
      if (oa !== ob) return oa - ob;
      return a.device_id.localeCompare(b.device_id);
    });

    if (activeFilter === 'all') return sorted;
    return sorted.filter((d) => d.type === activeFilter);
  }, [devices, activeFilter]);

  // Status counts for filter tabs
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: devices.length };
    for (const d of devices) {
      counts[d.type] = (counts[d.type] || 0) + 1;
    }
    return counts;
  }, [devices]);

  const handleToggle = (deviceId: string) => {
    setExpandedDeviceId((prev) => (prev === deviceId ? null : deviceId));
  };

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <h1 className="text-2xl font-bold text-white">Device Health Grid</h1>
        <p className="text-sm text-noc-muted mt-1">
          Real-time health monitoring for all network devices
        </p>
      </motion.div>

      {/* Filter tabs */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        {FILTER_TABS.map((tab) => {
          const count = typeCounts[tab.key] || 0;
          const isActive = activeFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
                border
                ${
                  isActive
                    ? 'bg-noc-cyan/15 border-noc-cyan/40 text-noc-cyan shadow-[0_0_12px_rgba(0,212,255,0.15)]'
                    : 'bg-noc-surface/40 border-noc-border/30 text-noc-muted hover:text-noc-text hover:border-noc-border/60'
                }
              `}
            >
              {tab.label}
              <span
                className={`ml-1.5 font-mono text-[10px] ${
                  isActive ? 'text-noc-cyan/80' : 'text-noc-muted/60'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Loading state */}
      {loading && devices.length === 0 && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
            <span className="text-sm text-noc-muted">Loading devices...</span>
          </div>
        </div>
      )}

      {/* Device grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredDevices.map((device, i) => {
            const wsDevice = latestTelemetry?.devices?.[device.device_id];
            return (
              <DeviceCard
                key={device.device_id}
                device={device}
                connectedLinks={connectedLinksMap[device.device_id] || []}
                index={i}
                isExpanded={expandedDeviceId === device.device_id}
                onToggle={() => handleToggle(device.device_id)}
                wsCpu={wsDevice?.cpu_utilization}
                wsMem={wsDevice?.memory_utilization}
                wsTemp={wsDevice?.temperature_celsius}
                wsStatus={wsDevice?.status}
                wsUptime={wsDevice?.uptime_seconds}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {!loading && filteredDevices.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <Server className="w-10 h-10 text-noc-muted/40 mb-3" />
          <p className="text-sm text-noc-muted">
            No devices found for the selected filter.
          </p>
        </motion.div>
      )}
    </div>
  );
}
