import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Activity } from 'lucide-react';
import type { TopologyLink } from '../../api/agent';

interface Props {
  links: Record<string, TopologyLink>;
  onLinkClick?: (linkId: string) => void;
}

const FRIENDLY_LINKS: Record<string, string> = {
  'link-del-mum-primary': 'DEL↔MUM Primary',
  'link-del-mum-backup': 'DEL↔MUM Backup',
  'link-del-intra': 'DEL Intra',
  'link-mum-intra': 'MUM Intra',
  'link-del-c1-en': 'DEL C1→North',
  'link-del-c1-es': 'DEL C1→South',
  'link-del-c2-en': 'DEL C2→North',
  'link-del-c2-es': 'DEL C2→South',
  'link-mum-c1-ec': 'MUM C1→Central',
  'link-mum-c1-eh': 'MUM C1→Harbor',
  'link-mum-c2-ec': 'MUM C2→Central',
  'link-mum-c2-eh': 'MUM C2→Harbor',
  'link-del-peer': 'DEL Peering',
  'link-mum-peer': 'MUM Peering',
  'link-del-c1-agg': 'DEL C1→Agg',
  'link-mum-c1-agg': 'MUM C1→Agg',
  'link-del-agg-en': 'DEL Agg→North',
  'link-del-agg-es': 'DEL Agg→South',
  'link-mum-agg-ec': 'MUM Agg→Central',
  'link-mum-agg-eh': 'MUM Agg→Harbor',
  'link-en-olt1': 'DEL North→OLT',
  'link-es-olt1': 'DEL South→OLT',
  'link-ec-olt1': 'MUM Central→OLT',
  'link-eh-olt1': 'MUM Harbor→OLT',
};

function getBarColor(util: number, status: string) {
  if (status === 'down') return '#ff2222';
  if (util > 80) return '#ff4444';
  if (util > 60) return '#ffaa00';
  return '#00ff88';
}

export default function LinkUtilizationBar({ links, onLinkClick }: Props) {
  const linkArray = Object.values(links)
    .map((l) => ({
      id: l.link_id,
      name: FRIENDLY_LINKS[l.link_id] || l.link_id,
      utilization: l.utilization_percent || 0,
      throughput: l.throughput_gbps || 0,
      capacity: l.capacity_gbps || 0,
      status: l.status,
    }))
    .sort((a, b) => b.utilization - a.utilization);

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-noc-green" />
          <span className="text-xs font-bold text-noc-muted uppercase tracking-wider">
            Link Utilization
          </span>
        </div>
        <span className="text-[10px] text-noc-muted">Live</span>
      </div>

      {linkArray.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-noc-muted text-xs">
          Waiting for link data...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={linkArray}
            layout="vertical"
            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e2560"
              strokeOpacity={0.5}
              horizontal={false}
            />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: '#8892b0' }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={105}
              tick={{ fontSize: 9, fill: '#8892b0' }}
              onClick={(e: any) => {
                if (e?.value) {
                  const link = linkArray.find((l) => l.name === e.value);
                  if (link) onLinkClick?.(link.id);
                }
              }}
              style={{ cursor: 'pointer' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#161b4a',
                border: '1px solid #1e2560',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              formatter={(value: number, _: string, item: any) => [
                `${value.toFixed(1)}% (${item.payload.throughput.toFixed(1)}/${item.payload.capacity} Gbps)`,
                'Utilization',
              ]}
              labelFormatter={(label) => label}
            />
            <Bar dataKey="utilization" radius={[0, 4, 4, 0]} barSize={14}>
              {linkArray.map((entry) => (
                <Cell
                  key={entry.id}
                  fill={getBarColor(entry.utilization, entry.status)}
                  fillOpacity={entry.status === 'down' ? 0.5 : 0.8}
                  cursor="pointer"
                  onClick={() => onLinkClick?.(entry.id)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
