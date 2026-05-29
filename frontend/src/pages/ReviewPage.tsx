import { useState } from "react";
import { Bug, CheckCircle2, Gauge, ShieldCheck, Split, TestTube2 } from "lucide-react";
import { StatusStates } from "../components/StatusStates";
import { api } from "../services/api";
import type { AgentExecution, Repository } from "../services/types";

const LANES = [
  { key: "bugs",        icon: Bug,         label: "Bug detection",  desc: "Control-flow regressions, missing edge cases, and logic errors" },
  { key: "security",    icon: ShieldCheck, label: "Security",       desc: "Policy violations, secrets exposure, auth gaps, and regulated-data risks" },
  { key: "performance", icon: Gauge,       label: "Performance",    desc: "Hot paths, expensive fan-out, and latency-sensitive code changes" },
  { key: "tests",       icon: TestTube2,   label: "Test coverage",  desc: "Required test evidence and coverage thresholds before approval" },
];

export function ReviewPage({ repository }: { repository?: Repository }) {
  const [summary, setSummary] = useState("");
  const [execution, setExecution] = useState<AgentExecution>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function run() {
    if (!repository || !summary.trim()) return;
    setLoading(true); setError(undefined); setExecution(undefined);
    try {
      setExecution(await api.submitExecution(repository.id, summary.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review gate failed");
    } finally { setLoading(false); }
  }

  return (
    <section className="hf-page hf-ops-page">
      <div className="hf-page-full">
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Specialist review fleet</span>
          <h3>Run all review gates before PR approval</h3>
          <p className="hf-muted" style={{ fontSize: "0.84rem" }}>
            Four specialist reviewers run in parallel — bugs, security, performance, and tests. Each gate cites evidence from the code twin. Any gate failure blocks the merge.
          </p>
          <label className="hf-field">
            <span>Review target</span>
            <textarea
              className="hf-input"
              aria-label="Review target"
              value={summary}
              rows={3}
              onChange={e => setSummary(e.target.value)}
              placeholder="Describe the PR or change — e.g. Add rate limiting to the authentication endpoint"
            />
          </label>
          <button
            className="tool-button tool-button-primary"
            type="button"
            disabled={!repository || loading || !summary.trim()}
            onClick={() => void run()}
          >
            <Split size={16} /> Run specialist review gates
          </button>
          {!repository && <StatusStates status="empty" message="Ingest a repository before reviewer gates can collect context." />}
          {loading && <StatusStates status="loading" message="Running specialist review gates…" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>

        <div className="hf-result-fill">
          {!execution && !loading && !error && (
            <>
              <div className="hf-result-placeholder">
                <Split size={32} strokeWidth={1.2} />
                <strong>No review submitted yet</strong>
                <p>Describe your PR or change target to run all four specialist gates simultaneously. Results will include evidence citations from the twin.</p>
              </div>
              {/* Show lane previews */}
              <div className="hf-lane-cards">
                {LANES.map(lane => (
                  <div key={lane.key} className="hf-lane-card">
                    <div className="hf-lane-card-head">
                      <lane.icon size={15} style={{ color: "var(--hf-blue)" }} />
                      {lane.label}
                    </div>
                    <p>{lane.desc}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {execution && (
            <>
              <div className="hf-panel hf-gate-card" style={{
                borderLeftColor: execution.status === "completed" ? "#52c41a" : execution.status === "blocked" ? "#ff4d4f" : "var(--hf-blue)",
                borderLeftWidth: 3
              }}>
                <div className="hf-gate-card-header">
                  {execution.status === "completed"
                    ? <CheckCircle2 size={18} style={{ color: "#52c41a" }} />
                    : <Split size={18} style={{ color: "var(--hf-blue)" }} />
                  }
                  <span className="hf-gate-card-title">Review gate result</span>
                  <span className={`hf-exec-status ${execution.status}`}>{execution.status.replace(/_/g, " ")}</span>
                </div>
                <div className="hf-lane-cards" style={{ marginTop: "0.4rem" }}>
                  {LANES.map(lane => (
                    <div key={lane.key} className="hf-lane-card">
                      <div className="hf-lane-card-head">
                        <lane.icon size={14} style={{ color: execution.status === "completed" ? "#52c41a" : "var(--hf-blue)" }} />
                        {lane.label}
                        {execution.status === "completed" && <CheckCircle2 size={13} style={{ marginLeft: "auto", color: "#52c41a" }} />}
                      </div>
                    </div>
                  ))}
                </div>
                {execution.failureReason && (
                  <p style={{ margin: "0.5rem 0 0", color: "#ff4d4f", fontSize: "0.82rem" }}>
                    {execution.failureReason}
                  </p>
                )}
              </div>

              {execution.contextRefs.length > 0 && (
                <div className="hf-panel hf-gate-card">
                  <div className="hf-gate-card-header">
                    <span className="hf-gate-card-title">Evidence collected</span>
                  </div>
                  {execution.contextRefs.map(ref => (
                    <div className="hf-evidence-row" key={ref}>
                      <span>Context</span><strong>{ref}</strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
