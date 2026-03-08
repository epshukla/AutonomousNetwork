import { Brain } from 'lucide-react';

interface ReasoningTraceProps {
  trace: string;
  compact?: boolean;
  title?: string;
}

/** Render inline formatting: **bold** and `code` */
function renderInline(text: string): (JSX.Element | string)[] {
  // Split on **bold** and `code` patterns
  const tokens: (JSX.Element | string)[] = [];
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let last = 0;
  let match;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) tokens.push(text.slice(last, match.index));
    if (match[2]) {
      // bold
      tokens.push(<strong key={i++} className="font-semibold text-noc-text">{match[2]}</strong>);
    } else if (match[3]) {
      // inline code
      tokens.push(
        <code key={i++} className="text-xs font-mono text-noc-cyan bg-noc-cyan/10 px-1 py-0.5 rounded">
          {match[3]}
        </code>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push(text.slice(last));
  return tokens;
}

export default function ReasoningTrace({ trace, compact = false, title }: ReasoningTraceProps) {
  const renderMarkdown = (text: string) => {
    // Extract fenced code blocks first
    const segments: { type: 'text' | 'code'; content: string; lang?: string }[] = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex)
        segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
      segments.push({ type: 'code', content: match[2], lang: match[1] || 'text' });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length)
      segments.push({ type: 'text', content: text.slice(lastIndex) });

    const elements: JSX.Element[] = [];
    let key = 0;

    for (const segment of segments) {
      if (segment.type === 'code') {
        elements.push(
          <div key={key++} className="my-3">
            <div className="px-3 py-1.5 bg-noc-surface/80 border border-noc-border/30 border-b-0 rounded-t-lg">
              <span className="text-[10px] font-mono font-bold text-noc-muted uppercase">{segment.lang}</span>
            </div>
            <pre className="p-4 bg-noc-bg/80 border border-noc-border/30 rounded-b-lg text-xs text-noc-text font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {segment.content.trim()}
            </pre>
          </div>
        );
        continue;
      }

      const lines = segment.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // ## Header
        if (trimmed.startsWith('## ')) {
          elements.push(
            <h3 key={key++} className="text-[15px] font-bold text-noc-text mt-5 mb-2 pb-1 border-b border-noc-border/20">
              {trimmed.slice(3)}
            </h3>
          );
          continue;
        }

        // ### Sub-header
        if (trimmed.startsWith('### ')) {
          elements.push(
            <h4 key={key++} className="text-sm font-bold text-noc-text mt-4 mb-1.5">
              {trimmed.slice(4)}
            </h4>
          );
          continue;
        }

        // Numbered list: "1. **Title**: description"
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          elements.push(
            <div key={key++} className="flex items-start gap-2 py-0.5 pl-2">
              <span className="text-sm font-mono text-noc-muted flex-shrink-0 w-5 text-right">{numMatch[1]}.</span>
              <span className="text-sm text-noc-muted leading-relaxed">{renderInline(numMatch[2])}</span>
            </div>
          );
          continue;
        }

        // Bullet with indent: "  - sub item"
        if (trimmed.startsWith('- ')) {
          const depth = line.search(/\S/) >= 4 ? 'pl-8' : 'pl-4';
          elements.push(
            <div key={key++} className={`flex items-start gap-2 py-0.5 ${depth}`}>
              <span className="text-noc-muted mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-noc-muted/50" />
              <span className="text-sm text-noc-muted leading-relaxed">{renderInline(trimmed.slice(2))}</span>
            </div>
          );
          continue;
        }

        // Regular paragraph
        elements.push(
          <p key={key++} className="text-sm text-noc-muted leading-relaxed py-0.5">
            {renderInline(trimmed)}
          </p>
        );
      }
    }

    return elements;
  };

  return (
    <div
      className={`bg-noc-bg/60 rounded-lg border border-noc-border/30 ${
        compact ? 'p-3 max-h-48 overflow-y-auto' : 'p-5 overflow-y-auto'
      }`}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-noc-border/30">
        <Brain className="w-4 h-4 text-noc-cyan" />
        <span className="text-xs font-bold uppercase tracking-widest text-noc-cyan">
          {title || "AI Diagnosis"}
        </span>
      </div>
      <div>{renderMarkdown(trace)}</div>
    </div>
  );
}
