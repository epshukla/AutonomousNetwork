import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color?: 'cyan' | 'green' | 'red' | 'amber' | 'purple';
  glowing?: boolean;
}

const colorMap = {
  cyan: {
    icon: 'text-noc-cyan',
    bg: 'bg-noc-cyan/10',
    border: 'border-noc-cyan/20',
    glow: 'glow-cyan',
    value: 'text-noc-cyan',
  },
  green: {
    icon: 'text-noc-green',
    bg: 'bg-noc-green/10',
    border: 'border-noc-green/20',
    glow: 'glow-green',
    value: 'text-noc-green',
  },
  red: {
    icon: 'text-noc-red',
    bg: 'bg-noc-red/10',
    border: 'border-noc-red/20',
    glow: 'glow-red',
    value: 'text-noc-red',
  },
  amber: {
    icon: 'text-noc-amber',
    bg: 'bg-noc-amber/10',
    border: 'border-noc-amber/20',
    glow: 'glow-amber',
    value: 'text-noc-amber',
  },
  purple: {
    icon: 'text-noc-purple',
    bg: 'bg-noc-purple/10',
    border: 'border-noc-purple/20',
    glow: '',
    value: 'text-noc-purple',
  },
};

export default function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'cyan',
  glowing = false,
}: MetricCardProps) {
  const colors = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`glass-card p-5 ${glowing ? colors.glow : ''}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${colors.bg} ${colors.border} border`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
              trend === 'up'
                ? 'text-noc-green bg-noc-green/10'
                : trend === 'down'
                ? 'text-noc-red bg-noc-red/10'
                : 'text-noc-muted bg-noc-surface'
            }`}
          >
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
            {trend === 'stable' && '→'}
            {trendValue}
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold ${colors.value} mb-1`}>{value}</div>
      <div className="text-xs text-noc-muted font-medium uppercase tracking-wider">{title}</div>
      {subtitle && <div className="text-xs text-noc-muted mt-1">{subtitle}</div>}
    </motion.div>
  );
}
