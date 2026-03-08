import { memo } from 'react';
import type { NodeProps } from 'reactflow';

export interface ZoneNodeData {
  label: string;
  width: number;
  height: number;
}

function ZoneNode({ data }: NodeProps<ZoneNodeData>) {
  return (
    <div
      style={{ width: data.width, height: data.height }}
      className="rounded-2xl border-2 border-dashed border-noc-cyan/20 bg-noc-cyan/[0.02]"
    >
      <div className="px-4 py-2 text-xs font-semibold text-noc-cyan/60 uppercase tracking-wider">
        {data.label}
      </div>
    </div>
  );
}

export default memo(ZoneNode);
