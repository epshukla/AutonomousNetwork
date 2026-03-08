import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Copy,
  Download,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import type { CertInReport } from '../../api/simulator';
import { getCertInReport } from '../../api/simulator';

interface Props {
  onClose: () => void;
}

const INCIDENT_TYPES: { value: string; label: string }[] = [
  { value: 'network_intrusion', label: 'Network Intrusion' },
  { value: 'data_breach', label: 'Data Breach' },
  { value: 'dos_attack', label: 'DoS Attack' },
  { value: 'malware', label: 'Malware' },
  { value: 'unauthorized_access', label: 'Unauthorized Access' },
];

function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'bg-noc-red/20 text-noc-red border-noc-red/30';
    case 'high':
      return 'bg-noc-amber/20 text-noc-amber border-noc-amber/30';
    case 'medium':
      return 'bg-noc-cyan/20 text-noc-cyan border-noc-cyan/30';
    case 'low':
      return 'bg-noc-green/20 text-noc-green border-noc-green/30';
    default:
      return 'bg-noc-muted/20 text-noc-muted border-noc-muted/30';
  }
}

function formatReportAsText(report: CertInReport): string {
  const lines: string[] = [];
  lines.push('=== CERT-In Incident Report ===');
  lines.push('');
  lines.push(`Organization: ${report.organization}`);
  lines.push(`Sector: ${report.sector}`);
  lines.push(`Incident Type: ${report.incident_type}`);
  lines.push(`Severity: ${report.severity}`);
  lines.push(`Classification: ${report.incident_classification}`);
  lines.push(`Generated At: ${report.generated_at}`);
  lines.push('');
  lines.push('--- Timeline ---');
  report.timeline.forEach((entry) => {
    lines.push(`  [${entry.time}] ${entry.event}`);
  });
  lines.push('');
  lines.push('--- Affected Systems ---');
  report.affected_systems.forEach((sys) => {
    lines.push(`  - ${sys}`);
  });
  lines.push('');
  lines.push('--- Remediation Steps ---');
  report.remediation_steps.forEach((step, i) => {
    lines.push(`  ${i + 1}. ${step}`);
  });
  lines.push('');
  lines.push('--- Reporting Compliance ---');
  lines.push(
    `  Within 6 Hours: ${report.reporting_compliance.within_6_hours ? 'Yes' : 'No'}`
  );
  lines.push(`  Reported At: ${report.reporting_compliance.reported_at}`);
  lines.push(`  Deadline: ${report.reporting_compliance.deadline}`);
  lines.push(`  Regulation: ${report.reporting_compliance.regulation}`);
  lines.push('');
  lines.push('--- Contact Information ---');
  lines.push(`  Name: ${report.contact.name}`);
  lines.push(`  Designation: ${report.contact.designation}`);
  lines.push(`  Phone: ${report.contact.phone}`);
  lines.push(`  Email: ${report.contact.email}`);
  return lines.join('\n');
}

export default function CertInReportModal({ onClose }: Props) {
  const [selectedType, setSelectedType] = useState('network_intrusion');
  const [report, setReport] = useState<CertInReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getCertInReport(selectedType)
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch report');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedType]);

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(formatReportAsText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  const handleDownload = () => {
    if (!report) return;
    const text = formatReportAsText(report);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certin-report-${selectedType}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ x: 500, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 500, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 bottom-0 w-[520px] z-50 bg-noc-bg/95 backdrop-blur-xl border-l border-noc-border/50 overflow-y-auto"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-noc-cyan" />
            <h2 className="text-sm font-bold text-noc-text tracking-wide">
              CERT-In Incident Report
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-noc-surface/60 text-noc-muted hover:text-noc-text transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Incident Type Selector */}
        <div className="mb-5">
          <label className="text-[10px] font-bold text-noc-muted uppercase tracking-wider mb-2 block">
            Incident Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-noc-surface/50 border border-noc-border/50 text-noc-text text-xs focus:outline-none focus:border-noc-cyan/50 transition-colors"
          >
            {INCIDENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-noc-cyan/30 border-t-noc-cyan rounded-full animate-spin" />
            <span className="ml-3 text-xs text-noc-muted">Loading report...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-4 bg-noc-red/10 border border-noc-red/30 rounded-lg text-xs text-noc-red">
            <AlertTriangle className="w-4 h-4 inline-block mr-2" />
            {error}
          </div>
        )}

        {/* Report Content */}
        {report && !loading && !error && (
          <div>
            {/* Organization Info */}
            <div className="mb-4 p-3 bg-noc-surface/30 rounded-lg">
              <div className="text-[10px] font-bold text-noc-muted uppercase tracking-wider mb-2">
                Organization Info
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-noc-muted">Organization</span>
                  <span className="text-xs text-noc-text font-medium">
                    {report.organization}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-noc-muted">Sector</span>
                  <span className="text-xs text-noc-text font-medium">
                    {report.sector}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-noc-muted">Severity</span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityColor(report.severity)}`}
                  >
                    {report.severity}
                  </span>
                </div>
              </div>
            </div>

            {/* Incident Classification */}
            <div className="mb-4 p-3 bg-noc-surface/30 rounded-lg">
              <div className="text-[10px] font-bold text-noc-muted uppercase tracking-wider mb-2">
                Incident Classification
              </div>
              <div className="p-2.5 bg-noc-cyan/5 border border-noc-cyan/20 rounded-lg text-xs text-noc-text leading-relaxed">
                {report.incident_classification}
              </div>
            </div>

            {/* Timeline */}
            <div className="mb-4 p-3 bg-noc-surface/30 rounded-lg">
              <div className="text-[10px] font-bold text-noc-muted uppercase tracking-wider mb-2">
                <Clock className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                Timeline
              </div>
              <div className="relative ml-2">
                {report.timeline.map((entry, i) => (
                  <div key={i} className="flex items-start gap-3 relative pb-3 last:pb-0">
                    {/* Vertical line */}
                    {i < report.timeline.length - 1 && (
                      <div className="absolute left-[5px] top-[14px] bottom-0 w-px bg-noc-border/60" />
                    )}
                    {/* Dot */}
                    <div className="w-[11px] h-[11px] rounded-full bg-noc-cyan/30 border-2 border-noc-cyan flex-shrink-0 mt-0.5" />
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-noc-text">{entry.event}</div>
                      <div className="text-[10px] text-noc-muted mt-0.5">
                        {entry.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Affected Systems */}
            <div className="mb-4 p-3 bg-noc-surface/30 rounded-lg">
              <div className="text-[10px] font-bold text-noc-muted uppercase tracking-wider mb-2">
                Affected Systems
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.affected_systems.map((sys) => (
                  <span
                    key={sys}
                    className="px-2 py-1 bg-noc-surface/60 border border-noc-border/40 rounded text-[11px] font-mono text-noc-text"
                  >
                    {sys}
                  </span>
                ))}
              </div>
            </div>

            {/* Remediation Steps */}
            <div className="mb-4 p-3 bg-noc-surface/30 rounded-lg">
              <div className="text-[10px] font-bold text-noc-muted uppercase tracking-wider mb-2">
                Remediation Steps
              </div>
              <ol className="space-y-1.5">
                {report.remediation_steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-noc-text">
                    <span className="text-noc-cyan font-bold flex-shrink-0 w-4 text-right">
                      {i + 1}.
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Reporting Compliance */}
            <div className="mb-4 p-3 bg-noc-surface/30 rounded-lg">
              <div className="text-[10px] font-bold text-noc-muted uppercase tracking-wider mb-2">
                Reporting Compliance
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {report.reporting_compliance.within_6_hours ? (
                    <CheckCircle className="w-4 h-4 text-noc-green flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-noc-red flex-shrink-0" />
                  )}
                  <span
                    className={`text-xs font-medium ${
                      report.reporting_compliance.within_6_hours
                        ? 'text-noc-green'
                        : 'text-noc-red'
                    }`}
                  >
                    {report.reporting_compliance.within_6_hours
                      ? 'Reported within 6-hour window'
                      : 'Exceeded 6-hour reporting window'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-noc-muted block">Reported At</span>
                    <span className="text-xs text-noc-text font-mono">
                      {report.reporting_compliance.reported_at}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-noc-muted block">Deadline</span>
                    <span className="text-xs text-noc-text font-mono">
                      {report.reporting_compliance.deadline}
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-noc-surface/40 rounded text-[11px] text-noc-muted leading-relaxed">
                  {report.reporting_compliance.regulation}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="mb-4 p-3 bg-noc-surface/30 rounded-lg">
              <div className="text-[10px] font-bold text-noc-muted uppercase tracking-wider mb-2">
                Contact Information
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-noc-muted">Name</span>
                  <span className="text-xs text-noc-text">{report.contact.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-noc-muted">Designation</span>
                  <span className="text-xs text-noc-text">
                    {report.contact.designation}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-noc-muted">Phone</span>
                  <span className="text-xs text-noc-text font-mono">
                    {report.contact.phone}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-noc-muted">Email</span>
                  <span className="text-xs text-noc-text font-mono">
                    {report.contact.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2 pb-4">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-noc-surface/60 border border-noc-border/50 text-noc-text hover:bg-noc-surface hover:border-noc-cyan/30 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied' : 'Copy to Clipboard'}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-noc-cyan/10 border border-noc-cyan/30 text-noc-cyan hover:bg-noc-cyan/20 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download Report
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
