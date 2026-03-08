import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  TrendingDown,
  TrendingUp,
  Target,
  Gauge,
  BookOpen,
  BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import HealthBadge from '../components/common/HealthBadge';
import { getAgentMetrics, getLearningRecords, AgentMetrics, LearningRecord } from '../api/agent';
import { formatTimestamp } from '../utils/formatTimestamp';

export default function AgentIntelligence() {
  const [metrics, setMetrics] = useState<AgentMetrics | null>(null);
  const [learning, setLearning] = useState<LearningRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [m, l] = await Promise.all([getAgentMetrics(), getLearningRecords()]);
      setMetrics(m);
      setLearning(l);
      setLoading(false);
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-6 animate-pulse">
            <div className="h-6 bg-noc-border/30 rounded w-1/3 mb-4" />
            <div className="h-48 bg-noc-border/30 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const mttdData = metrics.mttd_trend.map((v, i) => ({
    index: i + 1,
    value: v,
    label: `T-${metrics.mttd_trend.length - i}`,
  }));

  const mttrData = metrics.mttr_trend.map((v, i) => ({
    index: i + 1,
    value: Math.round(v / 60),
    label: `T-${metrics.mttr_trend.length - i}`,
  }));

  const successRateData = metrics.decision_history.map((d) => ({
    date: new Date(d.timestamp).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    rate: Math.round(d.success_rate * 100),
    total: d.total,
  }));

  const thresholdData = metrics.threshold_evolution.map((d) => ({
    time: new Date(d.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
    value: Math.round(d.value * 10) / 10,
  }));

  const tierData = Object.entries(metrics.decisions_by_tier).map(([tier, count]) => ({
    name: `Tier ${tier}`,
    value: count,
    tier: parseInt(tier),
  }));

  const tierColors = ['#00ff88', '#00d4ff', '#ffaa00', '#ff4444'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-noc-surface/95 backdrop-blur-xl border border-noc-border/50 rounded-lg p-3 shadow-xl">
        <p className="text-xs text-noc-muted mb-1">{label}</p>
        {payload.map((entry: any, i: number) => (
          <p key={i} className="text-sm font-mono" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
            {entry.name === 'rate' ? '%' : ''}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Gauges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 flex flex-col items-center"
        >
          <div className="flex items-center gap-2 mb-3 self-start">
            <Gauge className="w-4 h-4 text-noc-cyan" />
            <span className="text-xs font-bold text-noc-muted uppercase tracking-wider">MTTD</span>
          </div>
          <div className="text-3xl font-bold text-noc-cyan font-mono mb-1">
            {metrics.mttd_seconds}s
          </div>
          <div className="text-xs text-noc-muted">Mean Time to Detect</div>
          <div className="flex items-center gap-1 mt-2 text-noc-green text-xs">
            <TrendingDown className="w-3 h-3" />
            <span>Improving</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-5 flex flex-col items-center"
        >
          <div className="flex items-center gap-2 mb-3 self-start">
            <Gauge className="w-4 h-4 text-noc-green" />
            <span className="text-xs font-bold text-noc-muted uppercase tracking-wider">MTTR</span>
          </div>
          <div className="text-3xl font-bold text-noc-green font-mono mb-1">
            {Math.round(metrics.mttr_seconds / 60)}m
          </div>
          <div className="text-xs text-noc-muted">Mean Time to Resolve</div>
          <div className="flex items-center gap-1 mt-2 text-noc-green text-xs">
            <TrendingDown className="w-3 h-3" />
            <span>-15% this week</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-5 flex flex-col items-center"
        >
          <div className="flex items-center gap-2 mb-3 self-start">
            <Target className="w-4 h-4 text-noc-amber" />
            <span className="text-xs font-bold text-noc-muted uppercase tracking-wider">Success Rate</span>
          </div>
          <HealthBadge score={Math.round(metrics.decision_success_rate * 100)} size="md" showLabel={false} />
          <div className="text-xs text-noc-muted mt-2">
            {metrics.successful_decisions}/{metrics.total_decisions} decisions
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5 flex flex-col items-center"
        >
          <div className="flex items-center gap-2 mb-3 self-start">
            <BarChart3 className="w-4 h-4 text-noc-purple" />
            <span className="text-xs font-bold text-noc-muted uppercase tracking-wider">By Tier</span>
          </div>
          <div className="w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={40}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {tierData.map((_, index) => (
                    <Cell key={index} fill={tierColors[index]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-2 mt-2">
            {tierData.map((d, i) => (
              <span key={i} className="text-[10px] font-mono" style={{ color: tierColors[i] }}>
                T{d.tier}:{d.value}
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MTTD Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <LineChartIcon className="w-4 h-4 text-noc-cyan" />
            <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider">
              MTTD Trend (seconds)
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mttdData}>
                <defs>
                  <linearGradient id="mttdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e256040" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8892b0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8892b0' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  fill="url(#mttdGrad)"
                  name="MTTD"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* MTTR Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <LineChartIcon className="w-4 h-4 text-noc-green" />
            <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider">
              MTTR Trend (minutes)
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mttrData}>
                <defs>
                  <linearGradient id="mttrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e256040" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8892b0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#8892b0' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#00ff88"
                  strokeWidth={2}
                  fill="url(#mttrGrad)"
                  name="MTTR"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Decision Success Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-noc-amber" />
            <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider">
              Decision Success Rate
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={successRateData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e256040" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8892b0' }} />
                <YAxis domain={[70, 100]} tick={{ fontSize: 11, fill: '#8892b0' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]} name="rate">
                  {successRateData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.rate >= 90 ? '#00ff88' : entry.rate >= 80 ? '#ffaa00' : '#ff4444'}
                      fillOpacity={0.7}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Threshold Evolution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-noc-purple" />
            <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider">
              Threshold Evolution
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={thresholdData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e256040" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#8892b0' }} interval={3} />
                <YAxis tick={{ fontSize: 11, fill: '#8892b0' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ fill: '#a855f7', r: 3 }}
                  name="Threshold"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Learning Records */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-5 border-b border-noc-border/20">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-noc-green" />
            <h3 className="text-sm font-bold text-noc-text uppercase tracking-wider">
              Learning Records
            </h3>
            <span className="ml-2 text-xs text-noc-muted">
              {learning.length} lessons learned
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-noc-border/20">
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Date</th>
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Incident Type</th>
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Lesson</th>
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Metric</th>
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Threshold Change</th>
                <th className="text-left p-3 text-xs font-bold text-noc-muted uppercase tracking-wider">Improvement</th>
              </tr>
            </thead>
            <tbody>
              {learning.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-noc-muted text-sm">
                    No learning records yet. The agent will record lessons as it resolves incidents.
                  </td>
                </tr>
              )}
              {learning.map((record) => (
                <tr key={record.id} className="border-b border-noc-border/10 hover:bg-noc-surface/20 transition-colors">
                  <td className="p-3 text-sm text-noc-muted font-mono whitespace-nowrap">
                    {formatTimestamp(record.timestamp)}
                  </td>
                  <td className="p-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-noc-cyan/10 text-noc-cyan">
                      {(record.incident_type || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-noc-text max-w-md">{record.lesson}</td>
                  <td className="p-3 text-sm text-noc-muted font-mono">{record.metric}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 text-xs font-mono">
                      <span className="text-noc-muted">{record.threshold_before}</span>
                      <span className="text-noc-cyan">-&gt;</span>
                      <span className="text-noc-text">{record.threshold_after}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="text-sm font-bold text-noc-green">+{record.improvement}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
