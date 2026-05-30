import { useState } from "react";
import { ArrowRight, CheckCircle2, Code2, GitBranch, GitFork, Layers, Network, UploadCloud } from "lucide-react";
import { api } from "../services/api";
import type { Repository } from "../services/types";
import { StatusStates } from "../components/StatusStates";

const EXAMPLE_REPOS = [
  { label: "FastAPI", url: "https://github.com/tiangolo/fastapi", desc: "Python web framework" },
  { label: "Django", url: "https://github.com/django/django",    desc: "Python web framework" },
  { label: "Flask",  url: "https://github.com/pallets/flask",    desc: "Python microframework" },
];

const PIPELINE_STEPS = [
  { icon: GitBranch, label: "Clone repository",        detail: "Checks out the repository to a local workspace for analysis." },
  { icon: Code2,     label: "Parse source files",      detail: "Runs tree-sitter parsers on Python, TypeScript, and JavaScript files." },
  { icon: Layers,    label: "Build code twin",         detail: "Creates nodes (files, functions, classes) and edges (calls, imports, extends)." },
  { icon: GitFork,   label: "Enrich with git history", detail: "Attributes ownership and last-modified dates from git blame." },
  { icon: Network,   label: "Store graph",             detail: "Saves the twin as a persistent graph for instant exploration." },
];

export function IngestionPage({ onRepository, onNavigate }: { onRepository: (repository: Repository) => void; onNavigate?: (tab: string) => void }) {
  const [url,        setUrl]        = useState("");
  const [repository, setRepository] = useState<Repository>();
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string>();

  async function ingest() {
    const trimmedUrl = url.trim();
    if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(trimmedUrl)) {
      setError("Enter a valid GitHub repository URL, e.g. https://github.com/tiangolo/fastapi");
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
      <div className="hf-ingest-grid">

        {/* ── COMMAND PANEL ── */}
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Repository twin</span>
          <h3>Build the evidence layer</h3>
          <p className="hf-muted">
            Start here. HelixFactory cannot make trusted risk claims until it can cite real files,
            symbols, imports, calls, ownership, and dependency paths.
          </p>

          <label className="hf-field">
            <span>GitHub repository URL</span>
            <input
              className="hf-input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") void ingest(); }}
              aria-label="Repository URL"
              placeholder="https://github.com/owner/repository"
              autoComplete="off"
              spellCheck={false}
              disabled={loading}
            />
          </label>

          {/* Example repos */}
          <div className="hf-ingest-examples">
            <span>Try an example:</span>
            {EXAMPLE_REPOS.map(r => (
              <button
                key={r.url}
                type="button"
                className="hf-ingest-example-btn"
                onClick={() => setUrl(r.url)}
                disabled={loading}
                title={r.desc}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            className="tool-button tool-button-primary"
            onClick={() => void ingest()}
            disabled={loading || !url.trim()}
            type="button"
          >
            <UploadCloud size={16} />
            {loading ? "Ingesting…" : "Ingest repository"}
          </button>

          {loading  && <StatusStates status="loading" message="Ingestion running — parsing files and building the code twin. This takes 30–90 seconds for most repositories." />}
          {error    && <StatusStates status="failed"  message={error} />}
          {!loading && !error && !repository && (
            <StatusStates status="empty" message="No repository ingested in this session." />
          )}
        </div>

        {/* ── RESULT PANEL ── */}
        {repository && (
          <div className="hf-panel hf-result-panel hf-ingest-state">
            <div className="hf-panel-header">
              <CheckCircle2 size={18} style={{ color: "var(--hf-green)" }} />
              <h2 className="hf-panel-title">Twin build result</h2>
              <span className={`hf-panel-meta hf-ingest-status-${repository.ingestionStatus}`}>
                {repository.ingestionStatus}
              </span>
            </div>

            <div className="hf-kpi-grid">
              <div className="hf-kpi-wide">
                <GitBranch size={16} />
                <div>
                  <div className="hf-kpi-label">Repository</div>
                  <div className="hf-kpi-value hf-kpi-url" title={repository.url}>{repository.url}</div>
                </div>
              </div>
              <div>
                <div className="hf-kpi-label">Nodes</div>
                <div className="hf-kpi-value">{(repository.nodeCount ?? 0).toLocaleString()}</div>
              </div>
              <div>
                <div className="hf-kpi-label">Edges</div>
                <div className="hf-kpi-value">{(repository.edgeCount ?? 0).toLocaleString()}</div>
              </div>
              {repository.supportedLanguages?.length > 0 && (
                <div className="hf-kpi-wide">
                  <div className="hf-kpi-label">Languages</div>
                  <div className="hf-kpi-value" style={{ fontSize: "0.92rem" }}>
                    {repository.supportedLanguages.join(", ")}
                  </div>
                </div>
              )}
            </div>

            {repository.failureReason && (
              <StatusStates status="partial" message={repository.failureReason} />
            )}

            {repository.ingestionStatus === "complete" || repository.ingestionStatus === "partial" ? (
              <div className="hf-ingest-success-actions">
                <p className="hf-muted hf-ingest-ready-msg">
                  Twin ready. Next, open the <strong>Twin</strong> to understand the architecture,
                  or run a <strong>Pre-mortem</strong> before changing risky code.
                </p>
                <div className="hf-ingest-action-row">
                  <button type="button" className="tool-button tool-button-primary hf-ingest-nav-btn" onClick={() => onNavigate?.("graph")}>
                    <Network size={15} /> Explore Twin <ArrowRight size={14} />
                  </button>
                  <button type="button" className="tool-button hf-ingest-nav-btn" onClick={() => onNavigate?.("impact")}>
                    <CheckCircle2 size={15} /> Assess impact
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ── PIPELINE EXPLAINER (shown when no result yet) ── */}
        {!repository && (
          <div className="hf-panel hf-ingest-state hf-ingest-explainer">
            <div className="hf-panel-header">
              <Network size={16} />
              <h2 className="hf-panel-title">What gets built</h2>
            </div>
            <div className="hf-ingest-pipeline">
              {PIPELINE_STEPS.map(({ icon: Icon, label, detail }) => (
                <article key={label}>
                  <Icon size={15} />
                  <div>
                    <strong>{label}</strong>
                    <span>{detail}</span>
                  </div>
                </article>
              ))}
            </div>
            <p className="hf-muted hf-ingest-supported">
              Supported languages: <strong>Python</strong>, <strong>TypeScript</strong>, <strong>JavaScript</strong>.
              Other files are skipped gracefully.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
