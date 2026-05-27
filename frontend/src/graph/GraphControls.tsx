import { RotateCcw, Search } from "lucide-react";

export function GraphControls({
  query,
  depth,
  onQuery,
  onDepth,
  onReset
}: {
  query: string;
  depth: number;
  onQuery: (query: string) => void;
  onDepth: (depth: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="hf-form-row hf-panel">
      <Search size={18} aria-hidden="true" />
      <input className="hf-input min-w-56" aria-label="Graph center query" value={query} onChange={(event) => onQuery(event.target.value)} />
      <label className="flex items-center gap-2 text-sm hf-muted">
        Depth
        <input className="w-28" aria-label="Depth" type="range" min={1} max={4} value={depth} onChange={(event) => onDepth(Number(event.target.value))} />
        <span className="w-4">{depth}</span>
      </label>
      <button className="tool-button" type="button" onClick={onReset} aria-label="Reset graph">
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
