import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
  Server, Router, Wifi, Monitor, HardDrive, Globe, AlertTriangle, XCircle,
  Scissors, Skull, Zap, TrendingDown, Shuffle, Waves, Brain, Activity,
  Layers, Radio,
} from 'lucide-react';
import StatusDot from '../common/StatusDot';

export interface ActiveChaosInfo {
  scenario: string;
  display_name: string;
  severity: string;
}

export interface DeviceNodeData {
  label: string;
  type: string;
  status: 'healthy' | 'degraded' | 'critical' | 'down';
  cpu_usage: number;
  memory_usage: number;
  temperature: number;
  location: string;
  vendor?: string | null;
  model?: string | null;
  active_chaos?: ActiveChaosInfo[];
  killed_manually?: boolean;
}

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

const deviceIcons: Record<string, React.ElementType> = {
  router: Router,
  switch: HardDrive,
  server: Server,
  access_point: Wifi,
  firewall: Monitor,
  gateway: Globe,
  core_router: Router,
  edge_router: Router,
  distribution_switch: HardDrive,
  access_switch: HardDrive,
  peering_router: Globe,
  aggregation_router: Layers,
  olt: Radio,
};

const statusBorder: Record<string, string> = {
  healthy: 'border-noc-green/40',
  degraded: 'border-noc-amber/60 shadow-[0_0_20px_rgba(255,170,0,0.4)]',
  critical: 'border-noc-red/80 shadow-[0_0_25px_rgba(255,68,68,0.5)]',
  down: 'border-red-800/60 shadow-[0_0_20px_rgba(200,0,0,0.3)]',
};

function ProgressBar({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  const barColor =
    value > 90 ? 'bg-noc-red' : value > 70 ? 'bg-noc-amber' : color;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-noc-muted w-7 font-mono">{label}</span>
      <div className="flex-1 h-1.5 bg-noc-bg/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${Math.min(value || 0, 100)}%` }}
        />
      </div>
      <span className="text-[9px] text-noc-muted font-mono w-8 text-right">
        {(value || 0).toFixed(0)}%
      </span>
    </div>
  );
}

function DeviceNodeComponent({ data, selected }: NodeProps<DeviceNodeData>) {
  const Icon = deviceIcons[data.type] || Server;
  const baseBorder = statusBorder[data.status] || statusBorder.down;
  const border = data.killed_manually
    ? 'border-red-500/70 border-dashed shadow-[0_0_25px_rgba(255,0,0,0.4)]'
    : baseBorder;
  const isAffected = data.status === 'critical' || data.status === 'down';
  const isDegraded = data.status === 'degraded';

  const accentColor = data.status === 'healthy'
    ? 'rgba(0,255,136,0.5)'
    : data.status === 'degraded'
    ? 'rgba(255,170,0,0.6)'
    : data.status === 'critical'
    ? 'rgba(255,68,68,0.8)'
    : 'rgba(200,0,0,0.5)';

  const bgGradient = isAffected
    ? 'linear-gradient(135deg, rgba(80,20,20,0.95) 0%, rgba(40,10,10,0.90) 100%)'
    : isDegraded
    ? 'linear-gradient(135deg, rgba(60,40,10,0.95) 0%, rgba(30,20,5,0.90) 100%)'
    : 'linear-gradient(135deg, rgba(22,27,74,0.95) 0%, rgba(17,22,56,0.85) 100%)';

  const chaosEntries = data.active_chaos || [];

  return (
    <>
      <Handle type="target" position={Position.Top} id="top" className="!w-2 !h-2 !bg-noc-cyan/50 !border-noc-cyan/30" />
      <Handle type="source" position={Position.Top} id="top-src" className="!w-2 !h-2 !bg-noc-cyan/50 !border-noc-cyan/30" />
      <Handle type="target" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !bg-noc-cyan/50 !border-noc-cyan/30" />
      <Handle type="source" position={Position.Bottom} id="bottom-src" className="!w-2 !h-2 !bg-noc-cyan/50 !border-noc-cyan/30" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-noc-cyan/50 !border-noc-cyan/30" />
      <Handle type="source" position={Position.Left} id="left-src" className="!w-2 !h-2 !bg-noc-cyan/50 !border-noc-cyan/30" />
      <Handle type="target" position={Position.Right} id="right" className="!w-2 !h-2 !bg-noc-cyan/50 !border-noc-cyan/30" />
      <Handle type="source" position={Position.Right} id="right-src" className="!w-2 !h-2 !bg-noc-cyan/50 !border-noc-cyan/30" />
      <div
        className={`
          relative rounded-xl border-2 backdrop-blur-sm p-3 min-w-[180px]
          ${border}
          ${selected ? 'ring-2 ring-noc-cyan/50 ring-offset-2 ring-offset-noc-bg' : ''}
          ${isAffected ? 'animate-pulse' : ''}
          transition-all duration-300 cursor-pointer
          hover:scale-[1.02] hover:brightness-110
        `}
        style={{ background: bgGradient }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-2 right-2 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          }}
        />

        {/* DOWN / KILLED overlay */}
        {data.status === 'down' && (
          <div className={`absolute inset-0 rounded-xl flex items-center justify-center z-10 pointer-events-none ${
            data.killed_manually ? 'bg-black/40' : 'bg-red-900/20'
          }`}>
            <div className={`px-3 py-1 rounded-md border flex items-center gap-1.5 ${
              data.killed_manually
                ? 'bg-red-950/95 border-red-400/60'
                : 'bg-red-900/90 border-red-500/50'
            }`}>
              {data.killed_manually ? (
                <Skull className="w-4 h-4 text-red-400" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400" />
              )}
              <span className="text-red-300 text-xs font-bold uppercase tracking-wider">
                {data.killed_manually ? 'KILLED' : 'DOWN'}
              </span>
            </div>
          </div>
        )}

        {/* CRITICAL overlay */}
        {data.status === 'critical' && (
          <div className="absolute top-1 right-1 z-10 pointer-events-none">
            <div className="bg-red-900/80 p-1 rounded-md border border-red-500/40 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className={`p-1.5 rounded-lg border ${
            isAffected ? 'bg-red-900/50 border-red-500/30' :
            isDegraded ? 'bg-amber-900/50 border-amber-500/30' :
            'bg-noc-surface/80 border-noc-border/30'
          }`}>
            <Icon className={`w-4 h-4 ${
              isAffected ? 'text-red-400' : isDegraded ? 'text-amber-400' : 'text-noc-cyan'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`text-xs font-bold truncate ${
                isAffected ? 'text-red-200' : 'text-white'
              }`}>
                {data.label}
              </span>
              <StatusDot status={data.status} size="sm" />
            </div>
            <span className="text-[9px] text-noc-muted capitalize font-medium">
              {(data.type || '').replace(/_/g, ' ')} - {data.location}
            </span>
            {data.vendor && data.model && (
              <span className="text-[8px] text-noc-muted/60 font-mono block">
                {data.vendor} {data.model}
              </span>
            )}
          </div>
        </div>

        {/* Metrics */}
        <div className="space-y-1">
          <ProgressBar value={data.cpu_usage} color="bg-noc-cyan" label="CPU" />
          <ProgressBar
            value={data.memory_usage}
            color="bg-noc-purple"
            label="MEM"
          />
        </div>

        {/* Temperature */}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[9px] text-noc-muted">Temp</span>
          <span
            className={`text-[10px] font-mono font-bold ${
              (data.temperature || 0) > 80
                ? 'text-noc-red'
                : (data.temperature || 0) > 65
                ? 'text-noc-amber'
                : 'text-noc-green'
            }`}
          >
            {(data.temperature || 0).toFixed(0)} C
          </span>
        </div>

        {/* Chaos badges */}
        {chaosEntries.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {chaosEntries.map((chaos, i) => {
              const visual = CHAOS_VISUALS[chaos.scenario];
              if (!visual) return null;
              const ChaosIcon = visual.icon;
              return (
                <div
                  key={i}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold border animate-pulse"
                  style={{
                    color: visual.color,
                    borderColor: visual.color + '60',
                    backgroundColor: visual.color + '15',
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
    </>
  );
}

export default memo(DeviceNodeComponent);
