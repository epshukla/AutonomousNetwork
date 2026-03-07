import React from 'react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  status?: 'normal' | 'degraded' | 'critical';
  deviation?: number | null;
  compact?: boolean;
}

const statusColors = {
  normal: 'text-emerald-400',
  degraded: 'text-amber-400',
  critical: 'text-red-400',
};

const statusBorders = {
  normal: 'border-emerald-400/20',
  degraded: 'border-amber-400/20',
  critical: 'border-red-400/20',
};

const statusGlows = {
  normal: '',
  degraded: 'glow-amber',
  critical: 'glow-red',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  icon,
  status = 'normal',
  deviation,
  compact = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass-card p-${compact ? '3' : '4'} ${statusBorders[status]} ${statusGlows[status]}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-noc-muted uppercase tracking-wider font-medium">{label}</span>
        {icon && <span className={`${statusColors[status]}`}>{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-${compact ? '2xl' : '3xl'} font-bold ${statusColors[status]} tabular-nums`}>
          {typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        {unit && <span className="text-sm text-noc-muted">{unit}</span>}
      </div>
      {deviation !== undefined && deviation !== null && (
        <div className="mt-1">
          <span
            className={`text-xs font-mono ${
              deviation > 0 ? 'text-red-400' : deviation < 0 ? 'text-emerald-400' : 'text-noc-muted'
            }`}
          >
            {deviation > 0 ? '+' : ''}
            {deviation.toFixed(1)}% from baseline
          </span>
        </div>
      )}
    </motion.div>
  );
};

export default MetricCard;
