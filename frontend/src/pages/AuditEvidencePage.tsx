import { useState } from "react";
import { Clock3, FileSearch } from "lucide-react";
import { api } from "../services/api";
import type { EvidencePackage, Repository } from "../services/types";
import { StatusStates } from "../components/StatusStates";

export function AuditEvidencePage({ repository }: { repository?: Repository }) {
  const [pkg, setPackage] = useState<EvidencePackage>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  async function load() {
    setLoading(true);
    setError(undefined);
    setPackage(undefined);
    try {
      setPackage(await api.evidencePackage(repository?.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evidence package failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="hf-page">
      <div className="hf-panel hf-toolbar-panel">
        <div>
          <span className="hf-section-kicker">Audit evidence</span>
          <h3>Chronological proof chain</h3>
          <p className="hf-muted">Every platform action is shown as a readable record with inputs, outputs, result, and git commit reference.</p>
        </div>
        <button className="tool-button tool-button-primary" onClick={load} disabled={loading} type="button"><FileSearch size={16} /> Load evidence</button>
      </div>
      {loading && <StatusStates status="loading" message="Loading chronological audit evidence" />}
      {error && <StatusStates status="failed" message={error} />}
      {!pkg && !loading && !error && <StatusStates status="empty" message="No evidence package loaded yet." />}
      {pkg?.records.length === 0 && <StatusStates status="empty" message="No audit records match the selected filters." />}
      {pkg && (
        <div className="hf-panel hf-result-panel hf-audit-summary">
          <div className="hf-panel-header">
            <FileSearch size={18} />
            <h2 className="hf-panel-title">Evidence package status</h2>
            <span className="hf-panel-meta">{pkg.completenessStatus.replace("_", " ")}</span>
          </div>
          <div className="hf-evidence-grid">
            <div><span>Chain</span><strong>{pkg.chronologicalChain.join(" -> ") || "none"}</strong></div>
            <div><span>Missing</span><strong>{pkg.missingActions.join(", ") || "none"}</strong></div>
          </div>
        </div>
      )}
      {(pkg?.records.length ?? 0) > 0 && (
        <div className="hf-record-list hf-timeline">
          {(pkg?.records ?? []).map((record) => (
            <article className="hf-record" key={record.id}>
              <div className="hf-record-head">
                <Clock3 size={16} />
                <strong>{record.actionType.replace("_", " ")}</strong>
                <span className="hf-pill">{record.result}</span>
                <time>{new Date(record.timestamp).toLocaleString()}</time>
              </div>
              <p>{record.summary || `Action for ${record.subjectRef}`}</p>
              <div className="hf-evidence-grid">
                <div><span>Subject</span><strong>{record.subjectRef}</strong></div>
                <div><span>Commit</span><strong>{record.gitCommit}</strong></div>
                <div><span>Inputs</span><strong>{record.inputRefs?.join(", ") || "none"}</strong></div>
                <div><span>Outputs</span><strong>{record.outputRefs?.join(", ") || "none"}</strong></div>
              </div>
              {record.result !== "success" && <StatusStates status={record.result === "blocked" ? "blocked" : "partial"} message={String(record.details?.reason ?? "Action completed with non-success status")} />}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
