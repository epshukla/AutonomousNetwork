import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Library,
  Rocket,
  Activity,
  History,
  Flame,
  ChevronLeft,
  ChevronRight,
  Skull,
  Zap,
} from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import ScenarioLibrary from './pages/ScenarioLibrary';
import LaunchPad from './pages/LaunchPad';
import ImpactView from './pages/ImpactView';
import HistoryPage from './pages/History';

const navItems = [
  { path: '/scenarios', label: 'Scenario Library', icon: Library },
  { path: '/launch', label: 'Launch Pad', icon: Rocket },
  { path: '/impact', label: 'Impact View', icon: Activity },
  { path: '/history', label: 'History', icon: History },
];

function NtpBadge() {
  const [synced, setSynced] = useState(true);

  useEffect(() => {
    const BASE = import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:8000';
    const poll = async () => {
      try {
        const res = await fetch(`${BASE}/api/v1/compliance/status`);
        if (res.ok) {
          const data = await res.json();
          setSynced(data.ntp_synced ?? true);
        }
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-noc-green' : 'bg-noc-red animate-pulse'}`} />
      <span className="text-[10px] text-noc-muted">{synced ? 'NTP Synced' : 'NTP Desync'}</span>
    </div>
  );
}

const App: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 72 : 240 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex-shrink-0 flex flex-col bg-noc-surface/50 backdrop-blur-xl border-r border-noc-border h-screen relative z-20"
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-noc-border flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-red-500/20">
            <Skull size={20} className="text-white" />
          </div>
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <h1 className="text-sm font-bold text-noc-text tracking-wide">CHAOS LAB</h1>
                <p className="text-xs text-noc-muted">Network Resilience</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group relative ${
                  isActive
                    ? 'bg-red-400/10 text-red-400 border border-red-400/20'
                    : 'text-noc-muted hover:text-noc-text hover:bg-noc-bg/50'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={`flex-shrink-0 ${isActive ? 'text-red-400' : ''}`} />
                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-sm font-medium whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-red-400"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-2 border-t border-noc-border flex-shrink-0">
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 py-2 mb-2"
              >
                <div className="flex items-center gap-2 text-xs text-noc-muted">
                  <Zap size={12} className="text-red-400" />
                  <span className="font-mono">Chaos Engineering v1.0</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-noc-muted hover:text-noc-text hover:bg-noc-bg/50 transition-all"
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs"
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="min-h-screen grid-bg">
          {/* Top bar */}
          <header className="sticky top-0 z-10 backdrop-blur-xl bg-noc-bg/80 border-b border-noc-border">
            <div className="flex items-center justify-between px-6 h-14">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-red-400" />
                <span className="text-xs font-mono text-noc-muted uppercase tracking-widest">
                  Autonomous Network // Chaos Laboratory
                </span>
              </div>
              <div className="flex items-center gap-3">
                <NtpBadge />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-noc-surface border border-noc-border">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-noc-muted font-mono">SYSTEM ONLINE</span>
                </div>
              </div>
            </div>
          </header>

          {/* Page content */}
          <div className="p-6">
            <ErrorBoundary>
              <Routes>
                <Route path="/scenarios" element={<ScenarioLibrary />} />
                <Route path="/launch" element={<LaunchPad />} />
                <Route path="/impact" element={<ImpactView />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="*" element={<Navigate to="/scenarios" replace />} />
              </Routes>
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
