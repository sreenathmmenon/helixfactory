import { useState } from "react";
import { GitCommitHorizontal, History } from "lucide-react";
import { StatusStates } from "../components/StatusStates";
import { api } from "../services/api";
import type { EvidencePackage, Repository } from "../services/types";

export function HistoryPage({ repository }: { repository?: Repository }) {
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
      setError(err instanceof Error ? err.message : "Architecture history failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="hf-page">
      <div className={`hf-page-grid ${pkg ? "" : "hf-page-grid-single"}`}>
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Architecture time machine</span>
          <h3>Reconstruct what changed, when, and why</h3>
          <button className="tool-button tool-button-primary" type="button" disabled={loading} onClick={load}>
            <History size={16} /> Load current timeline
          </button>
          {loading && <StatusStates status="loading" message="Loading audit-backed architecture timeline" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>
        {pkg && (
          <div className="hf-panel hf-result-panel">
            <div className="hf-panel-header">
              <GitCommitHorizontal size={18} />
              <h2 className="hf-panel-title">Known architecture states</h2>
              <span className="hf-panel-meta">{pkg.records.length} records</span>
            </div>
            <div className="hf-record-list">
              {pkg.records.slice(0, 6).map((record) => (
                <article className="hf-record" key={record.id}>
                  <div className="hf-record-head">
                    <span className="hf-pill">{record.actionType}</span>
                    <strong>{record.summary || record.subjectRef}</strong>
                    <time>{new Date(record.timestamp).toLocaleString()}</time>
                  </div>
                  <p>{record.gitCommit}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
