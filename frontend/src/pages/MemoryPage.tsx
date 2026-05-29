import { useState } from "react";
import { BookOpenText, Brain, FileCode2, MessageSquare } from "lucide-react";
import { StatusStates } from "../components/StatusStates";
import { api } from "../services/api";
import type { ArchitectureAnswer, Repository } from "../services/types";

const MEMORY_QUESTIONS = [
  { label: "Why does this exist?",      q: "Why does this architecture exist and what evidence supports it?" },
  { label: "Key design decisions",      q: "What were the key architectural decisions and why were they made?" },
  { label: "Biggest risks",             q: "What are the biggest architectural risks in this codebase?" },
  { label: "Who owns what",             q: "Who owns the most critical components?" },
];

export function MemoryPage({ repository }: { repository?: Repository }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<ArchitectureAnswer>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function ask() {
    if (!repository || !question.trim()) return;
    setLoading(true); setError(undefined); setAnswer(undefined);
    try {
      setAnswer(await api.askArchitecture(repository.id, question.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Memory query failed");
    } finally { setLoading(false); }
  }

  return (
    <section className="hf-page hf-ops-page">
      <div className="hf-page-full">
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Organizational memory</span>
          <h3>Ask why, not only where</h3>
          <p className="hf-muted" style={{ fontSize: "0.84rem" }}>
            Query the organizational memory layer — architectural decisions, rationale, ownership, and historical context — with evidence citations from the twin.
          </p>
          <label className="hf-field">
            <span>Memory question</span>
            <textarea
              className="hf-input"
              aria-label="Memory question"
              value={question}
              rows={3}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && repository && !loading) void ask(); }}
              placeholder="Why does this architecture exist? What are the key design decisions?"
            />
          </label>
          <div className="hf-suggestion-grid">
            {MEMORY_QUESTIONS.map(mq => (
              <button key={mq.label} className="hf-suggestion" type="button" onClick={() => setQuestion(mq.q)}>
                {mq.label}
              </button>
            ))}
          </div>
          <button
            className="tool-button tool-button-primary"
            type="button"
            disabled={!repository || loading || !question.trim()}
            onClick={() => void ask()}
          >
            <BookOpenText size={16} /> Query memory
            <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.6 }}>⌘↵</span>
          </button>
          {!repository && <StatusStates status="empty" message="Ingest a repository before querying organizational memory." />}
          {loading && <StatusStates status="loading" message="Retrieving cited evidence from the memory layer…" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>

        <div className="hf-result-fill">
          {!answer && !loading && !error && (
            <div className="hf-result-placeholder">
              <Brain size={32} strokeWidth={1.2} />
              <strong>No memory query yet</strong>
              <p>Ask why decisions were made, who owns critical components, or what the biggest architectural risks are. Every answer is grounded in twin evidence — not generated from thin air.</p>
            </div>
          )}

          {answer && (
            <>
              <div className="hf-panel hf-gate-card">
                <div className="hf-gate-card-header">
                  <MessageSquare size={16} style={{ color: "var(--hf-blue)" }} />
                  <span className="hf-gate-card-title">Memory answer</span>
                  <span className="hf-exec-status completed">{answer.citations.length} citation{answer.citations.length !== 1 ? "s" : ""}</span>
                </div>
                <p style={{ margin: "0.25rem 0 0", color: "var(--hf-text-soft)", fontSize: "0.9rem", lineHeight: 1.65 }}>
                  {answer.answer}
                </p>
              </div>

              {answer.citations.length > 0 && (
                <div className="hf-panel hf-gate-card">
                  <div className="hf-gate-card-header">
                    <FileCode2 size={16} style={{ color: "var(--hf-teal)" }} />
                    <span className="hf-gate-card-title">Evidence citations</span>
                  </div>
                  {answer.citations.map((c, i) => (
                    <div className="hf-evidence-row" key={i}>
                      <span>{c.sourceType}</span>
                      <strong style={{ fontFamily: "ui-monospace, monospace", color: "var(--hf-teal)", fontSize: "0.8rem" }}>
                        {c.path ?? c.sourceRef}{c.line ? `:${c.line}` : ""}
                      </strong>
                    </div>
                  ))}
                </div>
              )}

              {answer.uncertainty.length > 0 && (
                <div className="hf-panel hf-gate-card" style={{ borderLeftColor: "#fadb14", borderLeftWidth: 3 }}>
                  <div className="hf-gate-card-header">
                    <span className="hf-gate-card-title" style={{ color: "#fadb14" }}>Evidence gaps</span>
                  </div>
                  {answer.uncertainty.map((u, i) => (
                    <div className="hf-evidence-row" key={i}>
                      <span>Gap</span><strong>{u}</strong>
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
