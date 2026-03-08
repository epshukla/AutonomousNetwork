import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Server, Link2 } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getDeviceTelemetry,
  getLinkTelemetry,
  type DeviceTelemetryPoint,
  type LinkTelemetryPoint,
} from '../../api/agent';

interface Props {
  type: 'device' | 'link';
  id: string;
  onClose: () => void;
}

const FRIENDLY_NAMES: Record<string, string> = {
  'core-delhi-1': 'Delhi Core 1',
  'core-delhi-2': 'Delhi Core 2',
  'core-mumbai-1': 'Mumbai Core 1',
  'core-mumbai-2': 'Mumbai Core 2',
  'agg-delhi-1': 'Delhi Aggregation',
  'agg-mumbai-1': 'Mumbai Aggregation',
  'edge-delhi-north': 'Delhi North Edge',
  'edge-delhi-south': 'Delhi South Edge',
  'edge-mumbai-central': 'Mumbai Central Edge',
  'edge-mumbai-harbor': 'Mumbai Harbor Edge',
  'peer-delhi-1': 'Delhi Peering (Google)',
  'peer-mumbai-1': 'Mumbai Peering (Cloudflare)',
  'olt-delhi-north-1': 'Delhi North OLT',
  'olt-delhi-south-1': 'Delhi South OLT',
  'olt-mumbai-central-1': 'Mumbai Central OLT',
  'olt-mumbai-harbor-1': 'Mumbai Harbor OLT',
};

const TIME_RANGES = [
  { label: '10m', minutes: 10 },
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
];

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

function MiniChart({
  data,
  dataKey,
  label,
  color,
  unit,
  domain,
}: {
  data: any[];
  dataKey: string;
  label: string;
  color: string;
  unit: string;
  domain?: [number, number];
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-noc-muted uppercase tracking-wider">
          {label}
        </span>
        {data.length > 0 && (
          <span className="text-xs font-mono" style={{ color }}>
            {(data[data.length - 1]?.[dataKey] || 0).toFixed(1)}
            {unit}
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={130}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2560" strokeOpacity={0.5} />
          <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#8892b0' }} interval="preserveStartEnd" tickCount={4} />
          <YAxis
            domain={domain || ['auto', 'auto']}
            tick={{ fontSize: 8, fill: '#8892b0' }}
            tickFormatter={(v) => `${v}${unit}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#161b4a',
              border: '1px solid #1e2560',
              borderRadius: '8px',
              fontSize: '10px',
            }}
            formatter={(value: number) => [`${value.toFixed(2)}${unit}`, label]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#grad-${dataKey})`}
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DeviceDrilldown({ type, id, onClose }: Props) {
  const [range, setRange] = useState(10);
  const [deviceData, setDeviceData] = useState<DeviceTelemetryPoint[]>([]);
  const [linkData, setLinkData] = useState<LinkTelemetryPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetch = async () => {
      if (type === 'device') {
        const res = await getDeviceTelemetry(id, range, '5s');
        setDeviceData(res.data);
      } else {
        const res = await getLinkTelemetry(id, range, '5s');
        setLinkData(res.data);
      }
      setLoading(false);
    };
    fetch();
    const timer = setInterval(fetch, 10000);
    return () => clearInterval(timer);
  }, [type, id, range]);

  const chartData =
    type === 'device'
      ? deviceData.map((d) => ({ ...d, time: formatTime(d.time) }))
      : linkData.map((d) => ({ ...d, time: formatTime(d.time) }));

  return (
    <motion.div
      initial={{ x: 500, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 500, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 bottom-0 w-[460px] z-50 bg-noc-bg/95 backdrop-blur-xl border-l border-noc-border/50 overflow-y-auto"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {type === 'device' ? (
              <Server className="w-4 h-4 text-noc-cyan" />
            ) : (
              <Link2 className="w-4 h-4 text-noc-cyan" />
            )}
            <div>
              <h3 className="text-sm font-bold text-white">
                {FRIENDLY_NAMES[id] || id}
              </h3>
              <span className="text-[10px] text-noc-muted font-mono">{id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-noc-surface/50 text-noc-muted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-1 mb-4">
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r.minutes)}
              className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                range === r.minutes
                  ? 'bg-noc-cyan/20 text-noc-cyan border border-noc-cyan/30'
                  : 'bg-noc-surface/50 text-noc-muted border border-noc-border/20 hover:text-noc-text'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {loading && chartData.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
          </div>
        ) : type === 'device' ? (
          <>
            <MiniChart data={chartData} dataKey="cpu_utilization" label="CPU" color="#00d4ff" unit="%" domain={[0, 100]} />
            <MiniChart data={chartData} dataKey="memory_utilization" label="Memory" color="#a855f7" unit="%" domain={[0, 100]} />
            <MiniChart data={chartData} dataKey="temperature_celsius" label="Temperature" color="#ffaa00" unit="°C" />
          </>
        ) : (
          <>
            <MiniChart data={chartData} dataKey="utilization_percent" label="Utilization" color="#00ff88" unit="%" domain={[0, 100]} />
            <MiniChart data={chartData} dataKey="latency_ms" label="Latency" color="#00d4ff" unit="ms" />
            <MiniChart data={chartData} dataKey="packet_loss_percent" label="Packet Loss" color="#ff4444" unit="%" />
            <MiniChart data={chartData} dataKey="throughput_gbps" label="Throughput" color="#a855f7" unit=" Gbps" />
          </>
        )}
      </div>
    </motion.div>
  );
}
