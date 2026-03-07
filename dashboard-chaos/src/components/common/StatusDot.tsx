import React from 'react';

interface StatusDotProps {
  status: 'running' | 'completed' | 'stopped' | 'failed' | 'idle' | 'monitoring' | 'responding' | 'remediating' | 'detected' | 'investigating' | 'mitigating' | 'resolved' | 'pending' | 'executing';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const statusConfig: Record<string, { color: string; bgColor: string; label: string }> = {
  running: { color: 'bg-emerald-400', bgColor: 'bg-emerald-400/20', label: 'Running' },
  completed: { color: 'bg-cyan-400', bgColor: 'bg-cyan-400/20', label: 'Completed' },
  stopped: { color: 'bg-amber-400', bgColor: 'bg-amber-400/20', label: 'Stopped' },
  failed: { color: 'bg-red-400', bgColor: 'bg-red-400/20', label: 'Failed' },
  idle: { color: 'bg-noc-muted', bgColor: 'bg-noc-muted/20', label: 'Idle' },
  monitoring: { color: 'bg-cyan-400', bgColor: 'bg-cyan-400/20', label: 'Monitoring' },
  responding: { color: 'bg-amber-400', bgColor: 'bg-amber-400/20', label: 'Responding' },
  remediating: { color: 'bg-red-400', bgColor: 'bg-red-400/20', label: 'Remediating' },
  detected: { color: 'bg-amber-400', bgColor: 'bg-amber-400/20', label: 'Detected' },
  investigating: { color: 'bg-cyan-400', bgColor: 'bg-cyan-400/20', label: 'Investigating' },
  mitigating: { color: 'bg-amber-400', bgColor: 'bg-amber-400/20', label: 'Mitigating' },
  resolved: { color: 'bg-emerald-400', bgColor: 'bg-emerald-400/20', label: 'Resolved' },
  pending: { color: 'bg-noc-muted', bgColor: 'bg-noc-muted/20', label: 'Pending' },
  executing: { color: 'bg-cyan-400', bgColor: 'bg-cyan-400/20', label: 'Executing' },
};

const sizeMap = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

export const StatusDot: React.FC<StatusDotProps> = ({ status, label, size = 'md', pulse }) => {
  const config = statusConfig[status] || statusConfig.idle;
  const shouldPulse = pulse ?? ['running', 'responding', 'remediating', 'executing', 'mitigating'].includes(status);

  return (
    <span className="inline-flex items-center gap-2">
      <span className={`relative flex ${sizeMap[size]}`}>
        {shouldPulse && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${config.color} opacity-40 animate-ping`} />
        )}
        <span className={`relative inline-flex rounded-full ${sizeMap[size]} ${config.color}`} />
      </span>
      {(label !== undefined ? label : config.label) && (
        <span className="text-sm text-noc-text font-medium">{label !== undefined ? label : config.label}</span>
      )}
    </span>
  );
};

export default StatusDot;
