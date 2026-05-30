import { useState } from "react";
import { CheckCircle2, Clock, FileSearch, GitCommitHorizontal, XCircle } from "lucide-react";
import { api } from "../services/api";
import type { EvidencePackage, Repository } from "../services/types";
import { StatusStates } from "../components/StatusStates";

export function AuditEvidencePage({ repository }: { repository?: Repository }) {
  const [pkg, setPackage] = useState<EvidencePackage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function load() {
    setLoading(true); setError(undefined); setPackage(undefined);
    try {
      setPackage(await api.evidencePackage(repository?.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evidence package failed");
    } finally { setLoading(false); }
  }

  return (
    <section className="hf-page hf-ops-page">
      <div className="hf-page-full">
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Audit evidence</span>
          <h3>Can we prove what happened?</h3>
          <p className="hf-muted" style={{ fontSize: "0.84rem" }}>
            Load the proof chain that a manager, reviewer, or auditor can read: twin evidence, risk decision,
            blast radius, approval status, and git commit reference.
          </p>
          <button
            className="tool-button tool-button-primary"
            onClick={() => void load()}
            disabled={loading}
            type="button"
          >
            <FileSearch size={16} /> Load evidence package
          </button>
          {loading && <StatusStates status="loading" message="Loading chronological audit evidence…" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>

        <div className="hf-result-fill">
          {!pkg && !loading && !error && (
            <div className="hf-result-placeholder">
              <FileSearch size={32} strokeWidth={1.2} />
              <strong>No evidence package loaded</strong>
              <p>Load the evidence package to see the full chronological proof chain — every platform action with its git commit, inputs, and outputs.</p>
            </div>
          )}

          {pkg && (
            <>
              <div className="hf-audit-summary-strip">
                <div>
                  <span>Audit decision</span>
                  <strong>{pkg.completenessStatus === "complete" ? "Evidence chain complete" : "Evidence chain incomplete"}</strong>
                </div>
                <div>
                  <span>Records</span>
                  <strong>{pkg.records.length}</strong>
                </div>
                <div>
                  <span>Missing actions</span>
                  <strong>{pkg.missingActions.length}</strong>
                </div>
              </div>

              {/* Completeness status */}
              <div className="hf-panel hf-gate-card" style={{
                borderLeftColor: pkg.completenessStatus === "complete" ? "#52c41a" : "#fadb14",
                borderLeftWidth: 3
              }}>
                <div className="hf-gate-card-header">
                  <FileSearch size={16} style={{ color: "var(--hf-blue)" }} />
                  <span className="hf-gate-card-title">Evidence package status</span>
                  <span className={`hf-exec-status ${pkg.completenessStatus === "complete" ? "completed" : "queued"}`}>
                    {pkg.completenessStatus.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="hf-audit-chain" aria-label="Evidence chain">
                  {(pkg.chronologicalChain.length > 0 ? pkg.chronologicalChain : ["No actions recorded"]).map((item, index) => (
                    <span key={`${item}-${index}`}>{item.replace(/_/g, " ")}</span>
                  ))}
                </div>
                {pkg.missingActions.length > 0 && (
                  <div className="hf-evidence-row">
                    <span>Missing</span>
                    <strong style={{ color: "#fadb14" }}>{pkg.missingActions.join(", ")}</strong>
                  </div>
                )}
                <div className="hf-evidence-row">
                  <span>Records</span>
                  <strong>{pkg.records.length} audit record{pkg.records.length !== 1 ? "s" : ""}</strong>
                </div>
              </div>

              {/* Timeline */}
              {pkg.records.length > 0 && (
                <div style={{ paddingLeft: "0.25rem" }}>
                  {pkg.records.map(record => {
                    const isSuccess = record.result === "success";
                    const isFailed = record.result === "failed" || record.result === "blocked";
                    return (
                      <div key={record.id} className="hf-timeline-item">
                        <div className={`hf-timeline-dot ${record.result}`}>
                          {isSuccess
                            ? <CheckCircle2 size={10} style={{ color: "#52c41a" }} />
                            : isFailed
                            ? <XCircle size={10} style={{ color: "#ff4d4f" }} />
                            : <Clock size={10} style={{ color: "#fadb14" }} />
                          }
                        </div>
                        <div className="hf-timeline-card">
                          <div className="hf-timeline-card-head">
                            <span className={`hf-exec-status ${isSuccess ? "completed" : isFailed ? "failed" : "queued"}`}>
                              {record.result}
                            </span>
                            <strong>{record.actionType.replace(/_/g, " ")}</strong>
                            <time>{new Date(record.timestamp).toLocaleString()}</time>
                          </div>
                          {record.summary && <p>{record.summary}</p>}
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
                            <span className="hf-timeline-commit">
                              <GitCommitHorizontal size={11} />
                              {record.gitCommit.slice(0, 12)}
                            </span>
                            {record.subjectRef && (
                              <span style={{ color: "var(--hf-faint)", fontSize: "0.72rem" }}>
                                {record.subjectRef.slice(0, 20)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
