import { useState } from 'react';
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useComplianceStatus, useSLAData } from '../hooks/useTelemetry';
// CertInReportModal is self-fetching
import CertInReportModal from '../components/compliance/CertInReportModal';

// ── Status helpers ───────────────────────────────────────────

function overallBadgeClasses(status: string): string {
  const base = 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase';
  switch (status) {
    case 'compliant':
      return `${base} bg-noc-green/10 text-noc-green border border-noc-green/30`;
    case 'warning':
      return `${base} bg-noc-amber/10 text-noc-amber border border-noc-amber/30`;
    case 'violation':
      return `${base} bg-noc-red/10 text-noc-red border border-noc-red/30`;
    default:
      return `${base} bg-noc-surface/30 text-noc-muted border border-noc-border`;
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'compliant':
    case 'pass':
      return <CheckCircle className="w-4 h-4 text-noc-green" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-noc-amber" />;
    case 'violation':
    case 'fail':
      return <XCircle className="w-4 h-4 text-noc-red" />;
    default:
      return <Clock className="w-4 h-4 text-noc-muted" />;
  }
}

function uptimeBarColor(uptime: number): string {
  if (uptime >= 99) return 'bg-noc-green';
  if (uptime >= 95) return 'bg-noc-amber';
  return 'bg-noc-red';
}

function uptimeTextColor(uptime: number): string {
  if (uptime >= 99) return 'text-noc-green';
  if (uptime >= 95) return 'text-noc-amber';
  return 'text-noc-red';
}

// ── Main Component ───────────────────────────────────────────

export default function Compliance() {
  const { data: compliance, loading: complianceLoading } = useComplianceStatus();
  const { data: sla, loading: slaLoading } = useSLAData();

  const [expandedBodies, setExpandedBodies] = useState<Record<number, boolean>>({});
  const [showReportModal, setShowReportModal] = useState(false);

  const loading = complianceLoading || slaLoading;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
        <p className="text-sm text-noc-muted">Waiting for compliance data...</p>
      </div>
    );
  }

  // ── SLA Gauge calculations ─────────────────────────────────

  const uptimePercent = sla?.overall_uptime_percent ?? 0;
  const slaTarget = sla?.sla_target ?? 99.95;
  const meetsTarget = uptimePercent >= slaTarget;

  const gaugeRadius = 80;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeProgress = (Math.min(uptimePercent, 100) / 100) * gaugeCircumference;
  const gaugeOffset = gaugeCircumference - gaugeProgress;
  const gaugeColor = meetsTarget ? '#00ff88' : '#ff4444';

  const toggleBody = (index: number) => {
    setExpandedBodies((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleGenerateReport = () => {
    setShowReportModal(true);
  };

  // ── Tier entries ───────────────────────────────────────────

  const tierEntries = sla?.tiers ? Object.entries(sla.tiers) : [];

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-noc-cyan/10 border border-noc-cyan/20">
            <Shield className="w-5 h-5 text-noc-cyan" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Regulatory Compliance</h1>
            <p className="text-sm text-noc-muted mt-0.5">
              Indian telecom regulatory status and SLA monitoring
            </p>
          </div>
        </div>
        {compliance && (
          <span className={overallBadgeClasses(compliance.overall_status)}>
            {compliance.overall_status}
          </span>
        )}
      </div>

      {/* ── SLA Gauge Section ───────────────────────────────── */}
      {sla && (
        <div className="grid grid-cols-2 gap-6">
          {/* Left: Circular SVG Gauge */}
          <div className="glass-card p-6 flex flex-col items-center justify-center">
            <h3 className="text-sm font-semibold text-noc-muted uppercase tracking-wider mb-4">
              Overall Uptime vs SLA Target ({slaTarget}%)
            </h3>
            <div className="relative w-48 h-48">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                {/* Background ring */}
                <circle
                  cx="100"
                  cy="100"
                  r={gaugeRadius}
                  fill="none"
                  stroke="#1e2560"
                  strokeWidth="12"
                />
                {/* Progress arc */}
                <circle
                  cx="100"
                  cy="100"
                  r={gaugeRadius}
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeOffset}
                  style={{
                    filter: meetsTarget
                      ? 'drop-shadow(0 0 8px rgba(0,255,136,0.5))'
                      : 'drop-shadow(0 0 8px rgba(255,68,68,0.5))',
                    transition: 'stroke-dashoffset 1s ease-out',
                  }}
                />
                {/* Target marker */}
                <circle
                  cx="100"
                  cy="100"
                  r={gaugeRadius}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1"
                  strokeDasharray="2 500"
                  strokeDashoffset={gaugeCircumference - (slaTarget / 100) * gaugeCircumference}
                  opacity={0.4}
                />
              </svg>
              {/* Center content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                  className="font-mono text-2xl font-black"
                  style={{
                    color: gaugeColor,
                    textShadow: `0 0 16px ${gaugeColor}40`,
                  }}
                >
                  {uptimePercent.toFixed(3)}%
                </span>
                <span className="text-[10px] text-noc-muted mt-1">
                  Target: {slaTarget}%
                </span>
              </div>
            </div>
          </div>

          {/* Right: 2x2 stat boxes */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card p-4 flex flex-col justify-center">
              <span className="text-[10px] text-noc-muted uppercase tracking-wider">
                Backbone Uptime
              </span>
              <span className="font-mono text-2xl font-bold text-noc-cyan mt-1">
                {(sla.backbone_uptime_percent ?? 0).toFixed(3)}%
              </span>
            </div>
            <div className="glass-card p-4 flex flex-col justify-center">
              <span className="text-[10px] text-noc-muted uppercase tracking-wider">MTTR</span>
              <span className="font-mono text-2xl font-bold text-noc-amber mt-1">
                {(sla.mttr_minutes ?? 0).toFixed(1)}
                <span className="text-sm text-noc-muted ml-1">min</span>
              </span>
            </div>
            <div className="glass-card p-4 flex flex-col justify-center">
              <span className="text-[10px] text-noc-muted uppercase tracking-wider">
                Monthly Downtime
              </span>
              <span className="font-mono text-2xl font-bold text-noc-red mt-1">
                {(sla.current_month_downtime_minutes ?? 0).toFixed(1)}
                <span className="text-sm text-noc-muted ml-1">min</span>
              </span>
            </div>
            <div className="glass-card p-4 flex flex-col justify-center">
              <span className="text-[10px] text-noc-muted uppercase tracking-wider">
                Incidents
              </span>
              <span className="font-mono text-2xl font-bold text-noc-text mt-1">
                {sla.incidents_this_month ?? 0}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Per-Tier Uptime Bars ────────────────────────────── */}
      {tierEntries.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-noc-muted uppercase tracking-wider mb-4">
            Per-Tier Uptime
          </h3>
          <div className="space-y-3">
            {tierEntries.map(([tierName, tierData]) => {
              const uptime = tierData.uptime ?? 0;
              return (
                <div key={tierName}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-noc-text capitalize">
                      {tierName.replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-noc-muted">
                        {tierData.devices} device{tierData.devices !== 1 ? 's' : ''}
                      </span>
                      <span className={`font-mono text-sm font-bold ${uptimeTextColor(uptime)}`}>
                        {uptime.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-noc-bg/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${uptimeBarColor(uptime)}`}
                      style={{ width: `${Math.min(uptime, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Regulatory Body Cards ───────────────────────────── */}
      {compliance && compliance.bodies.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-noc-muted uppercase tracking-wider mb-4">
            Regulatory Bodies
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {compliance.bodies.map((body, index) => {
              const isExpanded = expandedBodies[index] ?? false;
              return (
                <div key={index} className="glass-card p-4">
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={body.status} />
                      <span className="text-sm font-bold text-noc-text">{body.name}</span>
                    </div>
                    <span className={overallBadgeClasses(body.status)}>{body.status}</span>
                  </div>

                  {/* Audit dates */}
                  <div className="flex items-center gap-1 text-[10px] text-noc-muted mb-3">
                    <Clock className="w-3 h-3" />
                    <span>Last: {body.last_audit}</span>
                    <span className="mx-1">/</span>
                    <span>Next: {body.next_audit}</span>
                  </div>

                  {/* Expandable checks */}
                  {body.checks && body.checks.length > 0 && (
                    <>
                      <button
                        onClick={() => toggleBody(index)}
                        className="flex items-center gap-1 text-xs text-noc-cyan hover:text-noc-cyan/80 transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        <span>
                          {body.checks.length} check{body.checks.length !== 1 ? 's' : ''}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-2 border-t border-noc-border pt-3">
                          {body.checks.map((check, ci) => (
                            <div
                              key={ci}
                              className="flex items-start gap-2 bg-noc-surface/30 rounded-lg p-2"
                            >
                              <StatusIcon status={check.status} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-medium text-noc-text">
                                    {check.name}
                                  </span>
                                  <span className={overallBadgeClasses(check.status)}>
                                    {check.status}
                                  </span>
                                </div>
                                <p className="text-[10px] text-noc-muted mt-0.5 leading-relaxed">
                                  {check.detail}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Generate CERT-In Report Button ──────────────────── */}
      <div className="flex justify-center pt-2 pb-4">
        <button
          onClick={handleGenerateReport}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-noc-cyan/10 border border-noc-cyan/30 text-noc-cyan font-semibold text-sm hover:bg-noc-cyan/20 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Generate CERT-In Incident Report
        </button>
      </div>

      {/* ── CERT-In Report Modal ────────────────────────────── */}
      {showReportModal && (
        <CertInReportModal
          onClose={() => setShowReportModal(false)}
        />
      )}
    </div>
  );
}
