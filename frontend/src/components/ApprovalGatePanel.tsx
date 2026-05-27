import { CheckCircle2, CircleDashed, OctagonX } from "lucide-react";

export function ApprovalGatePanel({ state, reason }: { state: "blocked" | "pending" | "approved" | "rejected"; reason: string }) {
  const icon = state === "approved" ? <CheckCircle2 size={18} /> : state === "pending" ? <CircleDashed size={18} /> : <OctagonX size={18} />;
  return (
    <section className="hf-panel">
      <div className="hf-panel-header">
        {icon}
        <h2 className="hf-panel-title">Approval Gate</h2>
        <span className="hf-panel-meta">{state}</span>
      </div>
      <p className="hf-muted">{reason}</p>
    </section>
  );
}
