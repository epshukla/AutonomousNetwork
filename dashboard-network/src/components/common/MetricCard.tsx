import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color?: 'cyan' | 'green' | 'red' | 'amber' | 'purple';
  icon?: React.ReactNode;
  sparklineData?: number[];
  delay?: number;
}

const colorMap = {
  cyan: {
    text: 'text-noc-cyan',
    glow: 'glow-text-cyan',
    gradient: ['rgba(0,212,255,0.3)', 'rgba(0,212,255,0)'],
    stroke: '#00d4ff',
    bg: 'bg-noc-cyan/10',
    border: 'border-noc-cyan/20',
  },
  green: {
    text: 'text-noc-green',
    glow: 'glow-text-green',
    gradient: ['rgba(0,255,136,0.3)', 'rgba(0,255,136,0)'],
    stroke: '#00ff88',
    bg: 'bg-noc-green/10',
    border: 'border-noc-green/20',
  },
  red: {
    text: 'text-noc-red',
    glow: 'glow-text-red',
    gradient: ['rgba(255,68,68,0.3)', 'rgba(255,68,68,0)'],
    stroke: '#ff4444',
    bg: 'bg-noc-red/10',
    border: 'border-noc-red/20',
  },
  amber: {
    text: 'text-noc-amber',
    glow: 'glow-text-amber',
    gradient: ['rgba(255,170,0,0.3)', 'rgba(255,170,0,0)'],
    stroke: '#ffaa00',
    bg: 'bg-noc-amber/10',
    border: 'border-noc-amber/20',
  },
  purple: {
    text: 'text-noc-purple',
    glow: '',
    gradient: ['rgba(168,85,247,0.3)', 'rgba(168,85,247,0)'],
    stroke: '#a855f7',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
  },
};

export default function MetricCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  color = 'cyan',
  icon,
  sparklineData,
  delay = 0,
}: MetricCardProps) {
  const c = colorMap[color];
  const chartData = sparklineData?.map((v, i) => ({ v, i })) || [];

  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-noc-green' : trend === 'down' ? 'text-noc-red' : 'text-noc-muted';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="glass-card-hover p-5 relative"
    >
      {/* Icon & Label row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && (
            <div className={`p-2 rounded-lg ${c.bg} ${c.border} border`}>
              <div className={c.text}>{icon}</div>
            </div>
          )}
          <span className="text-sm font-medium text-noc-muted">{label}</span>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            {trendValue && (
              <span className="text-xs font-medium">{trendValue}</span>
            )}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className={`text-3xl font-bold tracking-tight ${c.glow || c.text}`}>
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-noc-muted">{unit}</span>
        )}
      </div>

      {/* Sparkline */}
      {chartData.length > 1 && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient
                  id={`spark-${color}-${label}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={c.gradient[0]} />
                  <stop offset="95%" stopColor={c.gradient[1]} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={c.stroke}
                strokeWidth={1.5}
                fill={`url(#spark-${color}-${label})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
