import React, { useMemo, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnSelectionChangeFunc,
  MarkerType,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Server,
  Link2,
  Cpu,
  HardDrive,
  Thermometer,
  Activity,
  Clock,
  AlertTriangle,
  Gauge,
} from 'lucide-react';

import DeviceNodeComponent, {
  type DeviceNodeData,
} from '../components/topology/DeviceNode';
import LinkEdge, { type LinkEdgeData } from '../components/topology/LinkEdge';
import ZoneNode from '../components/topology/ZoneNode';
import AnnotationNode from '../components/topology/AnnotationNode';
import HealthBadge from '../components/common/HealthBadge';
import StatusDot from '../components/common/StatusDot';
import { useTopology, useWSTelemetry } from '../hooks/useTelemetry';
import type { DeviceData, LinkData } from '../api/simulator';

const nodeTypes = {
  device: DeviceNodeComponent,
  zone: ZoneNode,
  annotation: AnnotationNode,
};
const edgeTypes = { link: LinkEdge };

// ── Hierarchical positions: peering (top) → core (middle) → edge (bottom) ──

const DEVICE_POSITIONS: Record<string, { x: number; y: number }> = {
  // ── Delhi — left side ──
  'peer-delhi-1':          { x: 180, y: 40 },
  'core-delhi-1':          { x: 80,  y: 200 },
  'core-delhi-2':          { x: 280, y: 200 },
  'agg-delhi-1':           { x: 180, y: 360 },
  'edge-delhi-north':      { x: 80,  y: 520 },
  'edge-delhi-south':      { x: 280, y: 520 },
  'olt-delhi-north-1':     { x: 80,  y: 680 },
  'olt-delhi-south-1':     { x: 280, y: 680 },
  // ── Mumbai — right side ──
  'peer-mumbai-1':         { x: 680, y: 40 },
  'core-mumbai-1':         { x: 580, y: 200 },
  'core-mumbai-2':         { x: 780, y: 200 },
  'agg-mumbai-1':          { x: 680, y: 360 },
  'edge-mumbai-central':   { x: 580, y: 520 },
  'edge-mumbai-harbor':    { x: 780, y: 520 },
  'olt-mumbai-central-1':  { x: 580, y: 680 },
  'olt-mumbai-harbor-1':   { x: 780, y: 680 },
};

const FRIENDLY_NAMES: Record<string, string> = {
  'peer-delhi-1':          'Delhi Peering (Google)',
  'core-delhi-1':          'Delhi Core 1',
  'core-delhi-2':          'Delhi Core 2',
  'agg-delhi-1':           'Delhi Aggregation',
  'edge-delhi-north':      'Delhi North Edge',
  'edge-delhi-south':      'Delhi South Edge',
  'olt-delhi-north-1':     'Delhi North OLT',
  'olt-delhi-south-1':     'Delhi South OLT',
  'peer-mumbai-1':         'Mumbai Peering (Cloudflare)',
  'core-mumbai-1':         'Mumbai Core 1',
  'core-mumbai-2':         'Mumbai Core 2',
  'agg-mumbai-1':          'Mumbai Aggregation',
  'edge-mumbai-central':   'Mumbai Central Edge',
  'edge-mumbai-harbor':    'Mumbai Harbor Edge',
  'olt-mumbai-central-1':  'Mumbai Central OLT',
  'olt-mumbai-harbor-1':   'Mumbai Harbor OLT',
};

// ── Zone + Annotation nodes (static) ──

const ZONE_NODES: Node[] = [
  {
    id: 'zone-delhi',
    type: 'zone',
    position: { x: -10, y: 0 },
    data: { label: 'Delhi  •  1.2M Customers', width: 420, height: 780 },
    zIndex: -1,
    selectable: false,
    draggable: false,
  },
  {
    id: 'zone-mumbai',
    type: 'zone',
    position: { x: 490, y: 0 },
    data: { label: 'Mumbai  •  1.5M Customers', width: 420, height: 780 },
    zIndex: -1,
    selectable: false,
    draggable: false,
  },
];

const ANNOTATION_NODES: Node[] = [
  {
    id: 'tier-peering',
    type: 'annotation',
    position: { x: -150, y: 55 },
    data: { label: 'PEERING', sublabel: 'Internet Exchange' },
    selectable: false,
    draggable: false,
  },
  {
    id: 'tier-core',
    type: 'annotation',
    position: { x: -150, y: 215 },
    data: { label: 'CORE', sublabel: 'Backbone' },
    selectable: false,
    draggable: false,
  },
  {
    id: 'tier-agg',
    type: 'annotation',
    position: { x: -150, y: 375 },
    data: { label: 'AGGREGATION', sublabel: 'Distribution' },
    selectable: false,
    draggable: false,
  },
  {
    id: 'tier-edge',
    type: 'annotation',
    position: { x: -150, y: 535 },
    data: { label: 'EDGE', sublabel: 'Customer-Facing' },
    selectable: false,
    draggable: false,
  },
  {
    id: 'tier-olt',
    type: 'annotation',
    position: { x: -150, y: 695 },
    data: { label: 'OLT / ACCESS', sublabel: 'Fiber to Home' },
    selectable: false,
    draggable: false,
  },
];

// ── Layout helpers ──

function layoutDevices(devices: DeviceData[]): Node<DeviceNodeData>[] {
  return devices.map((device) => {
    const pos = DEVICE_POSITIONS[device.device_id] || { x: 400, y: 300 };
    return {
      id: device.device_id,
      type: 'device',
      position: pos,
      data: {
        label: FRIENDLY_NAMES[device.device_id] || device.device_id,
        type: device.type,
        status: device.status,
        cpu_usage: device.cpu_utilization,
        memory_usage: device.memory_utilization,
        temperature: device.temperature_celsius,
        location: device.city,
        vendor: device.vendor,
        model: device.model,
        active_chaos: device.active_chaos || [],
      },
    };
  });
}

function layoutEdges(links: LinkData[]): Edge<LinkEdgeData>[] {
  return links.map((link) => {
    const sourcePos = DEVICE_POSITIONS[link.from];
    const targetPos = DEVICE_POSITIONS[link.to];

    let sourceHandle = 'right-src';
    let targetHandle = 'left';

    if (sourcePos && targetPos) {
      const dy = Math.abs(sourcePos.y - targetPos.y);
      const dx = Math.abs(sourcePos.x - targetPos.x);
      const isVertical = dy > 100;

      if (isVertical) {
        // Vertical link: use top/bottom handles
        sourceHandle = sourcePos.y < targetPos.y ? 'bottom-src' : 'top-src';
        targetHandle = sourcePos.y < targetPos.y ? 'top' : 'bottom';
      } else if (dx > 200) {
        // Long horizontal link (inter-city backbone)
        sourceHandle = 'right-src';
        targetHandle = 'left';
      } else {
        // Short horizontal (intra-city same tier)
        sourceHandle = sourcePos.x < targetPos.x ? 'right-src' : 'left-src';
        targetHandle = sourcePos.x < targetPos.x ? 'left' : 'right';
      }
    }

    return {
      id: link.link_id,
      source: link.from,
      target: link.to,
      type: 'link',
      sourceHandle,
      targetHandle,
      data: {
        status: link.status === 'up' ? 'healthy' : link.status as 'degraded' | 'down',
        utilization: link.utilization_percent,
        latency_ms: link.latency_ms,
        packet_loss: link.packet_loss_percent,
        throughput_gbps: link.throughput_gbps,
        bandwidth_gbps: link.capacity_gbps,
        active_chaos: link.active_chaos || [],
      },
    };
  });
}

// ── Detail Panel ───────────────────────────────────────────

interface DetailPanelProps {
  type: 'device' | 'link';
  data: DeviceNodeData | (LinkEdgeData & { id: string; source: string; target: string });
  onClose: () => void;
}

function DetailPanel({ type, data, onClose }: DetailPanelProps) {
  const isDevice = type === 'device';
  const d = data as any;

  return (
    <motion.div
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute right-0 top-0 bottom-0 w-80 z-20 border-l border-noc-border/50 bg-noc-bg/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDevice ? (
              <Server className="w-5 h-5 text-noc-cyan" />
            ) : (
              <Link2 className="w-5 h-5 text-noc-cyan" />
            )}
            <h3 className="text-lg font-bold text-white">
              {isDevice ? d.label : d.id}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-noc-surface/50 text-noc-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <HealthBadge status={d.status} size="md" />

        {/* Metrics */}
        <div className="space-y-3">
          {isDevice ? (
            <>
              <MetricRow
                icon={<Cpu className="w-4 h-4 text-noc-cyan" />}
                label="CPU Usage"
                value={`${(d.cpu_usage ?? 0).toFixed(1)}%`}
                bar={d.cpu_usage || 0}
                barColor={
                  (d.cpu_usage || 0) > 90 ? 'bg-noc-red' : (d.cpu_usage || 0) > 70 ? 'bg-noc-amber' : 'bg-noc-cyan'
                }
              />
              <MetricRow
                icon={<HardDrive className="w-4 h-4 text-noc-purple" />}
                label="Memory"
                value={`${(d.memory_usage ?? 0).toFixed(1)}%`}
                bar={d.memory_usage || 0}
                barColor={
                  (d.memory_usage || 0) > 90 ? 'bg-noc-red' : (d.memory_usage || 0) > 70 ? 'bg-noc-amber' : 'bg-noc-purple'
                }
              />
              <MetricRow
                icon={<Thermometer className="w-4 h-4 text-noc-amber" />}
                label="Temperature"
                value={`${(d.temperature ?? 0).toFixed(0)} C`}
              />
              <div className="glass-card p-3 text-xs text-noc-muted">
                <div className="flex justify-between mb-1">
                  <span>Type</span>
                  <span className="text-noc-text capitalize">
                    {d.type?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Location</span>
                  <span className="text-noc-text">{d.location}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <MetricRow
                icon={<Activity className="w-4 h-4 text-noc-cyan" />}
                label="Utilization"
                value={`${(d.utilization ?? 0).toFixed(1)}%`}
                bar={d.utilization || 0}
                barColor={
                  (d.utilization || 0) > 90 ? 'bg-noc-red' : (d.utilization || 0) > 70 ? 'bg-noc-amber' : 'bg-noc-cyan'
                }
              />
              <MetricRow
                icon={<Clock className="w-4 h-4 text-noc-amber" />}
                label="Latency"
                value={`${(d.latency_ms ?? 0).toFixed(2)} ms`}
              />
              <MetricRow
                icon={<AlertTriangle className="w-4 h-4 text-noc-red" />}
                label="Packet Loss"
                value={`${(d.packet_loss ?? 0).toFixed(3)}%`}
              />
              <MetricRow
                icon={<Gauge className="w-4 h-4 text-noc-green" />}
                label="Throughput"
                value={`${(d.throughput_gbps ?? 0).toFixed(2)} Gbps`}
              />
              <div className="glass-card p-3 text-xs text-noc-muted">
                <div className="flex justify-between mb-1">
                  <span>Bandwidth</span>
                  <span className="text-noc-text">{d.bandwidth_gbps || 0} Gbps</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Source</span>
                  <span className="text-noc-text">{FRIENDLY_NAMES[d.source] || d.source}</span>
                </div>
                <div className="flex justify-between">
                  <span>Target</span>
                  <span className="text-noc-text">{FRIENDLY_NAMES[d.target] || d.target}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MetricRow({
  icon,
  label,
  value,
  bar,
  barColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bar?: number;
  barColor?: string;
}) {
  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-xs text-noc-muted flex-1">{label}</span>
        <span className="text-sm font-bold text-white">{value}</span>
      </div>
      {bar !== undefined && (
        <div className="h-1.5 bg-noc-bg/80 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor || 'bg-noc-cyan'}`}
            style={{ width: `${Math.min(bar, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main Topology Page ─────────────────────────────────────

export default function Topology() {
  const { devices, links, loading } = useTopology(3000);
  const { latestTelemetry } = useWSTelemetry(60);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  // Merge live telemetry into topology data
  const mergedDevices = useMemo(() => {
    if (!latestTelemetry?.devices) return devices;
    return devices.map((d) => {
      const live = latestTelemetry.devices[d.device_id];
      if (live) {
        return {
          ...d,
          cpu_utilization: live.cpu_utilization ?? d.cpu_utilization,
          memory_utilization: live.memory_utilization ?? d.memory_utilization,
          temperature_celsius: live.temperature_celsius ?? d.temperature_celsius,
          status: (live.status as typeof d.status) ?? d.status,
        };
      }
      return d;
    });
  }, [devices, latestTelemetry]);

  const mergedLinks = useMemo(() => {
    if (!latestTelemetry?.links) return links;
    return links.map((l) => {
      const live = latestTelemetry.links[l.link_id];
      if (live) {
        return {
          ...l,
          utilization_percent: live.utilization_percent ?? l.utilization_percent,
          latency_ms: live.latency_ms ?? l.latency_ms,
          packet_loss_percent: live.packet_loss_percent ?? l.packet_loss_percent,
          throughput_gbps: live.throughput_gbps ?? l.throughput_gbps,
          status: (live.status as typeof l.status) ?? l.status,
        };
      }
      return l;
    });
  }, [links, latestTelemetry]);

  const deviceNodes = useMemo(() => layoutDevices(mergedDevices), [mergedDevices]);
  const edges = useMemo(() => layoutEdges(mergedLinks), [mergedLinks]);

  // Combine all nodes: zones (background) + annotations + devices
  const nodes = useMemo(
    () => [...ZONE_NODES, ...ANNOTATION_NODES, ...deviceNodes],
    [deviceNodes]
  );

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selNodes, edges: selEdges }) => {
      if (selNodes.length > 0 && selNodes[0].type === 'device') {
        setSelectedNode(selNodes[0].id);
        setSelectedEdge(null);
      } else if (selEdges.length > 0) {
        setSelectedEdge(selEdges[0].id);
        setSelectedNode(null);
      }
    },
    []
  );

  const closePanel = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  // Get detail data
  const selectedDeviceData = useMemo(() => {
    if (!selectedNode) return null;
    const node = deviceNodes.find((n) => n.id === selectedNode);
    return node?.data || null;
  }, [selectedNode, deviceNodes]);

  const selectedLinkData = useMemo(() => {
    if (!selectedEdge) return null;
    const edge = edges.find((e) => e.id === selectedEdge);
    if (!edge?.data) return null;
    return { ...edge.data, id: edge.id, source: edge.source, target: edge.target };
  }, [selectedEdge, edges]);

  if (loading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin mx-auto mb-4" />
          <p className="text-noc-muted text-sm">Loading topology...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <div>
            <h1 className="text-2xl font-bold text-white">Network Topology</h1>
            <p className="text-sm text-noc-muted">
              {mergedDevices.length} devices, {mergedLinks.length} links — 2.7M customers
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="glass-card px-4 py-2 flex items-center gap-4">
              {[
                { status: 'healthy', label: 'Healthy' },
                { status: 'degraded', label: 'Degraded' },
                { status: 'critical', label: 'Critical' },
                { status: 'down', label: 'Down' },
              ].map((item) => (
                <div key={item.status} className="flex items-center gap-1.5">
                  <StatusDot
                    status={item.status}
                    size="sm"
                    pulse={false}
                  />
                  <span className="text-xs text-noc-muted">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onSelectionChange={onSelectionChange}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'link',
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={30}
          size={1}
          color="#1e2560"
        />
        <Controls
          showInteractive={false}
          position="bottom-left"
        />
        <MiniMap
          nodeStrokeColor={(n) => {
            if (n.type !== 'device') return 'transparent';
            const status = (n.data as DeviceNodeData)?.status;
            return status === 'healthy'
              ? '#00ff88'
              : status === 'degraded'
              ? '#ffaa00'
              : status === 'critical'
              ? '#ff4444'
              : '#555555';
          }}
          nodeColor={(n) => {
            if (n.type !== 'device') return 'transparent';
            const status = (n.data as DeviceNodeData)?.status;
            return status === 'healthy'
              ? '#00ff8830'
              : status === 'degraded'
              ? '#ffaa0030'
              : status === 'critical'
              ? '#ff444430'
              : '#55555530';
          }}
          maskColor="rgba(10,14,39,0.8)"
          style={{ backgroundColor: '#111638' }}
        />
      </ReactFlow>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedDeviceData && (
          <DetailPanel
            type="device"
            data={selectedDeviceData}
            onClose={closePanel}
          />
        )}
        {selectedLinkData && (
          <DetailPanel
            type="link"
            data={selectedLinkData}
            onClose={closePanel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
