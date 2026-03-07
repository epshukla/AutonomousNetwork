import { motion } from 'framer-motion';
import { AlertCircle, Search, Zap, CheckCircle, ArrowUpRight } from 'lucide-react';
import { TimelineEvent } from '../../api/agent';

interface TimelineProps {
  events: TimelineEvent[];
}

const typeConfig = {
  detection: { icon: AlertCircle, color: 'text-noc-red', bg: 'bg-noc-red/10', border: 'border-noc-red/30', line: 'bg-noc-red/30' },
  analysis: { icon: Search, color: 'text-noc-cyan', bg: 'bg-noc-cyan/10', border: 'border-noc-cyan/30', line: 'bg-noc-cyan/30' },
  action: { icon: Zap, color: 'text-noc-amber', bg: 'bg-noc-amber/10', border: 'border-noc-amber/30', line: 'bg-noc-amber/30' },
  resolution: { icon: CheckCircle, color: 'text-noc-green', bg: 'bg-noc-green/10', border: 'border-noc-green/30', line: 'bg-noc-green/30' },
  escalation: { icon: ArrowUpRight, color: 'text-noc-purple', bg: 'bg-noc-purple/10', border: 'border-noc-purple/30', line: 'bg-noc-purple/30' },
};

export default function Timeline({ events }: TimelineProps) {
  return (
    <div className="relative pl-8">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-noc-cyan/30 via-noc-border/30 to-transparent" />

      <div className="space-y-4">
        {events.map((event, index) => {
          const config = typeConfig[event.type] || typeConfig.analysis;
          const Icon = config.icon;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {/* Node */}
              <div
                className={`absolute -left-8 w-8 h-8 rounded-full ${config.bg} border ${config.border} flex items-center justify-center`}
              >
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
              </div>

              {/* Content */}
              <div className="bg-noc-bg/40 rounded-lg border border-noc-border/20 p-3 ml-2">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-semibold ${config.color}`}>{event.event}</span>
                  <span className="text-xs text-noc-muted font-mono">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-noc-muted">{event.details}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
