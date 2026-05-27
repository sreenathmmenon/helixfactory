import { useState } from "react";
import { CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { api } from "../services/api";
import type { SkillRefinement } from "../services/types";
import { StatusStates } from "../components/StatusStates";

export function SkillRefinementPage() {
  const [proposal, setProposal] = useState<SkillRefinement>();
  const [pattern, setPattern] = useState("When touching the ingestion twin builder, preserve stable UUIDv5 node IDs");
  const [evidence, setEvidence] = useState("exec-demo,backend/src/helixfactory/ingestion/twin_builder.py");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  async function propose() {
    const evidenceRefs = evidence.split(",").map((ref) => ref.trim()).filter(Boolean);
    if (!pattern.trim()) {
      setError("Describe a codebase-specific pattern before proposing a refinement.");
      return;
    }
    if (evidenceRefs.length === 0) {
      setError("Add at least one evidence reference. Generic refinements are rejected.");
      return;
    }
    setLoading(true);
    setError(undefined);
    setProposal(undefined);
    try {
      setProposal(await api.proposeSkillRefinement("exec-demo", pattern.trim(), evidenceRefs));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Skill refinement was rejected");
    } finally {
      setLoading(false);
    }
  }
  async function decide(action: "approve" | "reject") {
    if (!proposal) return;
    setLoading(true);
    setError(undefined);
    try {
      setProposal(action === "approve" ? await api.approveSkillRefinement(proposal.id, "demo-reviewer") : await api.rejectSkillRefinement(proposal.id, "demo-reviewer"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Skill refinement decision failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="hf-page">
      <div className={`hf-page-grid ${proposal ? "" : "hf-page-grid-single"}`}>
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Operating memory</span>
          <h3>Promote evidence-backed team patterns</h3>
          <label className="hf-field">
            <span>Pattern summary</span>
            <textarea className="hf-input" aria-label="Pattern summary" value={pattern} onChange={(event) => setPattern(event.target.value)} />
          </label>
          <label className="hf-field">
            <span>Evidence references</span>
            <input className="hf-input" aria-label="Evidence references" value={evidence} onChange={(event) => setEvidence(event.target.value)} />
          </label>
          <button className="tool-button tool-button-primary" disabled={loading || !pattern.trim() || !evidence.trim()} type="button" onClick={propose}><Sparkles size={16} /> Propose refinement</button>
          {loading && <StatusStates status="loading" message="Recording skill refinement evidence" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>

        {proposal ? (
          <article className="hf-panel hf-result-panel">
            <div className="hf-panel-header">
              <Sparkles size={18} />
              <h2 className="hf-panel-title">{proposal.patternSummary}</h2>
              <span className="hf-panel-meta">{proposal.status}</span>
            </div>
            <p className="hf-muted">{proposal.proposalText}</p>
            <div className="hf-evidence-list">
              {proposal.evidenceRefs.map((ref) => <div className="hf-evidence-item" key={ref}><span>Evidence</span><strong>{ref}</strong></div>)}
            </div>
            <div className="hf-action-row">
              <button className="tool-button tool-button-primary" type="button" disabled={loading || proposal.status !== "proposed"} onClick={() => decide("approve")}><CheckCircle2 size={16} /> Approve</button>
              <button className="tool-button" type="button" disabled={loading || proposal.status !== "proposed"} onClick={() => decide("reject")}><XCircle size={16} /> Reject</button>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
