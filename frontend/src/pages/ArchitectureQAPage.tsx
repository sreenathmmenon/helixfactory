import { useState } from "react";
import { Brain, Quote, SearchCheck, Sparkles } from "lucide-react";
import { api } from "../services/api";
import type { ArchitectureAnswer, Repository } from "../services/types";
import { StatusStates } from "../components/StatusStates";

const SUGGESTIONS = [
  { label: "Entry points",      q: "What are the entry points?" },
  { label: "Authentication",    q: "What handles authentication?" },
  { label: "Blast radius",      q: "What is the highest-risk component?" },
  { label: "Dependencies",      q: "What are the most depended-on modules?" },
  { label: "Architecture",      q: "Describe the overall architecture." }
];

const EXAMPLE_ANSWERS = [
  { icon: "●", title: "Entry points", desc: "app.py is the main entry point, which initialises Flask and mounts route blueprints." },
  { icon: "ƒ", title: "Functions",    desc: "helpers.py contains the most-depended-on utility functions across 54 callers." },
  { icon: "◇", title: "Classes",      desc: "Flask class in app.py is the central dependency with 79 connections." }
];

export function ArchitectureQAPage({ repository }: { repository?: Repository }) {
  const [question, setQuestion] = useState("What are the entry points?");
  const [answer, setAnswer] = useState<ArchitectureAnswer>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function ask() {
    if (!repository) return;
    if (!question.trim()) { setError("Enter a question about the repository architecture."); return; }
    setLoading(true); setError(undefined); setAnswer(undefined);
    try {
      setAnswer(await api.askArchitecture(repository.id, question.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Architecture answer failed");
    } finally { setLoading(false); }
  }

  return (
    <section className="hf-page hf-qa-page hf-ops-page">
      <div className="hf-page-full hf-qa-layout">
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Evidence-grounded Q&amp;A</span>
          <h3>Ask the twin, not the raw repository</h3>
          <p className="hf-muted" style={{ fontSize: "0.86rem" }}>
            Every answer is grounded in the code twin — cited to a real file and line number, not generated from thin air.
          </p>
          <label className="hf-field">
            <span>Question</span>
            <textarea
              className="hf-input"
              aria-label="Architecture question"
              value={question}
              rows={3}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && repository && !loading) void ask(); }}
              placeholder="What are the entry points? What handles authentication? What would break if app.py changed?"
            />
          </label>
          <div className="hf-suggestion-grid">
            {SUGGESTIONS.map(s => (
              <button className="hf-suggestion" key={s.label} type="button" onClick={() => setQuestion(s.q)}>
                {s.label}
              </button>
            ))}
          </div>
          <button
            className="tool-button tool-button-primary"
            disabled={!repository || loading || !question.trim()}
            onClick={ask}
            type="button"
          >
            <Brain size={16} /> Ask architecture
            <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.6 }}>⌘↵</span>
          </button>
          {!repository && <StatusStates status="empty" message="Ingest a repository to ask architecture questions." />}
          {loading && <StatusStates status="loading" message="Collecting cited evidence from the twin…" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>

        <div className="hf-result-fill">
        {answer ? (
          <div className="hf-panel hf-result-panel">
            <div className="hf-panel-header">
              <SearchCheck size={18} />
              <h2 className="hf-panel-title">Answer</h2>
              <span className="hf-panel-meta">{answer.citations.length} citation{answer.citations.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="hf-answer-card">
              <Quote size={18} />
              <p>{answer.answer}</p>
            </div>
            {answer.citations.length > 0 ? (
              <div className="hf-evidence-list">
                <p style={{ color: "var(--hf-faint)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 0.45rem" }}>
                  Evidence citations
                </p>
                {answer.citations.map(c => (
                  <div className="hf-evidence-item" key={`${c.sourceRef}-${c.path ?? "node"}`}>
                    <span>{c.sourceType}</span>
                    <strong>{c.path ?? c.sourceRef}{c.line ? `:${c.line}` : ""}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <StatusStates status="partial" message="No file or line citation was available for this answer." />
            )}
            {answer.uncertainty.length > 0 && (
              <StatusStates status="partial" message={`Gaps: ${answer.uncertainty.join("; ")}`} />
            )}
          </div>
        ) : !loading && !error && (
          <div className="hf-panel hf-result-panel hf-qa-examples">
            <div className="hf-panel-header">
              <Sparkles size={16} />
              <h2 className="hf-panel-title">What the twin can answer</h2>
            </div>
            <div className="hf-qa-example-list">
              {EXAMPLE_ANSWERS.map(ex => (
                <div key={ex.title} className="hf-qa-example-card">
                  <span className="hf-qa-example-icon">{ex.icon}</span>
                  <div>
                    <strong>{ex.title}</strong>
                    <p>{ex.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="hf-muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
              Answers are evidence-backed — every claim cites a real file and line number from the code twin.
            </p>
          </div>
        )}
        </div>
      </div>
    </section>
  );
}
