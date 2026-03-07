import { motion } from 'framer-motion';
import { Brain, Wrench, Search, CheckCircle, XCircle, AlertTriangle, ChevronRight } from 'lucide-react';

interface ReasoningTraceProps {
  trace: string;
  compact?: boolean;
}

export default function ReasoningTrace({ trace, compact = false }: ReasoningTraceProps) {
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: JSX.Element[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Headers
      if (trimmed.startsWith('## ')) {
        elements.push(
          <motion.h3
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className="text-base font-bold text-noc-cyan mt-4 mb-2 flex items-center gap-2"
          >
            <Brain className="w-4 h-4" />
            {trimmed.slice(3)}
          </motion.h3>
        );
        return;
      }

      if (trimmed.startsWith('### ')) {
        elements.push(
          <motion.h4
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className="text-sm font-semibold text-noc-amber mt-3 mb-1.5 flex items-center gap-2"
          >
            <Wrench className="w-3.5 h-3.5" />
            {trimmed.slice(4)}
          </motion.h4>
        );
        return;
      }

      // Numbered list items (analysis steps)
      const numberedMatch = trimmed.match(/^(\d+)\.\s+\*\*(.+?)\*\*:?\s*(.*)/);
      if (numberedMatch) {
        const [, num, title, desc] = numberedMatch;
        elements.push(
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-3 py-1.5 pl-2"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-noc-cyan/15 border border-noc-cyan/30 flex items-center justify-center mt-0.5">
              <span className="text-xs font-bold text-noc-cyan">{num}</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-noc-text">{title}</span>
              {desc && <span className="text-sm text-noc-muted">: {desc}</span>}
            </div>
          </motion.div>
        );
        return;
      }

      // Tool calls (backtick code)
      const toolCallMatch = trimmed.match(/^-\s+`(.+?)`\s*-?\s*(.*)/);
      if (toolCallMatch) {
        const [, call, desc] = toolCallMatch;
        elements.push(
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-start gap-2 py-1 pl-4 ml-2 border-l-2 border-noc-purple/30"
          >
            <Search className="w-3.5 h-3.5 text-noc-purple mt-0.5 flex-shrink-0" />
            <div>
              <code className="text-xs font-mono text-noc-purple bg-noc-purple/10 px-1.5 py-0.5 rounded">
                {call}
              </code>
              {desc && <span className="text-xs text-noc-muted ml-2">{desc}</span>}
            </div>
          </motion.div>
        );
        return;
      }

      // Regular bullet points
      if (trimmed.startsWith('- ')) {
        const content = trimmed.slice(2);
        // Parse bold within bullet
        const parts = content.split(/\*\*(.+?)\*\*/g);
        elements.push(
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className="flex items-start gap-2 py-0.5 pl-4"
          >
            <ChevronRight className="w-3 h-3 text-noc-cyan mt-1 flex-shrink-0" />
            <span className="text-sm text-noc-muted">
              {parts.map((part, pi) =>
                pi % 2 === 1 ? (
                  <span key={pi} className="font-semibold text-noc-text">
                    {part}
                  </span>
                ) : (
                  <span key={pi}>{part}</span>
                )
              )}
            </span>
          </motion.div>
        );
        return;
      }

      // Regular text
      if (trimmed) {
        // Parse bold
        const parts = trimmed.split(/\*\*(.+?)\*\*/g);
        elements.push(
          <motion.p
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.02 }}
            className="text-sm text-noc-muted py-0.5"
          >
            {parts.map((part, pi) =>
              pi % 2 === 1 ? (
                <span key={pi} className="font-semibold text-noc-text">
                  {part}
                </span>
              ) : (
                <span key={pi}>{part}</span>
              )
            )}
          </motion.p>
        );
      }
    });

    return elements;
  };

  return (
    <div
      className={`bg-noc-bg/60 rounded-lg border border-noc-border/30 ${
        compact ? 'p-3 max-h-48 overflow-y-auto' : 'p-5 max-h-[500px] overflow-y-auto'
      }`}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-noc-border/30">
        <Brain className="w-4 h-4 text-noc-cyan" />
        <span className="text-xs font-bold uppercase tracking-widest text-noc-cyan">
          Claude's Reasoning Trace
        </span>
      </div>
      <div className="space-y-0.5">{renderMarkdown(trace)}</div>
    </div>
  );
}
