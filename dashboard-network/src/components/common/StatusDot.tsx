import React from 'react';

type Status = 'healthy' | 'degraded' | 'critical' | 'down' | string;

interface StatusDotProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const dotColors: Record<string, string> = {
  healthy: 'bg-noc-green',
  degraded: 'bg-noc-amber',
  critical: 'bg-noc-red',
  down: 'bg-gray-500',
};

const glowColors: Record<string, string> = {
  healthy: 'shadow-[0_0_8px_rgba(0,255,136,0.6)]',
  degraded: 'shadow-[0_0_8px_rgba(255,170,0,0.6)]',
  critical: 'shadow-[0_0_8px_rgba(255,68,68,0.6)]',
  down: '',
};

const sizes = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export default function StatusDot({
  status,
  size = 'md',
  pulse = true,
}: StatusDotProps) {
  const color = dotColors[status] || dotColors.down;
  const glow = glowColors[status] || '';
  const shouldPulse = pulse && status !== 'down';

  return (
    <span className="relative inline-flex">
      {shouldPulse && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-50 animate-ping`}
          style={{ animationDuration: '2s' }}
        />
      )}
      <span
        className={`relative inline-flex rounded-full ${color} ${glow} ${sizes[size]}`}
      />
    </span>
  );
}
