import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  AlertTriangle,
  ShieldCheck,
  Brain,
  ScrollText,
  Bot,
  ChevronLeft,
  ChevronRight,
  Radio,
  HardHat,
} from 'lucide-react';
import { useAgentEvents } from './hooks/useAgentEvents';
import ErrorBoundary from './components/ErrorBoundary';
import LiveTicker from './components/panels/LiveTicker';
import CommandCenter from './pages/CommandCenter';
import Incidents from './pages/Incidents';
import ApprovalPanel from './pages/ApprovalPanel';
import AgentIntelligence from './pages/AgentIntelligence';
import AuditLog from './pages/AuditLog';
import FieldTasks from './pages/FieldTasks';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Command Center' },
  { path: '/incidents', icon: AlertTriangle, label: 'Incidents' },
  { path: '/approvals', icon: ShieldCheck, label: 'Approval Panel' },
  { path: '/field-tasks', icon: HardHat, label: 'Field Tasks' },
  { path: '/intelligence', icon: Brain, label: 'Agent Intelligence' },
  { path: '/audit', icon: ScrollText, label: 'Audit Log' },
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

function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="text-xs text-noc-muted font-mono">
      IST{' '}
      {now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Kolkata',
      })}
    </span>
  );
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { connected } = useAgentEvents();

  return (
    <div className="flex min-h-screen bg-noc-bg grid-pattern">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed top-0 left-0 h-full z-50 bg-noc-surface/80 backdrop-blur-xl border-r border-noc-border/30 flex flex-col"
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-4 border-b border-noc-border/30">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-noc-cyan/20 to-noc-green/20 border border-noc-cyan/30 flex items-center justify-center">
            <Bot className="w-5 h-5 text-noc-cyan" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <div className="text-sm font-bold noc-gradient-text">AI NOC Engineer</div>
                <div className="text-[10px] text-noc-muted uppercase tracking-widest">
                  Autonomous Ops
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-noc-cyan/10 text-noc-cyan'
                    : 'text-noc-muted hover:text-noc-text hover:bg-noc-bg/50'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-noc-cyan rounded-r-full"
                    transition={{ duration: 0.3 }}
                  />
                )}
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-noc-cyan' : ''}`} />
                <AnimatePresence>
                  {!collapsed && (
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
              </NavLink>
            );
          })}
        </nav>

        {/* Connection Status & Collapse Toggle */}
        <div className="p-3 border-t border-noc-border/30 space-y-2">
          <div className="flex items-center gap-2 px-2">
            <span className="relative flex">
              <span
                className={`animate-ping absolute inline-flex h-2 w-2 rounded-full opacity-75 ${
                  connected ? 'bg-noc-green' : 'bg-noc-red'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  connected ? 'bg-noc-green' : 'bg-noc-red'
                }`}
              />
            </span>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`text-xs ${connected ? 'text-noc-green' : 'text-noc-red'}`}
                >
                  {connected ? 'Agent Connected' : 'Reconnecting...'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-noc-bg/50 text-noc-muted transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col transition-all duration-300"
        style={{ marginLeft: collapsed ? 72 : 260 }}
      >
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-noc-bg/80 backdrop-blur-xl border-b border-noc-border/20 px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-noc-text">
                {navItems.find((n) => n.path === location.pathname)?.label || 'Dashboard'}
              </h1>
              <p className="text-xs text-noc-muted mt-0.5">
                Autonomous Network Operations Center
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-noc-surface/50 border border-noc-border/20">
                <Radio className="w-3.5 h-3.5 text-noc-green animate-pulse" />
                <span className="text-xs text-noc-muted">Live</span>
              </div>
              <NtpBadge />
              <LiveClock />
            </div>
          </div>
        </header>

        {/* Live Event Ticker */}
        <ErrorBoundary resetKey={location.pathname}>
          <LiveTicker />
        </ErrorBoundary>

        {/* Page Content */}
        <div className="p-4 flex-1">
          <ErrorBoundary resetKey={location.pathname}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Routes>
                  <Route path="/" element={<CommandCenter />} />
                  <Route path="/incidents" element={<Incidents />} />
                  <Route path="/approvals" element={<ApprovalPanel />} />
                  <Route path="/field-tasks" element={<FieldTasks />} />
                  <Route path="/intelligence" element={<AgentIntelligence />} />
                  <Route path="/audit" element={<AuditLog />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
