import React from 'react';
import { motion } from 'framer-motion';
import {
  Scissors,
  TrendingDown,
  Zap,
  ServerCrash,
  Route,
  Network,
  MemoryStick,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { ScenarioMeta } from '../../api/chaos';

interface ScenarioCardProps {
  scenario: ScenarioMeta;
  onClick?: () => void;
  isActive?: boolean;
  compact?: boolean;
}

const iconMap: Record<string, React.FC<any>> = {
  Scissors,
  TrendingDown,
  Zap,
  ServerCrash,
  Route,
  Network,
  MemoryStick,
  Activity,
};

const severityConfig: Record<string, { color: string; bg: string; border: string; label: string }> = {
  low: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30', label: 'LOW' },
  medium: { color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30', label: 'MEDIUM' },
  high: { color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30', label: 'HIGH' },
  critical: { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30', label: 'CRITICAL' },
  emergency: { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50', label: 'EMERGENCY' },
};

const categoryColors: Record<string, string> = {
  link: 'text-cyan-400',
  device: 'text-amber-400',
  security: 'text-red-400',
  routing: 'text-emerald-400',
};

export const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, onClick, isActive, compact }) => {
  const IconComponent = iconMap[scenario.icon] || AlertTriangle;
  const severity = severityConfig[scenario.severity] || severityConfig.medium;

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`glass-card-hover p-4 cursor-pointer ${isActive ? 'border-cyan-400/50 glow-cyan' : ''}`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${severity.bg} ${severity.border} border`}>
            <IconComponent size={18} className={severity.color} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-noc-text truncate">{scenario.display_name}</h4>
            <span className={`text-xs font-mono ${severity.color}`}>{severity.label}</span>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`glass-card-hover p-6 cursor-pointer group relative overflow-hidden ${
        isActive ? 'border-red-400/50 glow-red' : ''
      }`}
    >
      {/* Scan line effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent animate-[scanLine_2s_linear_infinite]" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${severity.bg} border ${severity.border}`}>
          <IconComponent size={24} className={severity.color} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${severity.color} ${severity.bg} ${severity.border}`}>
            {severity.label}
          </span>
          <span className={`text-xs uppercase tracking-wider ${categoryColors[scenario.category] || 'text-noc-muted'}`}>
            {scenario.category}
          </span>
        </div>
      </div>

      {/* Name & Description */}
      <h3 className="text-lg font-bold text-noc-text mb-2 group-hover:text-cyan-400 transition-colors">
        {scenario.display_name}
      </h3>
      <p className="text-sm text-noc-muted leading-relaxed mb-4 line-clamp-2">{scenario.description}</p>

      {/* Effects */}
      <div className="mb-4">
        <h4 className="text-xs uppercase tracking-wider text-noc-muted mb-2 font-semibold">Expected Effects</h4>
        <div className="space-y-1">
          {scenario.expected_effects.slice(0, 3).map((effect, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-noc-text/80">
              <span className={`w-1 h-1 rounded-full ${severity.color.replace('text-', 'bg-')}`} />
              {effect}
            </div>
          ))}
          {scenario.expected_effects.length > 3 && (
            <span className="text-xs text-noc-muted">+{scenario.expected_effects.length - 3} more</span>
          )}
        </div>
      </div>

      {/* Affected Components */}
      <div className="flex flex-wrap gap-1.5">
        {scenario.affected_components.map((component, i) => (
          <span
            key={i}
            className="text-xs px-2 py-0.5 rounded-full bg-noc-surface border border-noc-border text-noc-muted font-mono"
          >
            {component}
          </span>
        ))}
      </div>

      {/* Active indicator */}
      {isActive && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute top-3 right-3 w-3 h-3 rounded-full bg-red-400"
        />
      )}
    </motion.div>
  );
};

export default ScenarioCard;
