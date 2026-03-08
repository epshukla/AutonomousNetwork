import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, AlertTriangle, RotateCcw, Settings2, Timer } from 'lucide-react';
import { ScenarioMeta, ScenarioDefaults } from '../../api/chaos';

interface ScenarioControlsProps {
  scenario: ScenarioMeta | null;
  onLaunch: (scenarioType: string, parameters: ScenarioDefaults) => Promise<void>;
  isLaunching?: boolean;
}

const paramLabels: Record<string, string> = {
  link_id: 'Link ID',
  device_id: 'Device ID',
  target_device: 'Target Device',
  initial_link: 'Initial Link',
  latency_increase_ms: 'Latency Increase (ms)',
  loss_increase_percent: 'Loss Increase (%)',
  ramp_seconds: 'Ramp Time (seconds)',
  traffic_multiplier: 'Traffic Multiplier',
  leaked_prefixes: 'Leaked Prefixes',
  cascade_delay_seconds: 'Cascade Delay (seconds)',
  leak_rate_percent_per_minute: 'Leak Rate (%/min)',
  crash_threshold: 'Crash Threshold (%)',
  flap_interval_seconds: 'Flap Interval (seconds)',
};

export const ScenarioControls: React.FC<ScenarioControlsProps> = ({ scenario, onLaunch, isLaunching }) => {
  const [parameters, setParameters] = useState<ScenarioDefaults>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [autoStop, setAutoStop] = useState(false);
  const [autoStopSeconds, setAutoStopSeconds] = useState(300);

  useEffect(() => {
    if (scenario) {
      const { duration_seconds, ...rest } = scenario.default_params;
      setParameters({ ...rest });
      setAutoStop(false);
      setAutoStopSeconds(300);
      setShowConfirm(false);
    }
  }, [scenario]);

  if (!scenario) {
    return (
      <div className="glass-card p-8 text-center">
        <Settings2 size={48} className="text-noc-muted mx-auto mb-4 opacity-30" />
        <p className="text-noc-muted text-lg">Select a scenario to configure</p>
        <p className="text-noc-muted/60 text-sm mt-2">Choose from the scenario library or the dropdown above</p>
      </div>
    );
  }

  const handleParamChange = (key: string, value: string) => {
    const numVal = Number(value);
    setParameters((prev) => ({
      ...prev,
      [key]: isNaN(numVal) || value === '' ? value : numVal,
    }));
  };

  const handleReset = () => {
    const { duration_seconds, ...rest } = scenario.default_params;
    setParameters({ ...rest });
    setAutoStop(false);
    setAutoStopSeconds(300);
    setShowConfirm(false);
  };

  const buildLaunchParams = (): ScenarioDefaults => {
    const launchParams = { ...parameters };
    delete launchParams.duration_seconds;
    if (autoStop && autoStopSeconds > 0) {
      launchParams.duration_seconds = autoStopSeconds;
    }
    return launchParams;
  };

  const handleLaunchClick = () => {
    if (scenario.severity === 'critical' || scenario.severity === 'emergency') {
      setShowConfirm(true);
    } else {
      onLaunch(scenario.name, buildLaunchParams());
    }
  };

  const handleConfirmLaunch = () => {
    setShowConfirm(false);
    onLaunch(scenario.name, buildLaunchParams());
  };

  const isCritical = scenario.severity === 'critical' || scenario.severity === 'emergency';

  return (
    <div className="space-y-4">
      {/* Warning for critical scenarios */}
      <AnimatePresence>
        {isCritical && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-400/10 border border-red-400/30"
          >
            <AlertTriangle size={20} className="text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-400">
                {scenario.severity === 'emergency' ? 'EMERGENCY SCENARIO' : 'CRITICAL SCENARIO'}
              </p>
              <p className="text-xs text-red-400/70">
                This scenario will cause significant network disruption. Ensure you are prepared for impact.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parameter form */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-noc-muted">Parameters</h3>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-noc-muted hover:text-cyan-400 transition-colors"
          >
            <RotateCcw size={12} />
            Reset to defaults
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(parameters)
            .filter(([key]) => key !== 'duration_seconds')
            .map(([key, value]) => (
            <div key={key}>
              <label className="block text-xs font-mono text-noc-muted mb-1.5">
                {paramLabels[key] || key}
              </label>
              <input
                type={typeof value === 'number' ? 'number' : 'text'}
                value={String(value)}
                onChange={(e) => handleParamChange(key, e.target.value)}
                step={typeof value === 'number' && String(value).includes('.') ? '0.1' : '1'}
                className="w-full px-3 py-2 bg-noc-bg border border-noc-border rounded-lg text-sm text-noc-text font-mono focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
              />
            </div>
          ))}
        </div>

        {/* Auto-stop toggle */}
        <div className="mt-4 pt-4 border-t border-noc-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer size={14} className="text-noc-muted" />
              <span className="text-xs font-semibold uppercase tracking-wider text-noc-muted">Auto-Stop Timer</span>
            </div>
            <button
              onClick={() => setAutoStop(!autoStop)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                autoStop ? 'bg-cyan-400/30' : 'bg-noc-border'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${
                  autoStop ? 'translate-x-5 bg-cyan-400' : 'translate-x-0 bg-noc-muted'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-noc-muted/60 mt-1">
            {autoStop ? 'Scenario will auto-stop after the specified duration' : 'Scenario will run until manually stopped'}
          </p>
          <AnimatePresence>
            {autoStop && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3">
                  <label className="block text-xs font-mono text-noc-muted mb-1.5">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    value={autoStopSeconds}
                    onChange={(e) => setAutoStopSeconds(Number(e.target.value) || 0)}
                    min={10}
                    step={10}
                    className="w-full px-3 py-2 bg-noc-bg border border-noc-border rounded-lg text-sm text-noc-text font-mono focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Launch / Confirm */}
      <AnimatePresence mode="wait">
        {showConfirm ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card p-6 border-red-400/30"
          >
            <div className="text-center mb-4">
              <AlertTriangle size={36} className="text-red-400 mx-auto mb-2" />
              <p className="text-lg font-bold text-red-400">Confirm Launch</p>
              <p className="text-sm text-noc-muted mt-1">
                You are about to launch <strong className="text-noc-text">{scenario.display_name}</strong> ({scenario.severity.toUpperCase()}).
                This action will disrupt the network.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-3 rounded-lg border border-noc-border text-noc-muted hover:text-noc-text hover:border-noc-text/30 transition-all font-semibold"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirmLaunch}
                disabled={isLaunching}
                className="flex-1 launch-button px-4 py-3 flex items-center justify-center gap-2 text-lg disabled:opacity-50"
              >
                {isLaunching ? (
                  <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <>
                    <AlertTriangle size={20} />
                    CONFIRM LAUNCH
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="launch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLaunchClick}
              disabled={isLaunching}
              className={`w-full launch-button px-6 py-5 flex items-center justify-center gap-3 text-xl ${
                isLaunching ? 'opacity-50' : ''
              }`}
              style={{
                animation: isCritical ? 'pulseRed 2s ease-in-out infinite' : undefined,
              }}
            >
              {isLaunching ? (
                <span className="animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <>
                  <Play size={24} fill="white" />
                  LAUNCH {scenario.display_name.toUpperCase()}
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ScenarioControls;
