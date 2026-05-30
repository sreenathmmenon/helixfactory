import { AlertTriangle, CheckCircle2, ChevronRight, FileCode2, GitBranch, ShieldAlert, ShieldCheck, ShieldX, TriangleAlert } from "lucide-react";
import type { PreMortemResult } from "../services/types";

const SEVERITY_CONFIG = {
  critical: { color: "#ff4d4f", bg: "rgba(255,77,79,0.08)", border: "rgba(255,77,79,0.32)", label: "Critical", icon: ShieldX },
  high:     { color: "#fa8c16", bg: "rgba(250,140,22,0.08)", border: "rgba(250,140,22,0.32)", label: "High", icon: ShieldAlert },
  medium:   { color: "#fadb14", bg: "rgba(250,219,20,0.07)", border: "rgba(250,219,20,0.28)", label: "Medium", icon: TriangleAlert },
  low:      { color: "#52c41a", bg: "rgba(82,196,26,0.07)",  border: "rgba(82,196,26,0.25)",  label: "Low", icon: ShieldCheck },
} as const;

const RISK_BANNER = {
  critical:                     { color: "#ff4d4f", bg: "rgba(255,77,79,0.1)", label: "Critical risk" },
  high:                         { color: "#fa8c16", bg: "rgba(250,140,22,0.1)", label: "High risk" },
  medium:                       { color: "#fadb14", bg: "rgba(250,219,20,0.09)", label: "Medium risk" },
  low:                          { color: "#52c41a", bg: "rgba(82,196,26,0.09)", label: "Low risk" },
  blocked_insufficient_evidence:{ color: "#8c8c8c", bg: "rgba(140,140,140,0.09)", label: "Evidence incomplete" },
} as const;

function formatRiskStatus(status: PreMortemResult["riskStatus"]) {
  return status.replace(/_/g, " ");
}

function decisionCopy(result: PreMortemResult) {
  const blocking = result.requiresHumanApproval || result.riskStatus === "critical" || result.riskStatus === "high" || result.riskStatus === "blocked_insufficient_evidence";
  if (result.riskStatus === "blocked_insufficient_evidence") {
    return {
      blocking,
      title: "Gate blocked: evidence is incomplete",
      action: "Do not proceed until the twin can cite enough code evidence.",
      badge: "Blocked",
      detail: result.evidenceGaps[0] ?? "The pre-mortem could not prove the change is safe from the available twin evidence.",
    };
  }
  if (blocking) {
    return {
      blocking,
      title: "Gate blocked: human approval required",
      action: "Review the evidence chain and complete preventive checks before execution.",
      badge: "Human gate",
      detail: result.findings[0]
        ? `${result.findings[0].title}: ${result.findings[0].consequence}`
        : "The current risk status requires accountable human review before the change moves forward.",
    };
  }
  return {
    blocking,
    title: "Gate open: standard review applies",
    action: "Proceed through normal engineering review with the listed uncertainty in view.",
    badge: "Standard review",
    detail: result.findings[0]
      ? `${result.findings[0].title}: ${result.findings[0].consequence}`
      : "No evidence-backed blocking finding was returned for this target.",
  };
}

export function PreMortemPanel({ result }: { result?: PreMortemResult }) {
  if (!result) return null;

  const riskKey = result.riskStatus as keyof typeof RISK_BANNER;
  const banner = RISK_BANNER[riskKey] ?? RISK_BANNER.medium;
  const decision = decisionCopy(result);
  const hasUncertainty = result.evidenceGaps.length > 0 || result.riskStatus === "blocked_insufficient_evidence";

  return (
    <section className="hf-pm-panel">
      <div className="hf-pm-report-head">
        <div>
          <span className="hf-section-kicker">Pre-mortem safety decision</span>
          <h3>{decision.title}</h3>
          <p>{decision.detail}</p>
        </div>
        <div className={`hf-pm-decision ${decision.blocking ? "blocked" : "clear"}`}>
          {decision.blocking ? <ShieldX size={18} /> : <CheckCircle2 size={18} />}
          <span>{decision.badge}</span>
        </div>
      </div>

      <div
        className="hf-pm-banner"
        style={{ background: banner.bg, borderColor: banner.color }}
      >
        <AlertTriangle size={16} style={{ color: banner.color, flexShrink: 0 }} />
        <span style={{ color: banner.color, fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.03em" }}>
          {banner.label}: {formatRiskStatus(result.riskStatus)}
        </span>
        {result.requiresHumanApproval && (
          <span className="hf-pm-approval-required">
            <ShieldX size={12} /> Human approval required
          </span>
        )}
      </div>

      <div className="hf-pm-decision-strip">
        <div className="hf-pm-stat">
          <span className="hf-pm-stat-label">Gate decision</span>
          <strong>{decision.blocking ? "Block automation" : "Allow standard review"}</strong>
          <p>{decision.action}</p>
        </div>
        <div className="hf-pm-stat">
          <span className="hf-pm-stat-label">Evidence status</span>
          <strong>{result.findings.length} cited risk{result.findings.length === 1 ? "" : "s"}</strong>
          <p>{hasUncertainty ? `${result.evidenceGaps.length} uncertainty signal${result.evidenceGaps.length === 1 ? "" : "s"} to resolve.` : "No reported evidence gaps."}</p>
        </div>
        <div className="hf-pm-stat">
          <span className="hf-pm-stat-label">Audit record</span>
          <strong>{result.auditRecordId.slice(0, 8)}</strong>
          <p>Decision evidence is recorded for review traceability.</p>
        </div>
      </div>

      <div className="hf-pm-report-guidance">
        <div>
          <strong>Safety rule</strong>
          <span>
            HIGH and CRITICAL findings block auto-approval. Insufficient evidence blocks a false all-clear.
          </span>
        </div>
        <div>
          <strong>Evidence rule</strong>
          <span>Each surfaced finding must cite a file, line, dependency chain, and preventive check from twin context.</span>
        </div>
      </div>

      {result.findings.length > 0 && (
        <div className="hf-pm-findings">
          {result.findings.map((finding) => {
            const sev = finding.severity as keyof typeof SEVERITY_CONFIG;
            const cfg = SEVERITY_CONFIG[sev] ?? SEVERITY_CONFIG.medium;
            const SevIcon = cfg.icon;
            return (
              <div
                key={finding.id}
                className="hf-pm-finding"
                style={{ borderColor: cfg.border, background: cfg.bg }}
              >
                <div className="hf-pm-finding-header">
                  <SevIcon size={15} style={{ color: cfg.color, flexShrink: 0 }} />
                  <div className="hf-pm-finding-title">
                    <span>{finding.title}</span>
                    <small>{finding.filePath}:{finding.line}</small>
                  </div>
                  <span className="hf-pm-severity-badge" style={{ color: cfg.color, borderColor: cfg.border }}>
                    {cfg.label}
                  </span>
                </div>

                <div className="hf-pm-finding-grid">
                  <div className="hf-pm-cell hf-pm-cell-wide hf-pm-consequence">
                    <span className="hf-pm-cell-label">Decision impact</span>
                    <p className="hf-pm-cell-value">{finding.consequence}</p>
                  </div>
                  <div className="hf-pm-cell">
                    <span className="hf-pm-cell-label">
                      <FileCode2 size={11} /> File and line evidence
                    </span>
                    <p className="hf-pm-cell-value hf-pm-mono">
                      {finding.filePath}:{finding.line}
                    </p>
                    {finding.ownerContext && (
                      <p className="hf-pm-cell-meta">Owner: {finding.ownerContext}</p>
                    )}
                  </div>
                  <div className="hf-pm-cell">
                    <span className="hf-pm-cell-label">
                      <GitBranch size={11} /> Dependency chain
                    </span>
                    <div className="hf-pm-chain">
                      {finding.dependencyChain.length > 0
                        ? finding.dependencyChain.map((node, i) => (
                            <span key={i} className="hf-pm-chain-item">
                              {i > 0 && <ChevronRight size={10} className="hf-pm-chain-arrow" />}
                              <span className="hf-pm-chain-node">{node}</span>
                            </span>
                          ))
                        : <span className="hf-pm-cell-meta">No dependency chain returned.</span>}
                    </div>
                  </div>
                  <div className="hf-pm-cell hf-pm-cell-wide">
                    <span className="hf-pm-cell-label">Preventive check</span>
                    <p className="hf-pm-cell-value hf-pm-check">{finding.preventiveCheck}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {result.evidenceGaps.length > 0 && (
        <div className="hf-pm-gaps">
          <span className="hf-pm-gaps-label">Evidence gaps and uncertainty</span>
          {result.evidenceGaps.map((gap, i) => (
            <div key={i} className="hf-pm-gap">
              <AlertTriangle size={12} />
              <span>{gap}</span>
            </div>
          ))}
        </div>
      )}

      {result.findings.length === 0 && result.evidenceGaps.length === 0 && (
        <div className="hf-pm-empty">
          <ShieldCheck size={24} style={{ color: "#52c41a" }} />
          <span>No blocking findings or evidence gaps were returned. Standard review still applies.</span>
        </div>
      )}
    </section>
  );
}
