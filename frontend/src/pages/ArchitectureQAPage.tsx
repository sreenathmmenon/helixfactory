import { useState } from "react";
import { Brain, Quote, SearchCheck } from "lucide-react";
import { api } from "../services/api";
import type { ArchitectureAnswer, Repository } from "../services/types";
import { StatusStates } from "../components/StatusStates";

export function ArchitectureQAPage({ repository }: { repository?: Repository }) {
  const [question, setQuestion] = useState("What would break if this function changed?");
  const [answer, setAnswer] = useState<ArchitectureAnswer>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  async function ask() {
    if (!repository) return;
    if (!question.trim()) {
      setError("Enter a question about the repository architecture.");
      return;
    }
    setLoading(true);
    setError(undefined);
    setAnswer(undefined);
    try {
      setAnswer(await api.askArchitecture(repository.id, question.trim()));
    } catch (err) {
      setAnswer(undefined);
      setError(err instanceof Error ? err.message : "Architecture answer failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="hf-page">
      <div className={`hf-page-grid ${answer ? "" : "hf-page-grid-single"}`}>
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Evidence-grounded Q&A</span>
          <h3>Ask the twin, not the raw repository</h3>
          <label className="hf-field">
            <span>Question</span>
            <textarea className="hf-input" aria-label="Architecture question" value={question} onChange={(event) => setQuestion(event.target.value)} />
          </label>
          <div className="hf-suggestion-grid">
            {["Entry points", "Authentication", "Blast radius"].map((label, index) => {
              const item = ["What are the entry points?", "What handles authentication?", "What would break if this changed?"][index];
              return <button className="hf-suggestion" key={label} type="button" onClick={() => setQuestion(item)}>{label}</button>;
            })}
          </div>
          <button className="tool-button tool-button-primary" disabled={!repository || loading || !question.trim()} onClick={ask} type="button"><Brain size={16} /> Ask architecture</button>
          {!repository && <StatusStates status="empty" message="Ingest a repository before asking architecture questions." />}
          {loading && <StatusStates status="loading" message="Collecting cited twin evidence" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>
        {answer && (
          <div className="hf-panel hf-result-panel">
            <div className="hf-panel-header">
              <SearchCheck size={18} />
              <h2 className="hf-panel-title">Answer</h2>
              <span className="hf-panel-meta">{answer.citations.length} citations</span>
            </div>
              <div className="hf-answer-card">
                <Quote size={18} />
                <p>{answer.answer}</p>
              </div>
              {answer.citations.length > 0 ? (
                <div className="hf-evidence-list">
                  {answer.citations.map((citation) => (
                    <div className="hf-evidence-item" key={`${citation.sourceRef}-${citation.path ?? "node"}`}>
                      <span>{citation.sourceType}</span>
                      <strong>{citation.path ?? citation.sourceRef}{citation.line ? `:${citation.line}` : ""}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <StatusStates status="partial" message="No file or line citation was available for this answer." />
              )}
            {answer.uncertainty.length > 0 && <StatusStates status="partial" message={`Uncertainty: ${answer.uncertainty.join("; ")}`} />}
          </div>
        )}
      </div>
    </section>
  );
}
