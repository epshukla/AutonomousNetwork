import { motion } from 'framer-motion';
import { Activity, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import type { RoutingAnalysis, BackupPath } from '../../api/simulator';

interface RoutingEfficiencyProps {
  analysis: RoutingAnalysis | null;
  backupPaths: BackupPath[];
}

export default function RoutingEfficiency({ analysis, backupPaths }: RoutingEfficiencyProps) {
  if (!analysis) return null;

  const eff = analysis.efficiency_percent;
  const gaugeColor = eff > 80 ? '#00ff88' : eff > 50 ? '#ffaa00' : '#ff4444';
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (eff / 100) * circumference;

  const activePaths = backupPaths.filter((bp) => bp.status === 'active');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3 }}
      className="absolute top-16 right-4 z-20 glass-card p-4 w-64"
    >
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-noc-cyan" />
        <span className="text-xs font-bold text-noc-text uppercase tracking-wider">Routing Efficiency</span>
      </div>

      {/* Gauge */}
      <div className="flex items-center gap-4 mb-3">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle
              cx="40" cy="40" r="36" fill="none"
              stroke={gaugeColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold font-mono" style={{ color: gaugeColor }}>
              {eff.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-noc-green" />
            <span className="text-noc-muted">Healthy</span>
            <span className="font-mono font-bold text-noc-green ml-auto">{analysis.healthy_paths}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-noc-amber" />
            <span className="text-noc-muted">Rerouted</span>
            <span className="font-mono font-bold text-noc-amber ml-auto">{analysis.rerouted_paths}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-noc-red" />
            <span className="text-noc-muted">Broken</span>
            <span className="font-mono font-bold text-noc-red ml-auto">{analysis.broken_paths}</span>
          </div>
        </div>
      </div>

      {/* Latency */}
      {analysis.avg_latency_increase_ms > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-noc-amber/5 border border-noc-amber/20 mb-2">
          <AlertTriangle className="w-3 h-3 text-noc-amber" />
          <span className="text-[10px] text-noc-amber">
            +{analysis.avg_latency_increase_ms.toFixed(1)}ms avg latency increase
          </span>
        </div>
      )}

      {/* Active Backup Paths */}
      {activePaths.length > 0 && (
        <div className="space-y-1 mt-2">
          <span className="text-[9px] font-bold text-noc-muted uppercase tracking-wider">Active Backups</span>
          {activePaths.map((bp) => (
            <div
              key={bp.original_link}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-noc-cyan/5 border border-noc-cyan/20 text-[9px]"
            >
              <ArrowRightLeft className="w-3 h-3 text-noc-cyan flex-shrink-0" />
              <span className="text-noc-cyan font-mono truncate">{bp.backup_link}</span>
            </div>
          ))}
        </div>
      )}

      {/* Total paths */}
      <div className="mt-2 pt-2 border-t border-noc-border/20 text-[10px] text-noc-muted text-center">
        {analysis.total_paths} total paths monitored
      </div>
    </motion.div>
  );
}
