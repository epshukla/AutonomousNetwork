import React from 'react';

type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'down' | string;

interface HealthBadgeProps {
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const statusConfig: Record<
  string,
  { label: string; bg: string; text: string; dot: string; border: string }
> = {
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

const sizeConfig = {
  sm: { wrapper: 'px-2 py-0.5 text-[10px]', dot: 'w-1.5 h-1.5' },
  md: { wrapper: 'px-2.5 py-1 text-xs', dot: 'w-2 h-2' },
  lg: { wrapper: 'px-3 py-1.5 text-sm', dot: 'w-2.5 h-2.5' },
};

export default function HealthBadge({
  status,
  size = 'md',
  showLabel = true,
}: HealthBadgeProps) {
  const config = statusConfig[status] || statusConfig.down;
  const sz = sizeConfig[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${config.bg} ${config.text} ${config.border} ${sz.wrapper}`}
    >
      <span
        className={`rounded-full ${config.dot} ${sz.dot} ${
          status === 'healthy' ? 'animate-pulse-glow' : ''
        }`}
      />
      {showLabel && config.label}
    </span>
  );
}
