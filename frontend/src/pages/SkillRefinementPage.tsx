import { useState } from "react";
import { CheckCircle2, FileCode2, Sparkles, XCircle } from "lucide-react";
import { api } from "../services/api";
import type { SkillRefinement } from "../services/types";
import { StatusStates } from "../components/StatusStates";

const EXAMPLES = [
  { pattern: "When touching auth middleware, always run the full OAuth2 test suite", evidence: "exec-demo,src/flask/app.py" },
  { pattern: "Preserve stable UUIDv5 node IDs when modifying the twin builder", evidence: "exec-demo,backend/src/helixfactory/ingestion/twin_builder.py" },
];

export function SkillRefinementPage() {
  const [proposal, setProposal] = useState<SkillRefinement>();
  const [pattern, setPattern] = useState("");
  const [evidence, setEvidence] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function propose() {
    const evidenceRefs = evidence.split(",").map(r => r.trim()).filter(Boolean);
    if (!pattern.trim() || evidenceRefs.length === 0) {
      setError("Provide both a pattern and at least one evidence reference.");
      return;
    }
    setLoading(true); setError(undefined); setProposal(undefined);
    try {
      setProposal(await api.proposeSkillRefinement("exec-demo", pattern.trim(), evidenceRefs));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refinement proposal failed");
    } finally { setLoading(false); }
  }

  async function decide(action: "approve" | "reject") {
    if (!proposal) return;
    setLoading(true); setError(undefined);
    try {
      setProposal(
        action === "approve"
          ? await api.approveSkillRefinement(proposal.id, "reviewer")
          : await api.rejectSkillRefinement(proposal.id, "reviewer")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally { setLoading(false); }
  }

  function fillExample(ex: typeof EXAMPLES[0]) {
    setPattern(ex.pattern);
    setEvidence(ex.evidence);
  }

  return (
    <section className="hf-page hf-ops-page">
      <div className="hf-page-full">
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Operating memory</span>
          <h3>Promote evidence-backed team patterns</h3>
          <p className="hf-muted" style={{ fontSize: "0.84rem" }}>
            Propose codebase-specific patterns that improve how the platform operates on this repository. Every refinement must cite real evidence references — generic patterns are rejected.
          </p>

          <label className="hf-field">
            <span>Pattern summary</span>
            <textarea
              className="hf-input"
              aria-label="Pattern summary"
              value={pattern}
              rows={3}
              onChange={e => setPattern(e.target.value)}
              placeholder="Describe a codebase-specific pattern the platform should learn"
            />
          </label>
          <label className="hf-field">
            <span>Evidence references <span style={{ color: "var(--hf-faint)", fontWeight: 400 }}>(comma-separated)</span></span>
            <input
              className="hf-input"
              aria-label="Evidence references"
              value={evidence}
              onChange={e => setEvidence(e.target.value)}
              placeholder="exec-demo, src/flask/app.py, backend/tests/test_auth.py"
            />
          </label>

          <div className="hf-ingest-examples">
            <span>Load example:</span>
            {EXAMPLES.map((ex, i) => (
              <button key={i} type="button" className="hf-ingest-example-btn" onClick={() => fillExample(ex)}>
                Example {i + 1}
              </button>
            ))}
          </div>

          <button
            className="tool-button tool-button-primary"
            disabled={loading || !pattern.trim() || !evidence.trim()}
            type="button"
            onClick={() => void propose()}
          >
            <Sparkles size={16} /> Propose refinement
          </button>
          {loading && <StatusStates status="loading" message="Recording skill refinement evidence…" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>

        <div className="hf-result-fill">
          {!proposal && !loading && !error && (
            <div className="hf-result-placeholder">
              <Sparkles size={32} strokeWidth={1.2} />
              <strong>No refinement proposed yet</strong>
              <p>Propose a codebase-specific pattern to improve how the platform handles this repository. Approved refinements become part of the operating memory and influence future pre-mortem and risk checks.</p>
            </div>
          )}

          {proposal && (
            <>
              <div className="hf-skill-card">
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <Sparkles size={16} style={{ color: "var(--hf-purple)", flexShrink: 0 }} />
                  <span style={{ color: "white", fontWeight: 700, fontSize: "0.9rem", flex: 1 }}>
                    {proposal.patternSummary}
                  </span>
                  <span className={`hf-skill-status ${proposal.status}`}>{proposal.status}</span>
                </div>

                {proposal.proposalText && (
                  <p style={{ margin: 0, color: "var(--hf-muted)", fontSize: "0.84rem", lineHeight: 1.6 }}>
                    {proposal.proposalText}
                  </p>
                )}

                {proposal.evidenceRefs.length > 0 && (
                  <div>
                    <span style={{ color: "var(--hf-faint)", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      Evidence references
                    </span>
                    {proposal.evidenceRefs.map(ref => (
                      <div className="hf-evidence-row" key={ref}>
                        <span><FileCode2 size={11} /> Ref</span>
                        <strong style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8rem" }}>{ref}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {proposal.status === "proposed" && (
                  <div style={{ display: "flex", gap: "0.65rem", marginTop: "0.25rem" }}>
                    <button
                      className="tool-button tool-button-primary"
                      type="button"
                      disabled={loading}
                      onClick={() => decide("approve")}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <CheckCircle2 size={15} /> Approve
                    </button>
                    <button
                      className="tool-button"
                      type="button"
                      disabled={loading}
                      onClick={() => decide("reject")}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <XCircle size={15} /> Reject
                    </button>
                  </div>
                )}

                {proposal.status !== "proposed" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: proposal.status === "approved" ? "#52c41a" : "#ff4d4f", fontSize: "0.84rem" }}>
                    {proposal.status === "approved" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                    <span>Refinement {proposal.status} by {proposal.reviewer ?? "reviewer"}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
