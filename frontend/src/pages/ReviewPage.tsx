import { useState } from "react";
import { Bug, Gauge, ShieldCheck, Split, TestTube2 } from "lucide-react";
import { StatusStates } from "../components/StatusStates";
import { api } from "../services/api";
import type { AgentExecution, Repository } from "../services/types";

const lanes = [
  ["Bugs", <Bug size={16} />, "Control-flow regressions and missing edge cases"],
  ["Security", <ShieldCheck size={16} />, "Policy, secrets, auth, and regulated-data risks"],
  ["Performance", <Gauge size={16} />, "Hot paths, expensive fan-out, and latency-sensitive flows"],
  ["Tests", <TestTube2 size={16} />, "Required test evidence before approval"],
];

export function ReviewPage({ repository }: { repository?: Repository }) {
  const [summary, setSummary] = useState("Review a low-risk change before PR approval");
  const [execution, setExecution] = useState<AgentExecution>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function run() {
    if (!repository) return;
    if (!summary.trim()) {
      setError("Describe the review target before running specialist gates.");
      return;
    }
    setLoading(true);
    setError(undefined);
    setExecution(undefined);
    try {
      setExecution(await api.submitExecution(repository.id, summary.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review gate failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="hf-page">
      <div className={`hf-page-grid ${execution ? "" : "hf-page-grid-single"}`}>
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Reviewer fleet</span>
          <h3>Run specialist review lanes before approval</h3>
          <label className="hf-field">
            <span>Review target</span>
            <textarea className="hf-input" aria-label="Review target" value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>
          <button className="tool-button tool-button-primary" type="button" disabled={!repository || loading || !summary.trim()} onClick={run}>
            <Split size={16} /> Run review gates
          </button>
          {!repository && <StatusStates status="empty" message="Ingest a repository before reviewer gates can collect context." />}
          {loading && <StatusStates status="loading" message="Collecting twin context and reviewer evidence" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>
        {execution && (
          <div className="hf-panel hf-result-panel">
            <div className="hf-panel-header">
              <Split size={18} />
              <h2 className="hf-panel-title">Specialist lanes</h2>
              <span className="hf-panel-meta">{execution.status}</span>
            </div>
            <div className="hf-lane-strip">
              {lanes.map(([name, icon]) => <span key={String(name)}>{icon}{name}</span>)}
            </div>
            <div className="hf-evidence-list">
              {execution.contextRefs.map((ref) => <div className="hf-evidence-item" key={ref}><span>Context</span><strong>{ref}</strong></div>)}
              <div className="hf-evidence-item"><span>Result</span><strong>{execution.failureReason ?? execution.testEvidence ?? "Review evidence recorded"}</strong></div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
