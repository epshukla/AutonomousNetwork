import { motion } from 'framer-motion';

interface HealthBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function HealthBadge({ score, size = 'md', showLabel = true }: HealthBadgeProps) {
  const getColor = (s: number) => {
    if (s >= 90) return { stroke: '#00ff88', text: 'text-noc-green', label: 'Healthy', bg: 'bg-noc-green/10' };
    if (s >= 70) return { stroke: '#ffaa00', text: 'text-noc-amber', label: 'Degraded', bg: 'bg-noc-amber/10' };
    if (s >= 50) return { stroke: '#ff8800', text: 'text-orange-400', label: 'Warning', bg: 'bg-orange-400/10' };
    return { stroke: '#ff4444', text: 'text-noc-red', label: 'Critical', bg: 'bg-noc-red/10' };
  };

  const sizeMap = {
    sm: { dim: 60, strokeWidth: 4, textSize: 'text-sm', radius: 24 },
    md: { dim: 90, strokeWidth: 5, textSize: 'text-xl', radius: 36 },
    lg: { dim: 130, strokeWidth: 6, textSize: 'text-3xl', radius: 52 },
  };

  const { stroke, text, label, bg } = getColor(score);
  const { dim, strokeWidth, textSize, radius } = sizeMap[size];
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="transform -rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke="#1e2560"
            strokeWidth={strokeWidth}
          />
          <motion.circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 6px ${stroke}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`${textSize} font-bold ${text}`}>{score}</span>
        </div>
      </div>
      {showLabel && (
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${text} ${bg}`}>
          {label}
        </span>
      )}
    </div>
  );
}
