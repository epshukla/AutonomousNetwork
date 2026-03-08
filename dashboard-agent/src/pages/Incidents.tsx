import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Server } from 'lucide-react';
import { useIncidents } from '../hooks/useIncidents';
import IncidentList from '../components/incidents/IncidentList';
import IncidentDetail from '../components/incidents/IncidentDetail';
import { getDeviceTelemetry, type Incident, type DeviceTelemetryPoint } from '../api/agent';

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

function AffectedDeviceMetrics({ deviceIds }: { deviceIds: string[] }) {
  const [telemetry, setTelemetry] = useState<Record<string, DeviceTelemetryPoint[]>>({});

  useEffect(() => {
    if (deviceIds.length === 0) return;
    const ids = deviceIds.slice(0, 2);
    Promise.all(
      ids.map((id) =>
        getDeviceTelemetry(id, 30, '10s')
          .then((r) => [id, r.data] as const)
          .catch(() => [id, []] as const)
      )
    ).then((results) => setTelemetry(Object.fromEntries(results)));
  }, [deviceIds.join(',')]);

  const entries = Object.entries(telemetry).filter(([, pts]) => pts.length > 0);
  if (entries.length === 0) return null;

  return (
    <div className="glass-card p-3 mt-3">
      <div className="flex items-center gap-2 mb-2">
        <Server className="w-3.5 h-3.5 text-noc-cyan" />
        <span className="text-xs font-bold text-noc-muted uppercase tracking-wider">
          Affected Device Metrics
        </span>
      </div>
      {entries.map(([deviceId, points]) => {
        const chartData = points.map((p) => ({
          time: formatTime(p.time),
          cpu: p.cpu_utilization,
          mem: p.memory_utilization,
        }));
        return (
          <div key={deviceId} className="mb-3">
            <span className="text-[10px] font-mono text-noc-cyan">{deviceId}</span>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2560" strokeOpacity={0.5} />
                <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#8892b0' }} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#8892b0' }} tickFormatter={(v) => `${v}%`} />
                <Area type="monotone" dataKey="cpu" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.1} strokeWidth={1.5} dot={false} connectNulls />
                <Area type="monotone" dataKey="mem" stroke="#a855f7" fill="#a855f7" fillOpacity={0.1} strokeWidth={1.5} dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-1">
              <span className="text-[9px] text-noc-muted flex items-center gap-1">
                <span className="w-2 h-0.5 bg-[#00d4ff] inline-block rounded" /> CPU
              </span>
              <span className="text-[9px] text-noc-muted flex items-center gap-1">
                <span className="w-2 h-0.5 bg-[#a855f7] inline-block rounded" /> Memory
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Incidents() {
  const { incidents, loading } = useIncidents();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card p-4 animate-pulse">
            <div className="h-4 bg-noc-border/30 rounded w-1/3 mb-2" />
            <div className="h-3 bg-noc-border/30 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-4">
      {/* Incident List */}
      <div className={`transition-all duration-300 ${selectedIncident ? 'w-1/2' : 'w-full'}`}>
        <IncidentList
          incidents={incidents}
          onSelect={(inc) => setSelectedIncident(inc.id === selectedIncident?.id ? null : inc)}
          selectedId={selectedIncident?.id}
        />
      </div>

      {/* Incident Detail Panel + Affected Device Metrics */}
      <AnimatePresence>
        {selectedIncident && (
          <div className="w-1/2 max-h-[calc(100vh-120px)] overflow-y-auto">
            <IncidentDetail
              incident={selectedIncident}
              onClose={() => setSelectedIncident(null)}
            />
            <AffectedDeviceMetrics
              deviceIds={selectedIncident.affected_devices || []}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
