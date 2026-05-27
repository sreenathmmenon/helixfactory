import { ShieldAlert } from "lucide-react";
import type { PreMortemResult } from "../services/types";
import { StatusStates } from "./StatusStates";

export function PreMortemPanel({ result }: { result?: PreMortemResult }) {
  if (!result) {
    return (
      <div className="hf-panel hf-result-panel">
        <div className="hf-panel-header">
          <ShieldAlert size={18} />
          <h2 className="hf-panel-title">Findings</h2>
          <span className="hf-panel-meta">waiting</span>
        </div>
        <StatusStates status="empty" message="Run a pre-mortem to see blocking findings, evidence chains, and preventive checks." />
      </div>
    );
  }
  return (
    <section className="hf-panel">
      <div className="hf-panel-header">
        <ShieldAlert size={18} />
        <h2 className="hf-panel-title">Pre-mortem</h2>
        <span className="hf-panel-meta">{result.riskStatus}</span>
      </div>
      <div className="hf-record-list">
        {result.findings.map((finding) => (
          <article key={finding.id} className="hf-record">
            <div className="hf-record-head">
              <span className="hf-pill">{finding.severity}</span>
              <strong>{finding.title}</strong>
            </div>
            <div className="hf-record-body">
              <div>
                <span>Consequence</span>
                <p>{finding.consequence}</p>
              </div>
              <div>
                <span>Location</span>
                <p>{finding.filePath}:{finding.line}</p>
              </div>
              <div>
                <span>Dependency chain</span>
                <p>{finding.dependencyChain.join(" -> ")}</p>
              </div>
              <div>
                <span>Preventive check</span>
                <p>{finding.preventiveCheck}</p>
              </div>
            </div>
          </article>
        ))}
        {result.evidenceGaps.map((gap) => (
          <div key={gap} className="hf-status hf-status-partial">{gap}</div>
        ))}
      </div>
    </section>
  );
}
