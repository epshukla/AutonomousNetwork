import React from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from 'reactflow';
import {
  Scissors, Skull, Zap, TrendingDown, Shuffle, Waves, Brain, Activity,
} from 'lucide-react';

export interface ActiveChaosInfo {
  scenario: string;
  display_name: string;
  severity: string;
}

export interface LinkEdgeData {
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  utilization: number;
  latency_ms: number;
  packet_loss: number;
  throughput_gbps: number;
  bandwidth_gbps: number;
  label?: string;
  active_chaos?: ActiveChaosInfo[];
}

const statusColors: Record<string, string> = {
  healthy: '#00ff88',
  degraded: '#ffaa00',
  critical: '#ff4444',
  down: '#ff2222',
};

const CHAOS_VISUALS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  fiber_cut:            { icon: Scissors,     color: '#ff4444', label: 'Fiber Cut' },
  ddos_attack:          { icon: Skull,        color: '#ff2222', label: 'DDoS' },
  device_failure:       { icon: Zap,          color: '#ff6600', label: 'Failure' },
  gradual_degradation:  { icon: TrendingDown, color: '#ffaa00', label: 'Degrading' },
  bgp_route_leak:       { icon: Shuffle,      color: '#ff44ff', label: 'BGP Leak' },
  congestion_cascade:   { icon: Waves,        color: '#ff8800', label: 'Cascade' },
  memory_leak:          { icon: Brain,        color: '#aa44ff', label: 'Mem Leak' },
  flapping_link:        { icon: Activity,     color: '#ffcc00', label: 'Flapping' },
};

export default function LinkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<LinkEdgeData>) {
  const edgeData = data || {
    status: 'healthy' as const,
    utilization: 0,
    latency_ms: 0,
    packet_loss: 0,
    throughput_gbps: 0,
    bandwidth_gbps: 1,
  };

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const color = statusColors[edgeData.status] || statusColors.healthy;
  const isDown = edgeData.status === 'down';
  const isDegraded = edgeData.status === 'degraded';
  const isCritical = edgeData.status === 'critical';
  const isAffected = isDown || isCritical;
  const thickness = isDown ? 3 : Math.max(1.5, Math.min((edgeData.utilization || 0) / 15, 6));

  // Packet flow: count and speed vary by link health
  const packetCount = isDown ? 0
    : isCritical ? 1
    : isDegraded ? 2
    : Math.max(1, Math.min(4, Math.floor((edgeData.utilization || 0) / 25)));
  const packetDuration = isCritical ? 8
    : isDegraded ? 4
    : Math.max(1, 3 - (edgeData.utilization || 0) / 50);

  const chaosEntries = edgeData.active_chaos || [];

  return (
    <>
      {/* Glow effect - stronger for affected links */}
      <path
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={isAffected ? thickness + 8 : thickness + 4}
        strokeOpacity={isAffected ? 0.3 : 0.15}
        className="react-flow__edge-path"
      />

      {/* Main edge */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={color}
        strokeWidth={thickness}
        strokeOpacity={selected ? 1 : isDown ? 0.9 : 0.7}
        strokeDasharray={isDown ? '8 6' : undefined}
        className="react-flow__edge-path"
        markerEnd={markerEnd}
      />

      {/* Pulsing effect for down/critical links */}
      {isAffected && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={thickness + 2}
          strokeOpacity={0.4}
          strokeDasharray={isDown ? '8 6' : undefined}
          className="react-flow__edge-path"
          style={{
            animation: 'pulse 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Packet flow animation — SVG circles with animateMotion */}
      {packetCount > 0 && Array.from({ length: packetCount }).map((_, i) => (
        <circle key={i} r={3} fill={color} opacity={0.85}>
          <animateMotion
            dur={`${packetDuration}s`}
            repeatCount="indefinite"
            path={edgePath}
            begin={`${(i / packetCount) * packetDuration}s`}
          />
        </circle>
      ))}

      {/* Edge label — always visible */}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <div
            className={`
              px-2 py-1 rounded-md text-[9px] font-mono font-medium
              backdrop-blur-sm border transition-all duration-200
              ${isDown
                ? 'bg-red-900/90 border-red-500/50'
                : isCritical
                ? 'bg-red-900/80 border-red-500/40'
                : isDegraded
                ? 'bg-amber-900/80 border-amber-500/40'
                : selected
                ? 'bg-noc-card/95 border-noc-cyan/50 shadow-noc-glow'
                : 'bg-noc-card/80 border-noc-border/30'
              }
            `}
            style={{ color }}
          >
            {isDown ? (
              <div className="flex items-center gap-1">
                <span className="text-red-400 font-bold">LINK DOWN</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{(edgeData.utilization || 0).toFixed(0)}%</span>
                <span className="text-noc-muted">|</span>
                <span>{(edgeData.latency_ms || 0).toFixed(1)}ms</span>
                <span className="text-noc-muted">|</span>
                <span>{(edgeData.throughput_gbps || 0).toFixed(1)}G</span>
              </div>
            )}
          </div>

          {/* Chaos badges on link */}
          {chaosEntries.length > 0 && (
            <div className="flex gap-1 mt-1 justify-center">
              {chaosEntries.map((chaos, i) => {
                const visual = CHAOS_VISUALS[chaos.scenario];
                if (!visual) return null;
                const ChaosIcon = visual.icon;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold border"
                    style={{
                      color: visual.color,
                      borderColor: visual.color + '60',
                      backgroundColor: visual.color + '20',
                    }}
                  >
                    <ChaosIcon className="w-2.5 h-2.5" />
                    <span>{visual.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
