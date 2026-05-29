import { useState } from "react";
import { Activity, CheckCircle2, FileText, GitCommitHorizontal, ShieldCheck, TestTube2 } from "lucide-react";
import { api } from "../services/api";
import type { AgentExecution, Repository } from "../services/types";
import { StatusStates } from "../components/StatusStates";

const STATUS_STEPS = [
  { key: "queued",             label: "Queued",              done: false },
  { key: "collecting_context", label: "Collecting context",  done: false },
  { key: "risk_checking",      label: "Risk check",          done: false },
  { key: "executing",          label: "Executing",           done: false },
  { key: "reviewing",          label: "Reviewing",           done: false },
  { key: "completed",          label: "Completed",           done: false },
];

function getStepIndex(status: string) {
  return STATUS_STEPS.findIndex(s => s.key === status);
}

export function ExecutionPage({ repository }: { repository?: Repository }) {
  const [summary, setSummary] = useState("");
  const [testEvidence, setTestEvidence] = useState("");
  const [execution, setExecution] = useState<AgentExecution>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function submit() {
    if (!repository || !summary.trim()) return;
    setLoading(true); setError(undefined); setExecution(undefined);
    try {
      setExecution(await api.submitExecution(repository.id, summary.trim(), testEvidence.trim() || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution submission failed");
    } finally { setLoading(false); }
  }

  const stepIndex = execution ? getStepIndex(execution.status) : -1;
  const isBlocked = execution?.status === "blocked" || execution?.status === "failed";
  const isComplete = execution?.status === "completed";

  return (
    <section className="hf-page hf-ops-page">
      <div className="hf-page-full">
        {/* Command panel */}
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Governed agent execution</span>
          <h3>Submit work through approval gates</h3>
          <p className="hf-muted" style={{ fontSize: "0.84rem" }}>
            Every execution is recorded with context refs, test evidence, and a git-native audit trail. HIGH and CRITICAL changes require human approval before proceeding.
          </p>
          <label className="hf-field">
            <span>Ticket summary</span>
            <textarea
              className="hf-input"
              aria-label="Ticket summary"
              value={summary}
              rows={3}
              onChange={e => setSummary(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && repository && !loading) void submit(); }}
              placeholder="Describe the change — e.g. Refactor auth middleware to use OAuth2 token validation"
            />
          </label>
          <label className="hf-field">
            <span>Test evidence <span style={{ color: "var(--hf-faint)", fontWeight: 400 }}>(optional)</span></span>
            <input
              className="hf-input"
              aria-label="Test evidence"
              value={testEvidence}
              onChange={e => setTestEvidence(e.target.value)}
              placeholder="pytest tests/auth/, CI run URL, or test plan reference"
            />
          </label>
          <button
            className="tool-button tool-button-primary"
            onClick={() => void submit()}
            disabled={!repository || loading || !summary.trim()}
            type="button"
          >
            <Activity size={16} /> Submit for governed execution
          </button>
          {!repository && <StatusStates status="empty" message="Ingest a repository before submitting governed execution." />}
          {loading && <StatusStates status="loading" message="Collecting context and evaluating approval gates…" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>

        {/* Result panel */}
        <div className="hf-result-fill">
          {!execution && !loading && !error && (
            <div className="hf-result-placeholder">
              <Activity size={32} strokeWidth={1.2} />
              <strong>No execution submitted yet</strong>
              <p>Submit a ticket summary to initiate a governed execution. The platform will collect twin context, run risk gates, and record the full audit trail.</p>
            </div>
          )}

          {execution && (
            <>
              {/* Gate status */}
              <div className="hf-panel hf-gate-card" style={{
                borderLeftColor: isBlocked ? "#ff4d4f" : isComplete ? "#52c41a" : "var(--hf-blue)",
                borderLeftWidth: 3
              }}>
                <div className="hf-gate-card-header">
                  {isBlocked
                    ? <ShieldCheck size={18} style={{ color: "#ff4d4f" }} />
                    : isComplete
                    ? <CheckCircle2 size={18} style={{ color: "#52c41a" }} />
                    : <Activity size={18} style={{ color: "var(--hf-blue)" }} />
                  }
                  <span className="hf-gate-card-title">
                    {isBlocked ? "Execution blocked — approval required" : isComplete ? "Execution complete" : "Execution in progress"}
                  </span>
                  <span className={`hf-exec-status ${execution.status}`}>{execution.status.replace(/_/g, " ")}</span>
                </div>

                {/* Progress steps */}
                <div className="hf-exec-steps">
                  {STATUS_STEPS.map((step, i) => (
                    <div key={step.key} className={`hf-exec-step ${i < stepIndex ? "done" : i === stepIndex ? "active" : "pending"} ${execution.status === "blocked" && i === stepIndex ? "blocked" : ""}`}>
                      <div className="hf-exec-step-dot" />
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>

                {execution.failureReason && (
                  <p style={{ margin: "0.4rem 0 0", color: "#ff4d4f", fontSize: "0.82rem" }}>
                    {execution.failureReason}
                  </p>
                )}
              </div>

              {/* Evidence */}
              <div className="hf-panel hf-gate-card">
                <div className="hf-gate-card-header">
                  <FileText size={16} style={{ color: "var(--hf-blue)" }} />
                  <span className="hf-gate-card-title">Execution evidence</span>
                </div>
                <div>
                  {execution.contextRefs.map(ref => (
                    <div className="hf-evidence-row" key={ref}>
                      <span>Context</span>
                      <strong>{ref}</strong>
                    </div>
                  ))}
                  {execution.testEvidence && (
                    <div className="hf-evidence-row">
                      <span><TestTube2 size={11} /> Tests</span>
                      <strong>{execution.testEvidence}</strong>
                    </div>
                  )}
                  {execution.pullRequestRef && (
                    <div className="hf-evidence-row">
                      <span>PR</span>
                      <strong>{execution.pullRequestRef}</strong>
                    </div>
                  )}
                  <div className="hf-evidence-row">
                    <span>Exec ID</span>
                    <span className="hf-timeline-commit">
                      <GitCommitHorizontal size={11} />
                      {execution.id.slice(0, 12)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
