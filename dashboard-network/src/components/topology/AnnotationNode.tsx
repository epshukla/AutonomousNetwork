import { memo } from 'react';
import type { NodeProps } from 'reactflow';

export interface AnnotationNodeData {
  label: string;
  sublabel: string;
}

function AnnotationNode({ data }: NodeProps<AnnotationNodeData>) {
  return (
    <div className="text-right pr-4">
      <div className="text-xs font-bold text-noc-cyan/70 tracking-widest">
        {data.label}
      </div>
      <div className="text-[9px] text-noc-muted">{data.sublabel}</div>
    </div>
  );
}

export default memo(AnnotationNode);
