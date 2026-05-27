import { useState } from "react";
import { Activity, GitPullRequestArrow, ShieldCheck } from "lucide-react";
import { api } from "../services/api";
import type { AgentExecution, Repository } from "../services/types";
import { ApprovalGatePanel } from "../components/ApprovalGatePanel";
import { StatusStates } from "../components/StatusStates";

export function ExecutionPage({ repository }: { repository?: Repository }) {
  const [summary, setSummary] = useState("Low-risk documentation update");
  const [execution, setExecution] = useState<AgentExecution>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  async function submit() {
    if (!repository) return;
    if (!summary.trim()) {
      setError("Describe the work before submitting governed execution.");
      return;
    }
    setLoading(true);
    setError(undefined);
    setExecution(undefined);
    try {
      setExecution(await api.submitExecution(repository.id, summary.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setLoading(false);
    }
  }
  const state = execution?.status === "blocked" ? "blocked" : execution?.status === "completed" ? "approved" : "pending";
  return (
    <section className="hf-page">
      <div className={`hf-page-grid ${execution ? "" : "hf-page-grid-single"}`}>
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Governed execution</span>
          <h3>Submit work only after context and gates are recorded</h3>
          <label className="hf-field">
            <span>Ticket summary</span>
            <textarea className="hf-input" aria-label="Ticket summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>
          <button className="tool-button tool-button-primary" onClick={submit} disabled={!repository || loading || !summary.trim()} type="button"><Activity size={16} /> Submit execution</button>
          {!repository && <StatusStates status="empty" message="Ingest a repository before submitting governed execution." />}
          {loading && <StatusStates status="loading" message="Collecting context and evaluating gates" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>
        {execution && (
          <div className="hf-result-stack">
              <ApprovalGatePanel state={state} reason={execution.failureReason ?? "Review and test evidence recorded"} />
              <section className="hf-panel">
                <div className="hf-panel-header">
                  <ShieldCheck size={18} />
                  <h2 className="hf-panel-title">Execution evidence</h2>
                  <span className="hf-panel-meta">{execution.status}</span>
                </div>
                <div className="hf-evidence-list">
                  {execution.contextRefs.map((ref) => <div className="hf-evidence-item" key={ref}><span>Context</span><strong>{ref}</strong></div>)}
                  {execution.testEvidence && <div className="hf-evidence-item"><span>Tests</span><strong>{execution.testEvidence}</strong></div>}
                  {execution.pullRequestRef && <div className="hf-evidence-item"><GitPullRequestArrow size={14} /><strong>{execution.pullRequestRef}</strong></div>}
                </div>
              </section>
          </div>
        )}
      </div>
    </section>
  );
}
