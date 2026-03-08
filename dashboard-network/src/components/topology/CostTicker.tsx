import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { IndianRupee, Users, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { formatINR, formatINRCompact } from '../../utils/formatINR';
import type { CostImpact } from '../../api/simulator';

interface CostTickerProps {
  costImpact: CostImpact | null;
  isActive: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CostTicker({ costImpact, isActive }: CostTickerProps) {
  const [displayedCost, setDisplayedCost] = useState(0);
  const [displayedDuration, setDisplayedDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const lastServerCost = useRef(0);
  const lastServerTime = useRef(Date.now());
  const costPerSecond = useRef(0);
  const lastServerDuration = useRef(0);
  const rafRef = useRef<number>(0);

  // Update refs when server data arrives
  useEffect(() => {
    if (costImpact) {
      lastServerCost.current = costImpact.total_cost;
      lastServerTime.current = Date.now();
      costPerSecond.current = costImpact.cost_per_second;
      lastServerDuration.current = costImpact.duration_seconds;
    }
  }, [costImpact]);

  // Animation loop for smooth ticking
  useEffect(() => {
    if (!isActive) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const elapsedMs = Date.now() - lastServerTime.current;
      const elapsedSec = elapsedMs / 1000;
      setDisplayedCost(lastServerCost.current + costPerSecond.current * elapsedSec);
      setDisplayedDuration(lastServerDuration.current + elapsedSec);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive]);

  if (!isActive || !costImpact) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="absolute bottom-4 right-4 z-20 glass-card p-0 w-72 overflow-hidden"
    >
      {/* Pulsing red top bar */}
      <div className="h-1 bg-gradient-to-r from-red-600 via-red-400 to-red-600 animate-pulse" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-red-900/40 border border-red-500/30 animate-pulse">
            <IndianRupee className="w-3.5 h-3.5 text-noc-red" />
          </div>
          <span className="text-[10px] font-bold text-noc-red uppercase tracking-widest">Outage Cost</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 text-noc-muted">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-mono">{formatDuration(displayedDuration)}</span>
          </div>
        </div>

        {/* Main cost counter */}
        <div className="text-2xl font-bold font-mono text-noc-red tabular-nums tracking-tight">
          {formatINR(displayedCost)}
        </div>

        {/* Rate */}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-xs font-mono text-noc-amber">
            {formatINRCompact(costImpact.cost_per_second)}/sec
          </span>
          <span className="text-noc-border">|</span>
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3 text-noc-muted" />
            <span className="text-xs font-mono text-noc-text">
              {(costImpact.affected_subscribers || 0).toLocaleString('en-IN')} affected
            </span>
          </div>
        </div>

        {/* Expandable breakdown */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-2 text-[10px] text-noc-muted hover:text-noc-text transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span>Cost Breakdown</span>
        </button>

        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 space-y-1 pt-2 border-t border-noc-border/20"
          >
            <div className="flex justify-between text-[11px]">
              <span className="text-noc-muted">Revenue Loss</span>
              <span className="font-mono text-noc-text">{formatINRCompact(costImpact.revenue_loss)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-noc-muted">SLA Penalty</span>
              <span className={`font-mono ${costImpact.sla_penalty > 0 ? 'text-noc-red' : 'text-noc-muted'}`}>
                {costImpact.sla_penalty > 0 ? formatINRCompact(costImpact.sla_penalty) : '—'}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-noc-muted">Operational</span>
              <span className="font-mono text-noc-text">{formatINRCompact(costImpact.operational_cost)}</span>
            </div>
            {costImpact.sla_penalty === 0 && costImpact.duration_seconds < 3600 && (
              <div className="text-[9px] text-noc-amber mt-1">
                SLA penalty kicks in at 1 hour mark
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
