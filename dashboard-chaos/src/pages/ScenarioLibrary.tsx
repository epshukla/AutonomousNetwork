import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Library, Search, Filter, Flame } from 'lucide-react';
import { SCENARIOS, ScenarioMeta } from '../api/chaos';
import ScenarioCard from '../components/scenarios/ScenarioCard';

const categories = ['all', 'link', 'device', 'security', 'routing'];
const severities = ['all', 'medium', 'high', 'critical', 'emergency'];

const ScenarioLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const filteredScenarios = SCENARIOS.filter((s) => {
    const matchesSearch =
      searchQuery === '' ||
      s.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || s.category === categoryFilter;
    const matchesSeverity = severityFilter === 'all' || s.severity === severityFilter;
    return matchesSearch && matchesCategory && matchesSeverity;
  });

  const handleSelect = (scenario: ScenarioMeta) => {
    navigate(`/launch?scenario=${scenario.name}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20">
              <Library size={24} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-noc-text">Scenario Library</h1>
              <p className="text-sm text-noc-muted">
                {SCENARIOS.length} chaos scenarios available
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-noc-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scenarios..."
            className="pl-10 pr-4 py-2.5 bg-noc-bg border border-noc-border rounded-lg text-sm text-noc-text placeholder-noc-muted/50 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 w-full md:w-72 transition-all"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-noc-muted" />
          <span className="text-xs text-noc-muted uppercase tracking-wider font-semibold">Category:</span>
          <div className="flex gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  categoryFilter === cat
                    ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
                    : 'bg-noc-surface text-noc-muted border border-noc-border hover:border-noc-muted/30'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Flame size={14} className="text-noc-muted" />
          <span className="text-xs text-noc-muted uppercase tracking-wider font-semibold">Severity:</span>
          <div className="flex gap-1.5">
            {severities.map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  severityFilter === sev
                    ? 'bg-cyan-400/20 text-cyan-400 border border-cyan-400/30'
                    : 'bg-noc-surface text-noc-muted border border-noc-border hover:border-noc-muted/30'
                }`}
              >
                {sev.charAt(0).toUpperCase() + sev.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scenarios Grid */}
      <motion.div
        layout
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5"
      >
        {filteredScenarios.map((scenario, idx) => (
          <motion.div
            key={scenario.name}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <ScenarioCard scenario={scenario} onClick={() => handleSelect(scenario)} />
          </motion.div>
        ))}
      </motion.div>

      {filteredScenarios.length === 0 && (
        <div className="text-center py-16">
          <Search size={48} className="text-noc-muted/30 mx-auto mb-4" />
          <p className="text-noc-muted text-lg">No scenarios match your filters</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setCategoryFilter('all');
              setSeverityFilter('all');
            }}
            className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
};

export default ScenarioLibrary;
