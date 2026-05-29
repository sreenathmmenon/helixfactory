import { useState } from "react";
import { CheckCircle2, Clock, GitCommitHorizontal, History, XCircle } from "lucide-react";
import { StatusStates } from "../components/StatusStates";
import { api } from "../services/api";
import type { EvidencePackage, Repository } from "../services/types";

export function HistoryPage({ repository }: { repository?: Repository }) {
  const [pkg, setPackage] = useState<EvidencePackage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function load() {
    setLoading(true); setError(undefined); setPackage(undefined);
    try {
      setPackage(await api.evidencePackage(repository?.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Architecture history load failed");
    } finally { setLoading(false); }
  }

  return (
    <section className="hf-page hf-ops-page">
      <div className="hf-page-full">
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Architecture time machine</span>
          <h3>Reconstruct what changed, when, and why</h3>
          <p className="hf-muted" style={{ fontSize: "0.84rem" }}>
            Every platform action — ingestion, pre-mortem, blast radius, governed execution — is recorded as a structured git commit. Browse the chronological architecture history.
          </p>
          <button
            className="tool-button tool-button-primary"
            type="button"
            disabled={loading}
            onClick={void load}
          >
            <History size={16} /> Load architecture timeline
          </button>
          {loading && <StatusStates status="loading" message="Loading audit-backed architecture timeline…" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>

        <div className="hf-result-fill">
          {!pkg && !loading && !error && (
            <div className="hf-result-placeholder">
              <History size={32} strokeWidth={1.2} />
              <strong>No timeline loaded</strong>
              <p>Load the architecture timeline to see every platform action recorded as a structured, git-native audit entry with inputs, outputs, result, and commit reference.</p>
            </div>
          )}

          {pkg && (
            <>
              {/* Completeness header */}
              <div className="hf-panel hf-gate-card" style={{
                borderLeftColor: pkg.completenessStatus === "complete" ? "#52c41a" : "#fadb14",
                borderLeftWidth: 3
              }}>
                <div className="hf-gate-card-header">
                  <History size={16} style={{ color: "var(--hf-blue)" }} />
                  <span className="hf-gate-card-title">Evidence chain status</span>
                  <span className={`hf-exec-status ${pkg.completenessStatus === "complete" ? "completed" : "queued"}`}>
                    {pkg.completenessStatus.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="hf-evidence-row">
                  <span>Chain</span>
                  <strong style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }}>
                    {pkg.chronologicalChain.join(" → ") || "empty"}
                  </strong>
                </div>
                {pkg.missingActions.length > 0 && (
                  <div className="hf-evidence-row">
                    <span>Missing</span>
                    <strong style={{ color: "#fadb14" }}>{pkg.missingActions.join(", ")}</strong>
                  </div>
                )}
              </div>

              {/* Timeline */}
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
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                          <span className="hf-timeline-commit">
                            <GitCommitHorizontal size={11} />
                            {record.gitCommit.slice(0, 12)}
                          </span>
                          {record.subjectRef && (
                            <span style={{ color: "var(--hf-faint)", fontSize: "0.72rem" }}>
                              subject: {record.subjectRef.slice(0, 16)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
