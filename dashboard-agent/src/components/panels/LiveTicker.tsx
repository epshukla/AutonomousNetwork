import { useAgentEvents } from '../../hooks/useAgentEvents';

const severityDot: Record<string, string> = {
  critical: 'bg-noc-red',
  warning: 'bg-noc-amber',
  info: 'bg-noc-cyan',
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export default function LiveTicker() {
  const { events } = useAgentEvents();
  const recentEvents = events.slice(0, 30);

  if (recentEvents.length === 0) {
    return (
      <div className="w-full bg-noc-surface/50 border-b border-noc-border/20 px-4 py-1.5 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-noc-cyan animate-pulse" />
          <span className="text-[10px] text-noc-muted font-mono">
            Listening for events...
          </span>
        </div>
      </div>
    );
  }

  const hasCritical = recentEvents.some(
    (e) => (e.data as any)?.severity === 'critical'
  );

  return (
    <div
      className={`w-full border-b border-noc-border/20 px-4 py-1 overflow-hidden ${
        hasCritical
          ? 'bg-noc-red/10 border-b-noc-red/30'
          : 'bg-noc-surface/50'
      }`}
    >
      <div className="relative overflow-hidden">
        <div className="ticker-scroll flex gap-8 whitespace-nowrap">
          {/* Duplicate events for seamless scrolling */}
          {[...recentEvents, ...recentEvents].map((event, i) => {
            const severity = (event.data as any)?.severity || 'info';
            const description =
              (event.data as any)?.description ||
              (event.data as any)?.title ||
              (event.type || '').replace(/_/g, ' ');
            return (
              <span
                key={`${event.id}-${i}`}
                className="inline-flex items-center gap-1.5 text-[10px] font-mono"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    severityDot[severity] || 'bg-noc-cyan'
                  }`}
                />
                <span className="text-noc-muted">
                  {formatTime(event.timestamp)}
                </span>
                <span className="text-noc-text">{description}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
