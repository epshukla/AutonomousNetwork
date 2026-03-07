import React from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from 'reactflow';

export interface LinkEdgeData {
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  utilization: number;
  latency_ms: number;
  packet_loss: number;
  throughput_gbps: number;
  bandwidth_gbps: number;
  label?: string;
}

const statusColors: Record<string, string> = {
  healthy: '#00ff88',
  degraded: '#ffaa00',
  critical: '#ff4444',
  down: '#ff2222',
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
    status: 'healthy',
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
  const isActive = !isDown;

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

      {/* Animated flow particles - only for active links */}
      {isActive && (
        <path
          d={edgePath}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeOpacity={0.9}
          strokeDasharray="5 10"
          className="react-flow__edge-path"
          style={{
            animation: 'dataFlow 1.5s linear infinite',
          }}
        />
      )}

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

      {/* Edge label */}
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
                ? 'bg-red-900/90 border-red-500/50 opacity-100'
                : isCritical
                ? 'bg-red-900/80 border-red-500/40 opacity-100'
                : isDegraded
                ? 'bg-amber-900/80 border-amber-500/40 opacity-100'
                : selected
                ? 'bg-noc-card/95 border-noc-cyan/50 shadow-noc-glow'
                : 'bg-noc-card/70 border-noc-border/30 opacity-0 hover:opacity-100'
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
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
