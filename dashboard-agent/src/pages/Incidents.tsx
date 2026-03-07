import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useIncidents } from '../hooks/useIncidents';
import IncidentList from '../components/incidents/IncidentList';
import IncidentDetail from '../components/incidents/IncidentDetail';
import { Incident } from '../api/agent';

export default function Incidents() {
  const { incidents, loading } = useIncidents();
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card p-4 animate-pulse">
            <div className="h-4 bg-noc-border/30 rounded w-1/3 mb-2" />
            <div className="h-3 bg-noc-border/30 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Incident List */}
      <div className={`transition-all duration-300 ${selectedIncident ? 'w-1/2' : 'w-full'}`}>
        <IncidentList
          incidents={incidents}
          onSelect={(inc) => setSelectedIncident(inc.id === selectedIncident?.id ? null : inc)}
          selectedId={selectedIncident?.id}
        />
      </div>

      {/* Incident Detail Panel */}
      <AnimatePresence>
        {selectedIncident && (
          <div className="w-1/2">
            <IncidentDetail
              incident={selectedIncident}
              onClose={() => setSelectedIncident(null)}
            />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
