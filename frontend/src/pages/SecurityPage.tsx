import { useState } from "react";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { StatusStates } from "../components/StatusStates";
import { api } from "../services/api";
import type { PreMortemResult, Repository } from "../services/types";

export function SecurityPage({ repository }: { repository?: Repository }) {
  const [scope, setScope] = useState("Change authentication, token validation, or regulated data flow");
  const [result, setResult] = useState<PreMortemResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function run() {
    if (!repository) return;
    if (!scope.trim()) {
      setError("Describe the security-sensitive change before running the gate.");
      return;
    }
    setLoading(true);
    setError(undefined);
    setResult(undefined);
    try {
      setResult(await api.runPremortem(repository.id, scope.trim(), [scope.trim()], "interface"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Security gate failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="hf-page">
      <div className={`hf-page-grid ${result ? "" : "hf-page-grid-single"}`}>
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Security and compliance</span>
          <h3>Run risk gates before sensitive changes move forward</h3>
          <label className="hf-field">
            <span>Security-sensitive change</span>
            <textarea className="hf-input" aria-label="Security-sensitive change" value={scope} onChange={(event) => setScope(event.target.value)} />
          </label>
          <button className="tool-button tool-button-primary" type="button" disabled={!repository || loading || !scope.trim()} onClick={run}>
            <LockKeyhole size={16} /> Run security gate
          </button>
          {!repository && <StatusStates status="empty" message="Ingest a repository before security gates can resolve evidence." />}
          {loading && <StatusStates status="loading" message="Checking security-sensitive change paths and approval requirements" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>
        {result && (
          <div className="hf-panel hf-result-panel">
            <div className="hf-panel-header">
              <ShieldAlert size={18} />
              <h2 className="hf-panel-title">Gate outcome</h2>
              <span className="hf-panel-meta">{result.riskStatus}</span>
            </div>
            <div className="hf-evidence-list">
              <div className="hf-evidence-item"><span>Approval</span><strong>{result.requiresHumanApproval ? "Human approval required" : "Automation eligible"}</strong></div>
              <div className="hf-evidence-item"><span>Findings</span><strong>{result.findings.length} evidence-backed findings</strong></div>
              <div className="hf-evidence-item"><span>Audit</span><strong>{result.auditRecordId}</strong></div>
              {result.evidenceGaps.map((gap) => <StatusStates key={gap} status="partial" message={gap} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
