import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Info,
  AlertTriangle,
  AlertOctagon,
  XCircle,
  Filter,
  Radio,
  ArrowDown,
  Pause,
  Play,
  CheckCircle,
} from 'lucide-react';

import { useEvents } from '../hooks/useTelemetry';
import type { NetworkEvent } from '../api/simulator';
import { formatTimeOnly } from '../utils/formatTimestamp';

// ── Severity Config ───────────────────────────────────────

const severityConfig: Record<
  string,
  {
    icon: React.ElementType;
    color: string;
    bg: string;
    border: string;
    glow: string;
    label: string;
    badgeColor: string;
  }
> = {
  info: {
    icon: Info,
    color: 'text-noc-cyan',
    bg: 'bg-noc-cyan/5',
    border: 'border-noc-cyan/20',
    glow: '',
    label: 'INFO',
    badgeColor: 'bg-noc-cyan/20 text-noc-cyan border-noc-cyan/30',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-noc-amber',
    bg: 'bg-noc-amber/5',
    border: 'border-noc-amber/20',
    glow: 'shadow-amber-glow',
    label: 'WARN',
    badgeColor: 'bg-noc-amber/20 text-noc-amber border-noc-amber/30',
  },
  error: {
    icon: AlertOctagon,
    color: 'text-noc-red',
    bg: 'bg-noc-red/5',
    border: 'border-noc-red/20',
    glow: 'shadow-red-glow',
    label: 'ERROR',
    badgeColor: 'bg-noc-red/20 text-noc-red border-noc-red/30',
  },
  critical: {
    icon: XCircle,
    color: 'text-noc-red',
    bg: 'bg-noc-red/10',
    border: 'border-noc-red/30',
    glow: 'shadow-red-glow',
    label: 'CRIT',
    badgeColor: 'bg-noc-red/20 text-noc-red border-noc-red/30',
  },
};

// ── Duration Formatter ───────────────────────────────────

function formatDuration(timestamp: string | undefined): string {
  if (!timestamp) return '--';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '--';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'just now';
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

// ── Alert Row Component ──────────────────────────────────

interface AlertRowProps {
  event: NetworkEvent;
  index: number;
  isAcknowledged: boolean;
  onAcknowledge: () => void;
}

function AlertRow({ event, index, isAcknowledged, onAcknowledge }: AlertRowProps) {
  const config = severityConfig[event.severity] || severityConfig.info;
  const Icon = config.icon;

  const ts = event.timestamp || '';
  const timestamp = formatTimeOnly(ts);
  const [duration, setDuration] = useState(() => formatDuration(ts));

  // Update duration every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setDuration(formatDuration(ts));
    }, 10_000);
    return () => clearInterval(interval);
  }, [ts]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ duration: 0.3, delay: index < 5 ? index * 0.05 : 0 }}
      className={`
        border-l-2 ${config.border} ${config.bg}
        rounded-r-lg p-4 transition-all duration-200
        hover:bg-opacity-100 group
        ${isAcknowledged ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        {/* Severity Icon */}
        <div
          className={`
            p-2 rounded-lg border flex-shrink-0
            ${config.bg} ${config.border}
          `}
        >
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Severity badge */}
            <span
              className={`
                text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
                ${config.bg} ${config.color} ${config.border} border
              `}
            >
              {config.label}
            </span>

            {/* Event type */}
            <span
              className={`text-xs font-semibold text-noc-text capitalize ${
                isAcknowledged ? 'line-through' : ''
              }`}
            >
              {event.event_type?.replace(/_/g, ' ') || 'Alert'}
            </span>

            {/* Source device */}
            <span className="text-xs text-noc-muted font-mono bg-noc-surface/50 px-1.5 py-0.5 rounded">
              {event.source}
            </span>
          </div>

          {/* Description */}
          <p
            className={`text-sm text-noc-muted group-hover:text-noc-text transition-colors line-clamp-2 ${
              isAcknowledged ? 'line-through' : ''
            }`}
          >
            {event.description}
          </p>
        </div>

        {/* Duration */}
        <div className="text-right flex-shrink-0 min-w-[70px]">
          <p className="text-xs font-mono text-noc-muted">{timestamp}</p>
          <p className="text-[10px] text-noc-cyan/70 mt-0.5">{duration}</p>
        </div>

        {/* Acknowledge Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAcknowledge();
          }}
          className={`
            flex-shrink-0 p-1.5 rounded-lg border transition-all duration-200
            ${
              isAcknowledged
                ? 'bg-noc-green/10 border-noc-green/30 text-noc-green cursor-default'
                : 'bg-noc-surface/30 border-noc-border/50 text-noc-muted hover:text-noc-green hover:border-noc-green/30 hover:bg-noc-green/10 cursor-pointer'
            }
          `}
          title={isAcknowledged ? 'Acknowledged' : 'Acknowledge alert'}
          disabled={isAcknowledged}
        >
          <CheckCircle className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Filter Bar ────────────────────────────────────────────

const SEVERITY_FILTERS = [
  { value: 'all', label: 'All', color: 'text-noc-text' },
  { value: 'critical', label: 'Critical', color: 'text-noc-red' },
  { value: 'error', label: 'Error', color: 'text-noc-red' },
  { value: 'warning', label: 'Warning', color: 'text-noc-amber' },
  { value: 'info', label: 'Info', color: 'text-noc-cyan' },
];

// ── Summary Badge Component ──────────────────────────────

function SeverityBadge({
  severity,
  count,
}: {
  severity: string;
  count: number;
}) {
  const config = severityConfig[severity];
  if (!config || count === 0) return null;
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${config.badgeColor}`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="font-bold">{count}</span>
      <span className="opacity-70 capitalize">{severity}</span>
    </div>
  );
}

// ── Main Alerts Page ──────────────────────────────────────

export default function Alerts() {
  const { events, isConnected } = useEvents(500);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate a stable key for an event
  const eventKey = useCallback(
    (event: NetworkEvent, index: number) =>
      event.id != null ? String(event.id) : `${event.timestamp}-${event.source}-${index}`,
    []
  );

  // Auto-scroll to top (newest) when new events come in
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length, autoScroll]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (severityFilter === 'all') return events;
    return events.filter((e) => e.severity === severityFilter);
  }, [events, severityFilter]);

  // Severity counts
  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: events.length,
      critical: 0,
      error: 0,
      warning: 0,
      info: 0,
    };
    events.forEach((e) => {
      if (e.severity in counts) counts[e.severity]++;
    });
    return counts;
  }, [events]);

  // Toggle acknowledge
  const toggleAcknowledge = useCallback(
    (key: string) => {
      setAcknowledged((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });
    },
    []
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Alerts</h1>
            <p className="text-sm text-noc-muted mt-1">
              Real-time network alerts
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                autoScroll
                  ? 'bg-noc-cyan/10 border-noc-cyan/30 text-noc-cyan'
                  : 'bg-noc-surface/30 border-noc-border/50 text-noc-muted hover:text-noc-text'
              }`}
            >
              {autoScroll ? (
                <Play className="w-3 h-3" />
              ) : (
                <Pause className="w-3 h-3" />
              )}
              Auto-scroll
            </button>

            {/* Connection status */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                isConnected
                  ? 'bg-noc-green/10 border-noc-green/30 text-noc-green'
                  : 'bg-noc-amber/10 border-noc-amber/30 text-noc-amber'
              }`}
            >
              <Radio
                className={`w-3 h-3 ${isConnected ? 'animate-pulse-glow' : ''}`}
              />
              {isConnected ? 'Live' : 'Polling'}
            </div>
          </div>
        </div>

        {/* Alert Summary Bar */}
        <div className="glass-card p-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-noc-muted font-medium uppercase tracking-wider mr-1">
              Summary
            </span>
            <SeverityBadge severity="critical" count={severityCounts.critical} />
            <SeverityBadge severity="error" count={severityCounts.error} />
            <SeverityBadge severity="warning" count={severityCounts.warning} />
            <SeverityBadge severity="info" count={severityCounts.info} />
            {events.length === 0 && (
              <span className="text-xs text-noc-muted">No alerts</span>
            )}
            <span className="ml-auto text-xs text-noc-muted">
              {events.length} total
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="glass-card p-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-noc-muted flex-shrink-0" />
            <div className="flex gap-1">
              {SEVERITY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setSeverityFilter(filter.value)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                    flex items-center gap-1.5
                    ${
                      severityFilter === filter.value
                        ? `bg-noc-surface/80 ${filter.color} border border-noc-border/50`
                        : 'text-noc-muted hover:text-noc-text hover:bg-noc-surface/30'
                    }
                  `}
                >
                  {filter.label}
                  <span
                    className={`
                      text-[10px] px-1.5 py-0.5 rounded-full font-bold
                      ${
                        severityFilter === filter.value
                          ? 'bg-noc-cyan/20'
                          : 'bg-noc-surface/50'
                      }
                    `}
                  >
                    {severityCounts[filter.value] || 0}
                  </span>
                </button>
              ))}
            </div>

            <span className="ml-auto text-xs text-noc-muted">
              {filteredEvents.length} alerts
            </span>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 pb-6"
        onScroll={() => {
          if (scrollRef.current && scrollRef.current.scrollTop > 100) {
            // User scrolled away from top
          }
        }}
      >
        {filteredEvents.length === 0 ? (
          <div className="glass-card p-12 flex items-center justify-center">
            <div className="text-center">
              <Bell className="w-12 h-12 text-noc-muted mx-auto mb-3 opacity-50" />
              <p className="text-noc-muted text-sm">
                {events.length === 0
                  ? 'Waiting for alerts...'
                  : 'No alerts match the current filter'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredEvents.map((event, index) => {
                const key = eventKey(event, index);
                return (
                  <AlertRow
                    key={key}
                    event={event}
                    index={index}
                    isAcknowledged={acknowledged.has(key)}
                    onAcknowledge={() => toggleAcknowledge(key)}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Scroll to top button */}
      {!autoScroll && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          onClick={() => {
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
          }}
          className="fixed bottom-6 right-6 p-3 rounded-full bg-noc-cyan/20 border border-noc-cyan/30 text-noc-cyan hover:bg-noc-cyan/30 transition-colors shadow-noc-glow z-20"
        >
          <ArrowDown className="w-5 h-5 rotate-180" />
        </motion.button>
      )}
    </div>
  );
}
