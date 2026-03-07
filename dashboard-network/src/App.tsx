import React from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Network,
  Activity,
  Bell,
  Radio,
  Zap,
} from 'lucide-react';

import Overview from './pages/Overview';
import Topology from './pages/Topology';
import Telemetry from './pages/Telemetry';
import Events from './pages/Events';

const navItems = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/topology', label: 'Topology', icon: Network },
  { path: '/telemetry', label: 'Telemetry', icon: Activity },
  { path: '/events', label: 'Events', icon: Bell },
];

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
        <div className="flex items-center gap-3 px-6 py-6 border-b border-noc-border/50">
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
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
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
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-noc-border/50">
          <div className="glass-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-noc-cyan" />
              <span className="text-xs font-semibold text-noc-text">System Status</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-noc-green animate-pulse-glow" />
              <span className="text-xs text-noc-muted">Simulator Connected</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
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
              <Route path="/telemetry" element={<Telemetry />} />
              <Route path="/events" element={<Events />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
