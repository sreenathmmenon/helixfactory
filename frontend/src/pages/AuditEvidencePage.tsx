import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileSearch,
  GitCommitHorizontal,
  PackageCheck,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { api } from "../services/api";
import type { AuditRecord, EvidencePackage, Repository } from "../services/types";
import { StatusStates } from "../components/StatusStates";

function humanize(value: string) {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, char => char.toUpperCase());
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Time not recorded";
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function statusClass(record: AuditRecord) {
  if (record.result === "success") {
    return "completed";
  }
  if (record.result === "failed" || record.result === "blocked") {
    return "failed";
  }
  return "queued";
}

function readableRef(ref: string) {
  const clean = ref.replace(/^urn:/, "").replace(/^repo:/, "");
  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f-]{13,}$/i.test(clean);
  if (looksLikeUuid) {
    return "Internal reference";
  }
  if (clean.length <= 44) {
    return clean;
  }
  return `${clean.slice(0, 24)}...${clean.slice(-12)}`;
}

function summarizeRefs(refs: string[]) {
  if (refs.length === 0) {
    return "Not recorded";
  }
  const visible = refs.slice(0, 3).map(readableRef).join(", ");
  const remainder = refs.length - 3;
  return remainder > 0 ? `${visible}, +${remainder} more` : visible;
}

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

  const isComplete = pkg?.completenessStatus === "complete";
  const hasMissingEvidence = Boolean(pkg && pkg.missingActions.length > 0);
  const chain = pkg?.chronologicalChain ?? [];

  return (
    <section className="hf-page hf-ops-page">
      <div className="hf-page-full">
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Audit evidence</span>
          <h3>Enterprise proof package</h3>
          <p className="hf-muted" style={{ fontSize: "0.84rem" }}>
            Load the chronological proof chain a manager, reviewer, or auditor can read: twin evidence,
            risk decision, blast radius, approval state, and git commit reference.
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
              <p>Load the package to verify each platform action in order, with missing evidence called out before review.</p>
            </div>
          )}

          {pkg && (
            <>
              <div className="hf-panel hf-audit-review-frame">
                <span className="hf-section-kicker">Evidence chain</span>
                <h3>From proposed change to governed decision</h3>
                <p>
                  This package should prove the full safety loop: twin context, pre-mortem findings,
                  blast radius, policy gate, human decision, and git-backed audit evidence.
                </p>
                <div className="hf-audit-review-steps" aria-label="Expected audit evidence chain">
                  {["Twin", "Risk", "Impact", "Gate", "Human", "Audit"].map((step) => (
                    <span key={step}>{step}</span>
                  ))}
                </div>
              </div>

              <div className="hf-audit-summary-strip">
                <div className={isComplete ? "is-complete" : "needs-attention"}>
                  <span>Package state</span>
                  <strong>{isComplete ? "Complete and reviewable" : "Requires evidence review"}</strong>
                </div>
                <div>
                  <span>Records</span>
                  <strong>{pkg.records.length}</strong>
                </div>
                <div>
                  <span>Warnings</span>
                  <strong>{pkg.missingActions.length}</strong>
                </div>
              </div>

              <div className={`hf-panel hf-audit-proof-card ${isComplete ? "complete" : "attention"}`}>
                <div className="hf-audit-proof-head">
                  {isComplete ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
                  <div>
                    <span>Evidence package status</span>
                    <strong>{humanize(pkg.completenessStatus)}</strong>
                  </div>
                  <span className={`hf-exec-status ${isComplete ? "completed" : "queued"}`}>
                    {isComplete ? "ready" : "review needed"}
                  </span>
                </div>

                {hasMissingEvidence && (
                  <div className="hf-audit-warning" role="status">
                    <AlertTriangle size={15} />
                    <div>
                      <strong>Missing evidence must be resolved before this package is audit-ready.</strong>
                      <span>{pkg.missingActions.map(humanize).join(", ")}</span>
                    </div>
                  </div>
                )}

                <div className="hf-evidence-row">
                  <span>Package</span>
                  <strong>{pkg.records.length} audit record{pkg.records.length !== 1 ? "s" : ""}</strong>
                </div>
                <div className="hf-evidence-row">
                  <span>Coverage</span>
                  <strong>{chain.length > 0 ? `${chain.length} chronological action${chain.length !== 1 ? "s" : ""}` : "No action chain recorded"}</strong>
                </div>
              </div>

              <div className="hf-panel hf-audit-chain-card">
                <div className="hf-audit-section-head">
                  <PackageCheck size={16} />
                  <div>
                    <span>Chronological chain</span>
                    <strong>{chain.length > 0 ? "Platform actions in proof order" : "No chain recorded"}</strong>
                  </div>
                </div>
                {chain.length > 0 ? (
                  <ol className="hf-audit-chain" aria-label="Chronological evidence chain">
                    {chain.map((item, index) => (
                      <li key={`${item}-${index}`}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <strong>{humanize(item)}</strong>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="hf-audit-empty-note">No platform actions were recorded in the evidence chain.</div>
                )}
              </div>

              {pkg.records.length > 0 ? (
                <div className="hf-audit-timeline" aria-label="Audit records">
                  {pkg.records.map((record, index) => {
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
                            <span className={`hf-exec-status ${statusClass(record)}`}>
                              {humanize(record.result)}
                            </span>
                            <strong>{index + 1}. {humanize(record.actionType)}</strong>
                            <time>{formatTimestamp(record.timestamp)}</time>
                          </div>
                          <p>{record.summary || "No human-readable summary was recorded for this action."}</p>
                          <div className="hf-audit-record-grid">
                            <div>
                              <span>Actor</span>
                              <strong>{record.actor || "System"}</strong>
                            </div>
                            <div>
                              <span>Subject</span>
                              <strong>{record.subjectRef ? readableRef(record.subjectRef) : "Not recorded"}</strong>
                            </div>
                            <div>
                              <span>Inputs</span>
                              <strong>{summarizeRefs(record.inputRefs)}</strong>
                            </div>
                            <div>
                              <span>Outputs</span>
                              <strong>{summarizeRefs(record.outputRefs)}</strong>
                            </div>
                          </div>
                          <div className="hf-audit-record-footer">
                            <span className="hf-timeline-commit">
                              <GitCommitHorizontal size={11} />
                              {record.gitCommit ? record.gitCommit.slice(0, 12) : "commit missing"}
                            </span>
                            {!record.gitCommit && <span className="hf-audit-missing-inline">Git evidence missing</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="hf-panel hf-audit-empty-note">No audit records were returned for this evidence package.</div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
