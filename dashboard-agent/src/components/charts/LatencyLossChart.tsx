import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Clock } from 'lucide-react';
import type { TopologyLink } from '../../api/agent';

interface Props {
  links: Record<string, TopologyLink>;
  onLinkClick?: (linkId: string) => void;
}

const FRIENDLY_LINKS: Record<string, string> = {
  'link-del-mum-primary': 'DEL↔MUM Pri',
  'link-del-mum-backup': 'DEL↔MUM Bak',
  'link-del-intra': 'DEL Intra',
  'link-mum-intra': 'MUM Intra',
  'link-del-c1-en': 'DC1→N',
  'link-del-c1-es': 'DC1→S',
  'link-del-c2-en': 'DC2→N',
  'link-del-c2-es': 'DC2→S',
  'link-mum-c1-ec': 'MC1→C',
  'link-mum-c1-eh': 'MC1→H',
  'link-mum-c2-ec': 'MC2→C',
  'link-mum-c2-eh': 'MC2→H',
  'link-del-peer': 'DEL Peer',
  'link-mum-peer': 'MUM Peer',
  'link-del-c1-agg': 'DC1→Agg',
  'link-mum-c1-agg': 'MC1→Agg',
  'link-del-agg-en': 'Agg→DN',
  'link-del-agg-es': 'Agg→DS',
  'link-mum-agg-ec': 'Agg→MC',
  'link-mum-agg-eh': 'Agg→MH',
  'link-en-olt1': 'DN→OLT',
  'link-es-olt1': 'DS→OLT',
  'link-ec-olt1': 'MC→OLT',
  'link-eh-olt1': 'MH→OLT',
};

export default function LatencyLossChart({ links, onLinkClick }: Props) {
  const linkArray = Object.values(links)
    .map((l) => ({
      id: l.link_id,
      name: FRIENDLY_LINKS[l.link_id] || l.link_id.slice(5),
      latency: l.latency_ms || 0,
      loss: l.packet_loss_percent || 0,
      status: l.status,
    }))
    .sort((a, b) => b.latency - a.latency);

  return (
    <div className="glass-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-noc-amber" />
          <span className="text-xs font-bold text-noc-muted uppercase tracking-wider">
            Latency & Packet Loss
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-noc-cyan inline-block rounded" />
            <span className="text-[9px] text-noc-muted">Latency</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-noc-red/60 inline-block rounded-sm" />
            <span className="text-[9px] text-noc-muted">Loss</span>
          </div>
        </div>
      </div>

      {linkArray.length === 0 ? (
        <div className="h-[280px] flex items-center justify-center text-noc-muted text-xs">
          Waiting for link data...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart
            data={linkArray}
            margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2560" strokeOpacity={0.5} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 8, fill: '#8892b0' }}
              angle={-45}
              textAnchor="end"
              height={50}
              interval={0}
            />
            <YAxis
              yAxisId="latency"
              tick={{ fontSize: 9, fill: '#8892b0' }}
              tickFormatter={(v) => `${v}ms`}
              orientation="left"
            />
            <YAxis
              yAxisId="loss"
              tick={{ fontSize: 9, fill: '#8892b0' }}
              tickFormatter={(v) => `${v}%`}
              orientation="right"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#161b4a',
                border: '1px solid #1e2560',
                borderRadius: '8px',
                fontSize: '11px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'latency') return [`${value.toFixed(2)} ms`, 'Latency'];
                return [`${value.toFixed(4)}%`, 'Packet Loss'];
              }}
            />
            <ReferenceLine
              yAxisId="latency"
              y={20}
              stroke="#ffaa00"
              strokeDasharray="5 5"
              strokeOpacity={0.6}
            />
            <ReferenceLine
              yAxisId="loss"
              y={1}
              stroke="#ff4444"
              strokeDasharray="5 5"
              strokeOpacity={0.6}
            />
            <Bar
              yAxisId="loss"
              dataKey="loss"
              fill="#ff4444"
              fillOpacity={0.4}
              radius={[2, 2, 0, 0]}
              barSize={12}
            >
              {linkArray.map((entry) => (
                <Cell
                  key={entry.id}
                  cursor="pointer"
                  onClick={() => onLinkClick?.(entry.id)}
                />
              ))}
            </Bar>
            <Line
              yAxisId="latency"
              type="monotone"
              dataKey="latency"
              stroke="#00d4ff"
              strokeWidth={2}
              dot={{ r: 3, fill: '#00d4ff', strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: '#00d4ff', strokeWidth: 2, fill: '#161b4a' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
