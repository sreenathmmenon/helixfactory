import { useState } from "react";
import { AlertTriangle, LockKeyhole, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { StatusStates } from "../components/StatusStates";
import { api } from "../services/api";
import type { PreMortemResult, Repository } from "../services/types";

const SECURITY_EXAMPLES = [
  "auth middleware",
  "token validation",
  "session management",
  "regulated data flow"
];

export function SecurityPage({ repository }: { repository?: Repository }) {
  const [scope, setScope] = useState("");
  const [result, setResult] = useState<PreMortemResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function run() {
    if (!repository || !scope.trim()) return;
    setLoading(true); setError(undefined); setResult(undefined);
    try {
      setResult(await api.runPremortem(repository.id, scope.trim(), [scope.trim()], "interface"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Security gate failed");
    } finally { setLoading(false); }
  }

  const isHigh = result && (result.riskStatus === "high" || result.riskStatus === "critical");

  return (
    <section className="hf-page hf-ops-page">
      <div className="hf-page-full">
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Security &amp; compliance gate</span>
          <h3>Run risk gates before sensitive changes move forward</h3>
          <p className="hf-muted" style={{ fontSize: "0.84rem" }}>
            Evaluates security-sensitive changes against the code twin. Every finding cites a real file, line, and dependency chain — not heuristics.
          </p>
          <label className="hf-field">
            <span>Security-sensitive change</span>
            <textarea
              className="hf-input"
              aria-label="Security-sensitive change"
              value={scope}
              rows={3}
              onChange={e => setScope(e.target.value)}
              placeholder="Describe the security-sensitive change or area of concern"
            />
          </label>
          <div className="hf-ingest-examples">
            <span>Examples:</span>
            {SECURITY_EXAMPLES.map(ex => (
              <button key={ex} type="button" className="hf-ingest-example-btn" onClick={() => setScope(ex)}>{ex}</button>
            ))}
          </div>
          <button
            className="tool-button tool-button-primary"
            type="button"
            disabled={!repository || loading || !scope.trim()}
            onClick={() => void run()}
          >
            <LockKeyhole size={16} /> Run security gate
          </button>
          {!repository && <StatusStates status="empty" message="Ingest a repository before running security gates." />}
          {loading && <StatusStates status="loading" message="Scanning security-sensitive change paths…" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>

        <div className="hf-result-fill">
          {!result && !loading && !error && (
            <div className="hf-result-placeholder">
              <LockKeyhole size={32} strokeWidth={1.2} />
              <strong>No security gate run yet</strong>
              <p>Describe the security-sensitive change to run evidence-backed risk analysis. Results include findings with file citations, dependency chains, and preventive checks.</p>
            </div>
          )}

          {result && (
            <>
              {/* Gate outcome */}
              <div className="hf-panel hf-gate-card" style={{
                borderLeftColor: isHigh ? "#ff4d4f" : "#52c41a",
                borderLeftWidth: 3
              }}>
                <div className="hf-gate-card-header">
                  {isHigh
                    ? <ShieldX size={18} style={{ color: "#ff4d4f" }} />
                    : <ShieldCheck size={18} style={{ color: "#52c41a" }} />
                  }
                  <span className="hf-gate-card-title">
                    {isHigh ? "Gate failed — human approval required" : "Gate passed — standard review applies"}
                  </span>
                  <span className={`hf-exec-status ${isHigh ? "blocked" : "completed"}`}>
                    {result.riskStatus.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <div className="hf-evidence-row">
                    <span>Findings</span>
                    <strong style={{ color: result.findings.length > 0 ? "#fa8c16" : "#52c41a" }}>
                      {result.findings.length} evidence-backed finding{result.findings.length !== 1 ? "s" : ""}
                    </strong>
                  </div>
                  <div className="hf-evidence-row">
                    <span>Approval</span>
                    <strong style={{ color: result.requiresHumanApproval ? "#ff4d4f" : "#52c41a" }}>
                      {result.requiresHumanApproval ? "Human approval required" : "Automation eligible"}
                    </strong>
                  </div>
                  <div className="hf-evidence-row">
                    <span>Audit ID</span>
                    <span className="hf-timeline-commit">{result.auditRecordId.slice(0, 12)}</span>
                  </div>
                </div>
              </div>

              {/* Findings */}
              {result.findings.map(f => (
                <div key={f.id} className="hf-panel hf-gate-card" style={{ borderLeftColor: "#ff4d4f", borderLeftWidth: 3 }}>
                  <div className="hf-gate-card-header">
                    <ShieldAlert size={16} style={{ color: "#ff4d4f" }} />
                    <span className="hf-gate-card-title">{f.title}</span>
                    <span className="hf-exec-status blocked">{f.severity}</span>
                  </div>
                  <div>
                    <div className="hf-evidence-row"><span>Consequence</span><strong>{f.consequence}</strong></div>
                    <div className="hf-evidence-row">
                      <span>Location</span>
                      <strong style={{ fontFamily: "ui-monospace, monospace", color: "var(--hf-teal)" }}>
                        {f.filePath}{f.line ? `:${f.line}` : ""}
                      </strong>
                    </div>
                    <div className="hf-evidence-row">
                      <span>Preventive check</span>
                      <strong>{f.preventiveCheck}</strong>
                    </div>
                  </div>
                </div>
              ))}

              {/* Evidence gaps */}
              {result.evidenceGaps.length > 0 && (
                <div className="hf-panel hf-gate-card" style={{ borderLeftColor: "#fadb14", borderLeftWidth: 3 }}>
                  <div className="hf-gate-card-header">
                    <AlertTriangle size={16} style={{ color: "#fadb14" }} />
                    <span className="hf-gate-card-title">Evidence gaps — expand twin coverage</span>
                  </div>
                  {result.evidenceGaps.map((gap, i) => (
                    <div className="hf-evidence-row" key={i}>
                      <span>Gap</span><strong>{gap}</strong>
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
