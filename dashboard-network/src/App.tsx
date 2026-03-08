import React from 'react';
import { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Network,
  Server,
  Cable,
  GitBranch,
  BarChart3,
  Bell,
  Activity,
  Radio,
  Zap,
  Shield,
  Users,
  ScrollText,
} from 'lucide-react';

import ErrorBoundary from './components/ErrorBoundary';
import Overview from './pages/Overview';
import Topology from './pages/Topology';
import Devices from './pages/Devices';
import Interfaces from './pages/Interfaces';
import Routing from './pages/Routing';
import Traffic from './pages/Traffic';
import Alerts from './pages/Alerts';
import Metrics from './pages/Metrics';
import Compliance from './pages/Compliance';
import SubscriberLogs from './pages/SubscriberLogs';
import AuditTrail from './pages/AuditTrail';

const operationalNav = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/topology', label: 'Topology', icon: Network },
  { path: '/devices', label: 'Devices', icon: Server },
  { path: '/interfaces', label: 'Interfaces', icon: Cable },
  { path: '/routing', label: 'Routing', icon: GitBranch },
  { path: '/traffic', label: 'Traffic', icon: BarChart3 },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/metrics', label: 'Metrics', icon: Activity },
];

const complianceNav = [
  { path: '/compliance', label: 'Compliance', icon: Shield },
  { path: '/subscribers', label: 'Subscribers', icon: Users },
  { path: '/audit', label: 'Audit Trail', icon: ScrollText },
];

const navItems = [...operationalNav, ...complianceNav];

function NtpBadge() {
  const [synced, setSynced] = useState(true);

  useEffect(() => {
    const BASE_URL = import.meta.env.VITE_SIMULATOR_URL || 'http://localhost:8000';
    const poll = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/compliance/status`);
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
    <div className="flex items-center gap-1.5 mt-2">
      <span className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-noc-green' : 'bg-noc-red animate-pulse'}`} />
      <span className="text-[10px] text-noc-muted">{synced ? 'NTP Synced' : 'NTP Desync'}</span>
    </div>
  );
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

export default function App() {
  const location = useLocation();

  return (
    <div className="flex h-screen w-screen overflow-hidden noc-gradient-bg">
      {/* Sidebar */}
      <aside className="flex flex-col w-64 min-w-[256px] border-r border-noc-border/50 bg-noc-bg/80 backdrop-blur-xl z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-noc-border/50">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-noc-cyan to-blue-600 flex items-center justify-center">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-noc-green animate-pulse-glow" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">
              NOC
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-widest text-noc-muted">
              Network Ops Center
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {operationalNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                isActive ? 'sidebar-link-active' : 'sidebar-link'
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}

          <div className="my-2 border-t border-noc-border/30" />
          <div className="px-3 mb-1">
            <span className="text-[9px] font-bold text-noc-muted/60 uppercase tracking-widest">Regulatory</span>
          </div>

          {complianceNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                isActive ? 'sidebar-link-active' : 'sidebar-link'
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-noc-border/50">
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-noc-cyan" />
              <span className="text-xs font-semibold text-noc-text">System Status</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-noc-green animate-pulse-glow" />
              <span className="text-xs text-noc-muted">Simulator Connected</span>
            </div>
            <NtpBadge />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <ErrorBoundary>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="h-full"
            >
              <Routes location={location}>
                <Route path="/" element={<Overview />} />
                <Route path="/topology" element={<Topology />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/interfaces" element={<Interfaces />} />
                <Route path="/routing" element={<Routing />} />
                <Route path="/traffic" element={<Traffic />} />
                <Route path="/alerts" element={<Alerts />} />
                <Route path="/metrics" element={<Metrics />} />
                <Route path="/compliance" element={<Compliance />} />
                <Route path="/subscribers" element={<SubscriberLogs />} />
                <Route path="/audit" element={<AuditTrail />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>
      </main>
    </div>
  );
}
