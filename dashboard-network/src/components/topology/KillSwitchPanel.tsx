import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Skull, X, ChevronDown, ChevronRight, Power, RotateCcw,
  Router, Globe, Layers, Radio, Cable,
} from 'lucide-react';
import type {
  KillSwitchStatus,
  KillTarget,
  KillResponse,
  RestoreResponse,
  DeviceData,
  LinkData,
} from '../../api/simulator';

interface KillSwitchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  devices: DeviceData[];
  links: LinkData[];
  killStatus: KillSwitchStatus | null;
  onKill: (target: KillTarget) => Promise<KillResponse>;
  onRestore: (target: KillTarget) => Promise<RestoreResponse>;
}

const TIER_ORDER = ['peering_router', 'core_router', 'aggregation_router', 'edge_router', 'olt'];

const TIER_META: Record<string, { label: string; icon: React.ElementType }> = {
  peering_router:      { label: 'Peering Routers', icon: Globe },
  core_router:         { label: 'Core Routers', icon: Router },
  aggregation_router:  { label: 'Aggregation Routers', icon: Layers },
  edge_router:         { label: 'Edge Routers', icon: Router },
  olt:                 { label: 'OLT / Access', icon: Radio },
};

const LINK_TYPE_ORDER = ['fiber_backbone', 'fiber_intra', 'fiber_metro', 'peering', 'fiber_access'];

const LINK_TYPE_META: Record<string, string> = {
  fiber_backbone: 'Backbone',
  fiber_intra: 'Intra-city',
  fiber_metro: 'Metro',
  peering: 'Peering',
  fiber_access: 'Access',
};

function TierGroup({
  tier,
  items,
  killedSet,
  onKill,
  onRestore,
  targetType,
}: {
  tier: string;
  items: { id: string; label: string }[];
  killedSet: Set<string>;
  onKill: (id: string) => void;
  onRestore: (id: string) => void;
  targetType: 'device' | 'link';
}) {
  const [open, setOpen] = useState(true);
  const meta = targetType === 'device' ? TIER_META[tier] : null;
  const TierIcon = meta?.icon || Cable;
  const label = meta?.label || LINK_TYPE_META[tier] || tier;
  const killedCount = items.filter((i) => killedSet.has(i.id)).length;

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-noc-muted uppercase tracking-wider hover:bg-noc-surface/30 rounded transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <TierIcon className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">{label}</span>
        {killedCount > 0 && (
          <span className="bg-noc-red text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
            {killedCount}
          </span>
        )}
      </button>
      {open && (
        <div className="space-y-0.5 pl-2 pr-1">
          {items.map((item) => {
            const isKilled = killedSet.has(item.id);
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${
                  isKilled
                    ? 'bg-red-900/30 border border-red-500/40'
                    : 'hover:bg-noc-surface/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    isKilled ? 'bg-noc-red' : 'bg-noc-green'
                  }`}
                />
                <span className={`flex-1 font-mono text-[11px] truncate ${isKilled ? 'text-red-300' : 'text-noc-text'}`}>
                  {item.label}
                </span>
                {isKilled && (
                  <span className="text-[8px] font-bold text-red-400 uppercase tracking-wider">KILLED</span>
                )}
                <button
                  onClick={() => (isKilled ? onRestore(item.id) : onKill(item.id))}
                  className={`p-1 rounded transition-colors flex-shrink-0 ${
                    isKilled
                      ? 'hover:bg-green-900/50 text-noc-green'
                      : 'hover:bg-red-900/50 text-noc-red/60 hover:text-noc-red'
                  }`}
                  title={isKilled ? 'Restore' : 'Kill'}
                >
                  {isKilled ? <RotateCcw className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function KillSwitchPanel({
  onClose,
  devices,
  links,
  killStatus,
  onKill,
  onRestore,
}: KillSwitchPanelProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const killedDevices = new Set(killStatus?.killed_devices || []);
  const killedLinks = new Set(killStatus?.killed_links || []);
  const totalKilled = killedDevices.size + killedLinks.size;

  // Group devices by tier
  const devicesByTier: Record<string, { id: string; label: string }[]> = {};
  for (const tier of TIER_ORDER) {
    devicesByTier[tier] = [];
  }
  for (const d of devices) {
    const tier = d.type || 'olt';
    if (!devicesByTier[tier]) devicesByTier[tier] = [];
    devicesByTier[tier].push({ id: d.device_id, label: d.device_id });
  }

  // Group links by type
  const linksByType: Record<string, { id: string; label: string }[]> = {};
  for (const lt of LINK_TYPE_ORDER) {
    linksByType[lt] = [];
  }
  for (const l of links) {
    const lt = l.type || 'fiber_metro';
    if (!linksByType[lt]) linksByType[lt] = [];
    linksByType[lt].push({ id: l.link_id, label: l.link_id });
  }

  const handleKill = async (targetType: 'device' | 'link', targetId: string) => {
    setActionLoading(true);
    try {
      await onKill({ target_type: targetType, target_id: targetId });
    } catch {
      // Error handling via hook
    }
    setActionLoading(false);
  };

  const handleRestore = async (targetType: 'device' | 'link', targetId: string) => {
    setActionLoading(true);
    try {
      await onRestore({ target_type: targetType, target_id: targetId });
    } catch {
      // Error handling via hook
    }
    setActionLoading(false);
  };

  const handleRestoreAll = async () => {
    setActionLoading(true);
    try {
      for (const did of killedDevices) {
        await onRestore({ target_type: 'device', target_id: did });
      }
      for (const lid of killedLinks) {
        await onRestore({ target_type: 'link', target_id: lid });
      }
    } catch {
      // Error handling via hook
    }
    setActionLoading(false);
  };

  return (
    <motion.div
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="absolute top-0 left-0 bottom-0 w-80 z-20 glass-card rounded-none rounded-r-xl border-l-0 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-noc-border/20 flex items-center gap-3">
        <div className="p-1.5 rounded-lg bg-red-900/30 border border-red-500/30">
          <Skull className="w-4 h-4 text-noc-red" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white">Kill Switch</h3>
          <p className="text-[10px] text-noc-muted">Manual device/link control</p>
        </div>
        {totalKilled > 0 && (
          <span className="bg-noc-red text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
            {totalKilled} killed
          </span>
        )}
        <button onClick={onClose} className="p-1 hover:bg-noc-surface/50 rounded transition-colors">
          <X className="w-4 h-4 text-noc-muted" />
        </button>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto py-2 ${actionLoading ? 'opacity-60 pointer-events-none' : ''}`}>
        {/* Devices */}
        <div className="px-3 py-1.5">
          <span className="text-[10px] font-bold text-noc-cyan uppercase tracking-widest">Devices</span>
        </div>
        {TIER_ORDER.map((tier) => {
          const items = devicesByTier[tier] || [];
          if (items.length === 0) return null;
          return (
            <TierGroup
              key={tier}
              tier={tier}
              items={items}
              killedSet={killedDevices}
              onKill={(id) => handleKill('device', id)}
              onRestore={(id) => handleRestore('device', id)}
              targetType="device"
            />
          );
        })}

        {/* Divider */}
        <div className="mx-3 my-2 border-t border-noc-border/20" />

        {/* Links */}
        <div className="px-3 py-1.5">
          <span className="text-[10px] font-bold text-noc-cyan uppercase tracking-widest">Links</span>
        </div>
        {LINK_TYPE_ORDER.map((lt) => {
          const items = linksByType[lt] || [];
          if (items.length === 0) return null;
          return (
            <TierGroup
              key={lt}
              tier={lt}
              items={items}
              killedSet={killedLinks}
              onKill={(id) => handleKill('link', id)}
              onRestore={(id) => handleRestore('link', id)}
              targetType="link"
            />
          );
        })}
      </div>

      {/* Footer */}
      {totalKilled > 0 && (
        <div className="px-4 py-3 border-t border-noc-border/20">
          <button
            onClick={handleRestoreAll}
            disabled={actionLoading}
            className="w-full py-2 rounded-lg bg-noc-green/10 border border-noc-green/30 text-noc-green text-xs font-bold uppercase tracking-wider hover:bg-noc-green/20 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore All ({totalKilled})
          </button>
        </div>
      )}
    </motion.div>
  );
}
