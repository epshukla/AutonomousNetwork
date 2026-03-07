import React from 'react';

interface HealthBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({ score, size = 'md' }) => {
  const getColor = () => {
    if (score >= 90) return { text: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' };
    if (score >= 70) return { text: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' };
    return { text: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' };
  };

  const getLabel = () => {
    if (score >= 90) return 'HEALTHY';
    if (score >= 70) return 'DEGRADED';
    if (score >= 50) return 'WARNING';
    return 'CRITICAL';
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  const colors = getColor();

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-semibold rounded-full border ${colors.text} ${colors.bg} ${colors.border} ${sizes[size]}`}
    >
      <span className={`w-2 h-2 rounded-full ${score >= 90 ? 'bg-emerald-400' : score >= 70 ? 'bg-amber-400' : 'bg-red-400'} ${score < 70 ? 'animate-pulse' : ''}`} />
      {score.toFixed(0)}% {getLabel()}
    </span>
  );
};

export default HealthBadge;
