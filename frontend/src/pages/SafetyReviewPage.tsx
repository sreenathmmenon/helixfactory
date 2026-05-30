import { useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ClipboardCheck, FileCode2, GitBranch, GitPullRequestArrow, ListChecks, Network, ShieldCheck, ShieldX, Stamp, XCircle } from "lucide-react";
import { StatusStates } from "../components/StatusStates";
import { api } from "../services/api";
import type { ChangeType, GraphNode, Repository, SafetyReviewResult } from "../services/types";

const FLASK_SCENARIO = {
  label: "Flask session/cookie",
  summary: "Modify Flask session and cookie handling for authentication safety",
  targets: "sessions.py\napp.py\ncookie",
  scenarioId: "flask-session-cookie-safety"
};

const CHANGE_TYPES: Array<{ value: ChangeType; label: string }> = [
  { value: "modify", label: "Modify" },
  { value: "interface", label: "Interface" },
  { value: "dependency", label: "Dependency" },
  { value: "database", label: "Data" }
];

type ApprovalState = "approved" | "rejected";
type SafetyTab = "graph" | "impact" | "audit" | "premortem" | "qa" | "execution" | "ingest";

const GUIDED_STEPS = [
  "AI agent proposes change",
  "Twin resolves affected code",
  "Pre-mortem predicts failure modes",
  "Blast radius maps impact",
  "Policy allows or blocks",
  "Human gate records decision",
  "Audit evidence is created"
];

function splitTargets(value: string) {
  return value
    .split(/[\n,]/)
    .map((target) => target.trim())
    .filter(Boolean);
}

function riskBlocks(result: SafetyReviewResult) {
  return result.decision.status === "block";
}

function impactCounts(result?: SafetyReviewResult, targets: string[] = []) {
  if (!result) return { direct: 0, transitive: 0 };
  const targetNodes = new Set(
    result.blastRadius.nodes
      .filter((node) => targets.some((target) => nodeMatchesTarget(node, target)))
      .map((node) => node.id)
  );

  if (targetNodes.size === 0) {
    return {
      direct: result.blastRadius.edges.length,
      transitive: Math.max(0, result.blastRadius.nodes.length - result.blastRadius.edges.length)
    };
  }

  const direct = new Set<string>();
  for (const edge of result.blastRadius.edges) {
    if (targetNodes.has(edge.source) && !targetNodes.has(edge.target)) direct.add(edge.target);
    if (targetNodes.has(edge.target) && !targetNodes.has(edge.source)) direct.add(edge.source);
  }

  const transitive = result.blastRadius.nodes.filter((node) => !targetNodes.has(node.id) && !direct.has(node.id)).length;
  return { direct: direct.size, transitive };
}

function nodeMatchesTarget(node: GraphNode, target: string) {
  const needle = target.toLowerCase();
  return [node.id, node.name, node.path ?? ""].some((value) => value.toLowerCase().includes(needle));
}

function evidenceCompleteness(result?: SafetyReviewResult) {
  if (!result) return { label: "Not run", confidence: "Unknown" };
  const gaps = result.premortem.evidenceGaps.length;
  if (result.evidenceCompleteness === "complete") return { label: "Evidence complete", confidence: result.confidence };
  if (result.evidenceCompleteness === "partial") return { label: `${gaps} gap${gaps === 1 ? "" : "s"}`, confidence: result.confidence };
  return { label: "Insufficient evidence", confidence: result.confidence };
}

function formatRisk(value: string) {
  return value.replace(/_/g, " ");
}

function uniquePaths(result: SafetyReviewResult) {
  const paths = new Set<string>();
  result.premortem.findings.forEach((finding) => paths.add(finding.filePath));
  result.blastRadius.nodes.forEach((node) => {
    if (node.path) paths.add(node.path);
  });
  return Array.from(paths).slice(0, 6);
}

function mcpSummary(result: SafetyReviewResult) {
  return [
    { label: "Tool", value: "helix_create_safety_review" },
    { label: "Decision", value: result.decision.status },
    { label: "Risk", value: result.premortem.riskStatus },
    { label: "Approval", value: result.approvalStatus },
    { label: "Evidence", value: `${result.premortem.findings.length} finding${result.premortem.findings.length === 1 ? "" : "s"}` },
    { label: "Audit", value: result.auditRecordId }
  ];
}

export function SafetyReviewPage({ repository, onNavigate }: { repository?: Repository; onNavigate?: (tab: SafetyTab) => void }) {
  const [summary, setSummary] = useState("");
  const [targets, setTargets] = useState("");
  const [changeType, setChangeType] = useState<ChangeType>("modify");
  const [result, setResult] = useState<SafetyReviewResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [reviewer, setReviewer] = useState("");
  const [reason, setReason] = useState("");
  const [approvalAudit, setApprovalAudit] = useState<string>();
  const [approvalLoading, setApprovalLoading] = useState(false);

  const targetRefs = useMemo(() => splitTargets(targets), [targets]);
  const counts = impactCounts(result, targetRefs);
  const completeness = evidenceCompleteness(result);
  const blocked = result ? riskBlocks(result) : false;
  const checks = result ? result.suggestedChecks : [];
  const evidencePaths = result ? uniquePaths(result) : [];

  function useFlaskScenario() {
    setSummary(FLASK_SCENARIO.summary);
    setTargets(FLASK_SCENARIO.targets);
    setChangeType("interface");
    setResult(undefined);
    setError(undefined);
    setApprovalAudit(undefined);
  }

  async function run() {
    if (!repository || !summary.trim() || targetRefs.length === 0) return;
    setLoading(true);
    setError(undefined);
    setResult(undefined);
    setApprovalAudit(undefined);
    try {
      setResult(await api.runSafetyReview({
        repositoryId: repository.id,
        summary: summary.trim(),
        targetRefs,
        changeType,
        scenarioId: summary === FLASK_SCENARIO.summary ? FLASK_SCENARIO.scenarioId : undefined
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Safety review failed");
    } finally {
      setLoading(false);
    }
  }

  async function recordApproval(next: ApprovalState) {
    if (!result || !reviewer.trim() || !reason.trim()) return;
    setApprovalLoading(true);
    setError(undefined);
    try {
      const decision = next === "approved"
        ? await api.approveSafetyReview(result.id, reviewer.trim(), reason.trim())
        : await api.rejectSafetyReview(result.id, reviewer.trim(), reason.trim());
      setApprovalAudit(decision.auditRecordId);
      setResult({ ...result, approvalStatus: decision.approvalStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record approval decision");
    } finally {
      setApprovalLoading(false);
    }
  }

  return (
    <section className="hf-page hf-ops-page hf-safety-page">
      <div className="hf-page-full">
        <div className="hf-panel hf-command-panel">
          <span className="hf-section-kicker">Safety review</span>
          <h3>Assess change before code moves</h3>
          <p className="hf-muted">
            Run one decision report from twin evidence: risk, impact, required checks, and reviewer disposition.
          </p>

          <div className="hf-safety-flow" aria-label="Guided safety workflow">
            {GUIDED_STEPS.map((step, index) => (
              <span key={step} className={result ? "complete" : index === 0 ? "active" : ""}>
                <strong>{index + 1}</strong>
                {step}
              </span>
            ))}
          </div>

          <button className="hf-safety-scenario" type="button" onClick={useFlaskScenario}>
            <ShieldCheck size={16} />
            <span>
              <strong>{FLASK_SCENARIO.label}</strong>
              <small>Reliable demo: session/cookie change, twin evidence, gate, audit</small>
            </span>
          </button>

          <label className="hf-field">
            <span>Planned change</span>
            <textarea
              className="hf-input"
              aria-label="Planned change"
              value={summary}
              rows={4}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="Describe the change and what should be protected"
            />
          </label>

          <label className="hf-field">
            <span>Targets</span>
            <textarea
              className="hf-input"
              aria-label="Change targets"
              value={targets}
              rows={3}
              onChange={(event) => setTargets(event.target.value)}
              placeholder="File, module, symbol, or concern. Separate with commas or new lines."
            />
          </label>

          <label className="hf-field">
            <span>Change type</span>
            <select className="hf-input" aria-label="Change type" value={changeType} onChange={(event) => setChangeType(event.target.value as ChangeType)}>
              {CHANGE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>

          <button
            className="tool-button tool-button-primary"
            type="button"
            disabled={!repository || loading || !summary.trim() || targetRefs.length === 0}
            onClick={() => void run()}
          >
            <ClipboardCheck size={16} /> Run safety review
          </button>

          {!repository && <StatusStates status="empty" message="Ingest a repository before assessing a change." />}
          {loading && <StatusStates status="loading" message="Tracing risk evidence and blast radius…" />}
          {error && <StatusStates status="failed" message={error} />}
        </div>

        <div className="hf-result-fill">
          {!result && !loading && !error && (
            <div className="hf-result-placeholder">
              <ClipboardCheck size={32} strokeWidth={1.2} />
              <strong>No safety review run yet</strong>
              <p>Choose the Flask session/cookie scenario or enter a planned change and targets. The report will show one allow/block decision with evidence and checks.</p>
              <div className="hf-safety-placeholder-grid">
                <span><Network size={14} /> Twin resolves exact code</span>
                <span><AlertTriangle size={14} /> Pre-mortem predicts failure modes</span>
                <span><GitPullRequestArrow size={14} /> PR/CI gate shows allow or block</span>
                <span><Bot size={14} /> MCP returns the same decision to agents</span>
              </div>
            </div>
          )}

          {result && (
            <>
              <section className={`hf-safety-report ${blocked ? "blocked" : "allowed"}`}>
                <div className="hf-safety-verdict">
                  <div>
                    <span className="hf-section-kicker">Decision</span>
                    <h3>{blocked ? "Blocked until human review" : "Allowed for standard review"}</h3>
                    <p>
                      {blocked
                        ? "High risk or incomplete evidence prevents auto-approval."
                        : "No blocking risk was returned; continue with the required checks."}
                    </p>
                  </div>
                  <div className="hf-safety-decision-mark">
                    {blocked ? <ShieldX size={22} /> : <CheckCircle2 size={22} />}
                    <strong>{blocked ? "Block" : "Allow"}</strong>
                  </div>
                </div>

                <div className="hf-safety-metrics">
                  <div>
                    <span>Risk</span>
                    <strong>{formatRisk(result.premortem.riskStatus)}</strong>
                  </div>
                  <div>
                    <span>Confidence</span>
                    <strong>{completeness.confidence}</strong>
                    <small>{completeness.label}</small>
                  </div>
                  <div>
                    <span>Direct impact</span>
                    <strong>{counts.direct}</strong>
                  </div>
                  <div>
                    <span>Transitive impact</span>
                    <strong>{counts.transitive}</strong>
                  </div>
                  <div>
                    <span>Audit id</span>
                    <strong className="hf-safety-audit">{result.auditRecordId}</strong>
                  </div>
                </div>
                <p className="hf-safety-decision-reason">{result.decision.reason}</p>
              </section>

              <section className="hf-safety-system-grid" aria-label="Change safety system outputs">
                <article className={`hf-panel hf-safety-gate-sim ${blocked ? "blocked" : "allowed"}`}>
                  <div className="hf-gate-card-header">
                    <GitPullRequestArrow size={16} />
                    <span className="hf-gate-card-title">PR / CI gate</span>
                    <span className={`hf-exec-status ${blocked ? "blocked" : "completed"}`}>
                      {blocked ? "would block" : "would pass"}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>CI result</dt>
                      <dd>{blocked ? "This PR would be blocked before merge." : "This PR can continue with standard checks."}</dd>
                    </div>
                    <div>
                      <dt>Reviewer</dt>
                      <dd>{blocked ? "Required for HIGH/CRITICAL or incomplete evidence." : "Standard reviewer policy applies."}</dd>
                    </div>
                    <div>
                      <dt>Audit evidence</dt>
                      <dd>{result.auditRecordId}</dd>
                    </div>
                  </dl>
                </article>

                <article className="hf-panel hf-safety-mcp-card">
                  <div className="hf-gate-card-header">
                    <Bot size={16} />
                    <span className="hf-gate-card-title">MCP agent output</span>
                    <span className={`hf-exec-status ${blocked ? "blocked" : "completed"}`}>
                      {result.decision.status}
                    </span>
                  </div>
                  <div className="hf-safety-mcp-grid">
                    {mcpSummary(result).map((item) => (
                      <div key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                  <p>An integrated AI coding agent receives this same structured decision before editing code.</p>
                </article>
              </section>

              <section className="hf-panel hf-safety-section">
                <div className="hf-gate-card-header">
                  <Network size={16} />
                  <span className="hf-gate-card-title">Twin context used</span>
                  <span className="hf-exec-status completed">{result.blastRadius.nodes.length} nodes</span>
                </div>
                <div className="hf-safety-context-grid">
                  <div>
                    <span>Affected code</span>
                    <strong>{evidencePaths.length} file path{evidencePaths.length === 1 ? "" : "s"} resolved</strong>
                  </div>
                  <div>
                    <span>Blast radius</span>
                    <strong>{result.blastRadius.nodes.length} nodes, {result.blastRadius.edges.length} relationships</strong>
                  </div>
                  <div>
                    <span>Evidence quality</span>
                    <strong>{completeness.label}</strong>
                  </div>
                </div>
                {evidencePaths.length > 0 && (
                  <div className="hf-safety-path-list">
                    {evidencePaths.map((path) => <span key={path}>{path}</span>)}
                  </div>
                )}
                <div className="hf-action-row">
                  <button className="tool-button" type="button" onClick={() => onNavigate?.("graph")}>
                    <Network size={15} /> Inspect in Twin
                  </button>
                  <button className="tool-button" type="button" onClick={() => onNavigate?.("audit")}>
                    <Stamp size={15} /> View audit package
                  </button>
                </div>
              </section>

              <section className="hf-panel hf-safety-section">
                <div className="hf-gate-card-header">
                  <FileCode2 size={16} />
                  <span className="hf-gate-card-title">Exact evidence</span>
                  <span className={`hf-exec-status ${blocked ? "blocked" : "completed"}`}>
                    {result.premortem.findings.length} finding{result.premortem.findings.length === 1 ? "" : "s"}
                  </span>
                </div>
                {result.premortem.findings.length > 0 ? (
                  <div className="hf-safety-evidence-list">
                    {result.premortem.findings.map((finding) => (
                      <article key={finding.id} className="hf-safety-evidence">
                        <div>
                          <strong>{finding.title}</strong>
                          <span className={`hf-safety-severity ${finding.severity}`}>{finding.severity}</span>
                        </div>
                        <p>{finding.consequence}</p>
                        <dl>
                          <div><dt>Location</dt><dd>{finding.filePath}:{finding.line}</dd></div>
                          <div><dt>Dependency chain</dt><dd>{finding.dependencyChain.join(" -> ")}</dd></div>
                          <div><dt>Check</dt><dd>{finding.preventiveCheck}</dd></div>
                        </dl>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="hf-safety-empty-evidence">
                    <CheckCircle2 size={18} />
                    <span>No evidence-backed blocking finding was returned.</span>
                  </div>
                )}
                {result.premortem.evidenceGaps.length > 0 && (
                  <div className="hf-safety-gaps">
                    {result.premortem.evidenceGaps.map((gap) => (
                      <span key={gap}><AlertTriangle size={12} /> {gap}</span>
                    ))}
                  </div>
                )}
              </section>

              <section className="hf-panel hf-safety-section">
                <div className="hf-gate-card-header">
                  <GitBranch size={16} />
                  <span className="hf-gate-card-title">Required checks</span>
                </div>
                <div className="hf-safety-checks">
                  {checks.map((check) => <span key={check}><ListChecks size={13} /> {check}</span>)}
                </div>
              </section>

              <section className="hf-panel hf-safety-section">
                <div className="hf-gate-card-header">
                  <Stamp size={16} />
                  <span className="hf-gate-card-title">Approval</span>
                  <span className={`hf-exec-status ${result.approvalStatus === "approved" ? "approved" : result.approvalStatus === "rejected" ? "blocked" : "reviewing"}`}>
                    {result.approvalStatus}
                  </span>
                </div>
                <div className="hf-safety-approval-grid">
                  <label className="hf-field">
                    <span>Reviewer</span>
                    <input className="hf-input" aria-label="Reviewer" value={reviewer} onChange={(event) => setReviewer(event.target.value)} placeholder="Reviewer name" />
                  </label>
                  <label className="hf-field">
                    <span>Reason</span>
                    <input className="hf-input" aria-label="Approval reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Decision rationale" />
                  </label>
                </div>
                <div className="hf-action-row">
                  <button className="tool-button" type="button" disabled={approvalLoading || !reviewer.trim() || !reason.trim()} onClick={() => void recordApproval("approved")}>
                    <CheckCircle2 size={15} /> Approve
                  </button>
                  <button className="tool-button" type="button" disabled={approvalLoading || !reviewer.trim() || !reason.trim()} onClick={() => void recordApproval("rejected")}>
                    <XCircle size={15} /> Reject
                  </button>
                  <span className="hf-safety-approval-note">Audit: {approvalAudit ?? result.auditRecordId}</span>
                </div>
                {approvalAudit && (
                  <div className="hf-safety-learning-signal">
                    <CheckCircle2 size={14} />
                    <span>Reviewer outcome recorded as an audit-backed learning signal for future policy refinement.</span>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
