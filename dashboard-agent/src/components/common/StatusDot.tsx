interface StatusDotProps {
  status: 'running' | 'paused' | 'stopped' | 'error' | 'success' | 'warning' | 'critical' | 'info';
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

const statusColors: Record<string, string> = {
  running: 'bg-noc-green',
  paused: 'bg-noc-amber',
  stopped: 'bg-noc-muted',
  error: 'bg-noc-red',
  success: 'bg-noc-green',
  warning: 'bg-noc-amber',
  critical: 'bg-noc-red',
  info: 'bg-noc-cyan',
};

const pulseColors: Record<string, string> = {
  running: 'bg-noc-green/40',
  paused: 'bg-noc-amber/40',
  stopped: 'bg-noc-muted/40',
  error: 'bg-noc-red/40',
  success: 'bg-noc-green/40',
  warning: 'bg-noc-amber/40',
  critical: 'bg-noc-red/40',
  info: 'bg-noc-cyan/40',
};

const sizeMap = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

const pulseSizeMap = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export default function StatusDot({ status, pulse = true, size = 'md', label }: StatusDotProps) {
  const color = statusColors[status] || statusColors.info;
  const pulseColor = pulseColors[status] || pulseColors.info;
  const dotSize = sizeMap[size];
  const pulseSize = pulseSizeMap[size];

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex">
        {pulse && (
          <span
            className={`animate-ping absolute inline-flex rounded-full opacity-75 ${pulseColor} ${pulseSize}`}
          />
        )}
        <span className={`relative inline-flex rounded-full ${color} ${dotSize}`} />
      </span>
      {label && <span className="text-sm text-noc-text">{label}</span>}
    </div>
  );
}
