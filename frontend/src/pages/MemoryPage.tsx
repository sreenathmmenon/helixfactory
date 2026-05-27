import { useState } from "react";
import { BookOpenText, Brain } from "lucide-react";
import { StatusStates } from "../components/StatusStates";
import { api } from "../services/api";
import type { ArchitectureAnswer, Repository } from "../services/types";

export function MemoryPage({ repository }: { repository?: Repository }) {
  const [question, setQuestion] = useState("Why does this architecture exist and what evidence supports it?");
  const [answer, setAnswer] = useState<ArchitectureAnswer>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function ask() {
    if (!repository) return;
    if (!question.trim()) {
      setError("Enter a memory question before querying evidence.");
      return;
    }
    setLoading(true);
    setError(undefined);
    setAnswer(undefined);
    try {
      setAnswer(await api.askArchitecture(repository.id, question.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Memory query failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="hf-page">
      <div className={`hf-page-grid ${answer ? "" : "hf-page-grid-single"}`}>
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Organizational memory</span>
          <h3>Ask why, not only where</h3>
          <label className="hf-field">
            <span>Memory question</span>
            <textarea className="hf-input" aria-label="Memory question" value={question} onChange={(event) => setQuestion(event.target.value)} />
          </label>
          <button className="tool-button tool-button-primary" type="button" disabled={!repository || loading || !question.trim()} onClick={ask}>
            <BookOpenText size={16} /> Query memory
          </button>
          {!repository && <StatusStates status="empty" message="Ingest a repository before memory answers can cite evidence." />}
          {loading && <StatusStates status="loading" message="Retrieving cited code and known memory sources" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>
        {answer && (
          <div className="hf-panel hf-result-panel">
            <div className="hf-panel-header">
              <Brain size={18} />
              <h2 className="hf-panel-title">Memory answer</h2>
              <span className="hf-panel-meta">{answer.citations.length} citations</span>
            </div>
              <div className="hf-answer-card"><BookOpenText size={18} /><p>{answer.answer}</p></div>
              <div className="hf-evidence-list">
                {answer.citations.map((citation) => (
                  <div className="hf-evidence-item" key={`${citation.sourceRef}-${citation.path}`}>
                    <span>{citation.sourceType}</span>
                    <strong>{citation.path ?? citation.sourceRef}{citation.line ? `:${citation.line}` : ""}</strong>
                  </div>
                ))}
              </div>
              {answer.uncertainty.map((item) => <StatusStates key={item} status="partial" message={item} />)}
          </div>
        )}
      </div>
    </section>
  );
}
