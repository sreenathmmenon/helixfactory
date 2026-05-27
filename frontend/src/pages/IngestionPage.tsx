import { useState } from "react";
import { CheckCircle2, GitBranch, UploadCloud } from "lucide-react";
import { api } from "../services/api";
import type { Repository } from "../services/types";
import { StatusStates } from "../components/StatusStates";

export function IngestionPage({ onRepository }: { onRepository: (repository: Repository) => void }) {
  const [url, setUrl] = useState("https://github.com/tiangolo/fastapi");
  const [repository, setRepository] = useState<Repository>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  async function ingest() {
    const trimmedUrl = url.trim();
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(trimmedUrl)) {
      setError("Enter a valid GitHub repository URL, for example https://github.com/tiangolo/fastapi.");
      return;
    }
    setLoading(true);
    setError(undefined);
    setRepository(undefined);
    try {
      const result = await api.ingestRepository(trimmedUrl);
      setRepository(result);
      onRepository(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingestion failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="hf-page hf-ingest-page">
      <div className={`hf-ingest-grid ${repository ? "" : "hf-ingest-grid-single"}`}>
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Repository twin</span>
          <h3>Build the production code twin</h3>
          <p className="hf-muted">Create the evidence layer used by Twin, Q&A, pre-mortem, blast radius, audit, and governed execution.</p>
          <label className="hf-field">
            <span>Repository URL</span>
            <input className="hf-input" value={url} onChange={(event) => setUrl(event.target.value)} aria-label="Repository URL" />
          </label>
          <button className="tool-button tool-button-primary" onClick={ingest} disabled={loading || !url.trim()} type="button">
            <UploadCloud size={16} /> Ingest repository
          </button>
          {loading && <StatusStates status="loading" message="Ingestion running. The UI will show partial status if individual files fail." />}
          {error && <StatusStates status="failed" message={error} />}
          {!loading && !error && !repository && <StatusStates status="empty" message="No repository has been ingested in this browser session." />}
        </div>

        {repository && (
          <div className="hf-panel hf-result-panel hf-ingest-state">
            <div className="hf-panel-header">
              <CheckCircle2 size={18} />
              <h2 className="hf-panel-title">Twin build result</h2>
              <span className="hf-panel-meta">{repository.ingestionStatus}</span>
            </div>
              <div className="hf-kpi-grid">
                <div><GitBranch size={18} /><div><div className="hf-kpi-label">Repository</div><div className="hf-kpi-value hf-kpi-url">{repository.url}</div></div></div>
                <div><CheckCircle2 size={18} /><div><div className="hf-kpi-label">Status</div><div className="hf-kpi-value">{repository.ingestionStatus}</div></div></div>
                <div><div className="hf-kpi-label">Nodes</div><div className="hf-kpi-value">{repository.nodeCount ?? 0}</div></div>
                <div><div className="hf-kpi-label">Edges</div><div className="hf-kpi-value">{repository.edgeCount ?? 0}</div></div>
              </div>
              {repository.failureReason && <StatusStates status="partial" message={repository.failureReason} />}
          </div>
        )}
      </div>
    </section>
  );
}
