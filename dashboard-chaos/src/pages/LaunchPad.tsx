import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Timer, Square, AlertTriangle, Crosshair, ChevronDown } from 'lucide-react';
import { SCENARIOS, ScenarioMeta } from '../api/chaos';
import { useChaos } from '../hooks/useChaos';
import ScenarioCard from '../components/scenarios/ScenarioCard';
import ScenarioControls from '../components/scenarios/ScenarioControls';
import StatusDot from '../components/common/StatusDot';

const LaunchPad: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { activeScenarios, startScenario, stopScenario } = useChaos();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('scenario'));
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [elapsedTimers, setElapsedTimers] = useState<Record<string, number>>({});

  const selectedScenario = useMemo(
    () => SCENARIOS.find((s) => s.name === selectedId) || null,
    [selectedId]
  );

  // Update elapsed timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      const timers: Record<string, number> = {};
      activeScenarios.forEach((s) => {
        const startTime = new Date(s.started_at).getTime();
        timers[s.scenario_name] = Math.floor((Date.now() - startTime) / 1000);
      });
      setElapsedTimers(timers);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeScenarios]);

  const handleLaunch = async (scenarioType: string, parameters: any) => {
    setIsLaunching(true);
    setLaunchError(null);
    try {
      await startScenario(scenarioType, parameters);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Failed to launch scenario');
    } finally {
      setIsLaunching(false);
    }
  };

  const handleStop = async (scenarioId: string) => {
    try {
      await stopScenario(scenarioId);
    } catch (err) {
      console.error('Failed to stop scenario:', err);
    }
  };

  const formatTimer = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-red-400/10 border border-red-400/20">
          <Rocket size={24} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-noc-text">Launch Pad</h1>
          <p className="text-sm text-noc-muted">
            Configure and deploy chaos scenarios
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Scenario selection and config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Scenario selector */}
          <div className="glass-card p-4">
            <label className="block text-xs font-semibold uppercase tracking-wider text-noc-muted mb-3">
              <Crosshair size={12} className="inline mr-1.5" />
              Select Scenario
            </label>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full flex items-center justify-between px-4 py-3 bg-noc-bg border border-noc-border rounded-lg text-left hover:border-cyan-400/30 transition-all"
              >
                {selectedScenario ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-noc-text">
                      {selectedScenario.display_name}
                    </span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                      selectedScenario.severity === 'emergency' ? 'bg-red-500/20 text-red-400' :
                      selectedScenario.severity === 'critical' ? 'bg-red-400/10 text-red-400' :
                      selectedScenario.severity === 'high' ? 'bg-amber-400/10 text-amber-400' :
                      'bg-cyan-400/10 text-cyan-400'
                    }`}>
                      {selectedScenario.severity.toUpperCase()}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-noc-muted">Choose a scenario...</span>
                )}
                <ChevronDown size={16} className={`text-noc-muted transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-noc-surface border border-noc-border rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto"
                  >
                    {SCENARIOS.map((scenario) => (
                      <button
                        key={scenario.name}
                        onClick={() => {
                          setSelectedId(scenario.name);
                          setShowDropdown(false);
                          setLaunchError(null);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-noc-bg/50 transition-colors border-b border-noc-border/30 last:border-0 ${
                          selectedId === scenario.name ? 'bg-cyan-400/5' : ''
                        }`}
                      >
                        <div className="flex-1">
                          <span className="text-sm font-medium text-noc-text">{scenario.display_name}</span>
                          <span className="text-xs text-noc-muted ml-2">{scenario.category}</span>
                        </div>
                        <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                          scenario.severity === 'emergency' ? 'bg-red-500/20 text-red-400' :
                          scenario.severity === 'critical' ? 'bg-red-400/10 text-red-400' :
                          scenario.severity === 'high' ? 'bg-amber-400/10 text-amber-400' :
                          'bg-cyan-400/10 text-cyan-400'
                        }`}>
                          {scenario.severity.toUpperCase()}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Scenario details & controls */}
          {selectedScenario && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="glass-card p-6 mb-6">
                <h3 className="text-lg font-bold text-noc-text mb-2">{selectedScenario.display_name}</h3>
                <p className="text-sm text-noc-muted leading-relaxed mb-4">{selectedScenario.description}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-noc-muted mb-2 font-semibold">Expected Effects</h4>
                    <ul className="space-y-1">
                      {selectedScenario.expected_effects.map((e, i) => (
                        <li key={i} className="text-xs text-noc-text/80 flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-red-400" />
                          {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-noc-muted mb-2 font-semibold">Affected Components</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedScenario.affected_components.map((a, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-noc-bg border border-noc-border text-noc-muted font-mono">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Controls */}
          <ScenarioControls
            scenario={selectedScenario}
            onLaunch={handleLaunch}
            isLaunching={isLaunching}
          />

          {/* Error display */}
          <AnimatePresence>
            {launchError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-red-400/10 border border-red-400/30"
              >
                <AlertTriangle size={18} className="text-red-400" />
                <p className="text-sm text-red-400">{launchError}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Active scenarios */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-noc-muted flex items-center gap-2">
            <Timer size={14} />
            Active Scenarios
            {activeScenarios.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 text-xs font-mono">
                {activeScenarios.length}
              </span>
            )}
          </h2>

          {activeScenarios.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Crosshair size={36} className="text-noc-muted/30 mx-auto mb-3" />
              <p className="text-noc-muted text-sm">No active scenarios</p>
              <p className="text-xs text-noc-muted/60 mt-1">Launch a scenario to see it here</p>
            </div>
          ) : (
            activeScenarios.map((scenario) => {
              const meta = SCENARIOS.find((s) => s.name === scenario.scenario_name);
              const elapsed = elapsedTimers[scenario.scenario_name] || 0;
              const params = scenario.params || {};
              const duration = (params.duration_seconds as number) || 300;
              const progress = Math.min((elapsed / duration) * 100, 100);

              return (
                <motion.div
                  key={scenario.scenario_name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card p-4 border-red-400/30"
                  style={{ animation: 'pulseRed 3s ease-in-out infinite' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <StatusDot status="running" size="sm" />
                      <span className="text-sm font-semibold text-noc-text">
                        {meta?.display_name || scenario.scenario_name}
                      </span>
                    </div>
                    <span className="text-lg font-mono font-bold text-red-400 tabular-nums">
                      {formatTimer(elapsed)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-noc-bg rounded-full mb-3 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-red-400 to-amber-400"
                      style={{ width: `${progress}%` }}
                      transition={{ duration: 1 }}
                    />
                  </div>

                  {/* Params summary */}
                  <div className="text-xs text-noc-muted font-mono mb-3 space-y-0.5">
                    {Object.entries(params).slice(0, 3).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span>{k}:</span>
                        <span className="text-noc-text">{String(v)}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleStop(scenario.scenario_name)}
                    className="w-full stop-button px-4 py-2.5 flex items-center justify-center gap-2 text-sm"
                  >
                    <Square size={14} fill="currentColor" />
                    STOP SCENARIO
                  </button>
                </motion.div>
              );
            })
          )}

          {/* Quick launch cards */}
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-noc-muted mb-3">Quick Select</h3>
            <div className="space-y-2">
              {SCENARIOS.slice(0, 4).map((scenario) => (
                <ScenarioCard
                  key={scenario.name}
                  scenario={scenario}
                  compact
                  isActive={selectedId === scenario.name}
                  onClick={() => {
                    setSelectedId(scenario.name);
                    setLaunchError(null);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LaunchPad;
