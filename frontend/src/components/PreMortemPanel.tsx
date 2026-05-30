import { AlertTriangle, CheckCircle2, ChevronRight, FileCode2, GitBranch, ShieldAlert, ShieldCheck, ShieldX, TriangleAlert } from "lucide-react";
import type { PreMortemResult } from "../services/types";

const SEVERITY_CONFIG = {
  critical: { color: "#ff4d4f", bg: "rgba(255,77,79,0.08)", border: "rgba(255,77,79,0.32)", label: "Critical", icon: ShieldX },
  high:     { color: "#fa8c16", bg: "rgba(250,140,22,0.08)", border: "rgba(250,140,22,0.32)", label: "High", icon: ShieldAlert },
  medium:   { color: "#fadb14", bg: "rgba(250,219,20,0.07)", border: "rgba(250,219,20,0.28)", label: "Medium", icon: TriangleAlert },
  low:      { color: "#52c41a", bg: "rgba(82,196,26,0.07)",  border: "rgba(82,196,26,0.25)",  label: "Low", icon: ShieldCheck },
} as const;

const RISK_BANNER = {
  critical:                    { color: "#ff4d4f", bg: "rgba(255,77,79,0.1)", label: "CRITICAL — Immediate escalation required" },
  high:                        { color: "#fa8c16", bg: "rgba(250,140,22,0.1)", label: "HIGH RISK — Human approval required before proceeding" },
  medium:                      { color: "#fadb14", bg: "rgba(250,219,20,0.09)", label: "MEDIUM RISK — Review findings before proceeding" },
  low:                         { color: "#52c41a", bg: "rgba(82,196,26,0.09)", label: "LOW RISK — Proceed with standard checks" },
  blocked_insufficient_evidence:{ color: "#8c8c8c", bg: "rgba(140,140,140,0.09)", label: "INSUFFICIENT EVIDENCE — Expand twin coverage first" },
} as const;

export function PreMortemPanel({ result }: { result?: PreMortemResult }) {
  if (!result) return null;

  const riskKey = result.riskStatus as keyof typeof RISK_BANNER;
  const banner = RISK_BANNER[riskKey] ?? RISK_BANNER.medium;
  const topFinding = result.findings[0];
  const blocking = result.requiresHumanApproval || result.riskStatus === "critical" || result.riskStatus === "high" || result.riskStatus === "blocked_insufficient_evidence";

  return (
    <section className="hf-pm-panel">
      <div className="hf-pm-report-head">
        <div>
          <span className="hf-section-kicker">Pre-mortem report</span>
          <h3>{blocking ? "Do not auto-approve this change" : "No blocking risk found in current evidence"}</h3>
          <p>
            {topFinding
              ? `${topFinding.title}. ${topFinding.consequence}`
              : result.evidenceGaps[0] ?? "HelixFactory found no evidence-backed blocking finding for this target. Standard review still applies."}
          </p>
        </div>
        <div className={`hf-pm-decision ${blocking ? "blocked" : "clear"}`}>
          {blocking ? <ShieldX size={18} /> : <CheckCircle2 size={18} />}
          <span>{blocking ? "Human gate required" : "Standard review"}</span>
        </div>
      </div>

      {/* Risk banner */}
      <div
        className="hf-pm-banner"
        style={{ background: banner.bg, borderColor: banner.color }}
      >
        <AlertTriangle size={16} style={{ color: banner.color, flexShrink: 0 }} />
        <span style={{ color: banner.color, fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.03em" }}>
          {banner.label}
        </span>
        {result.requiresHumanApproval && (
          <span className="hf-pm-approval-required">
            <ShieldX size={12} /> Human approval required
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="hf-pm-stats">
        <div className="hf-pm-stat">
          <span className="hf-pm-stat-num" style={{ color: result.findings.length > 0 ? "#fa8c16" : "#52c41a" }}>
            {result.findings.length}
          </span>
          <span className="hf-pm-stat-label">Finding{result.findings.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="hf-pm-stat-divider" />
        <div className="hf-pm-stat">
          <span className="hf-pm-stat-num" style={{ color: result.evidenceGaps.length > 0 ? "#fadb14" : "#52c41a" }}>
            {result.evidenceGaps.length}
          </span>
          <span className="hf-pm-stat-label">Evidence gap{result.evidenceGaps.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="hf-pm-stat-divider" />
        <div className="hf-pm-stat">
          <span className="hf-pm-stat-num">{result.auditRecordId.slice(0, 8)}</span>
          <span className="hf-pm-stat-label">Audit ID</span>
        </div>
      </div>

      <div className="hf-pm-report-guidance">
        <div>
          <strong>What to do next</strong>
          <span>
            {blocking
              ? "Review the evidence chain, run the preventive checks, and require a human approval before any AI execution."
              : "Proceed with normal engineering review, keeping the listed evidence gaps in mind."}
          </span>
        </div>
        <div>
          <strong>Trust rule</strong>
          <span>Findings without twin evidence are suppressed. This report only shows risks backed by code structure.</span>
        </div>
      </div>

      {/* Findings */}
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
                {/* Finding header */}
                <div className="hf-pm-finding-header">
                  <SevIcon size={15} style={{ color: cfg.color, flexShrink: 0 }} />
                  <span className="hf-pm-finding-title">{finding.title}</span>
                  <span className="hf-pm-severity-badge" style={{ color: cfg.color, borderColor: cfg.border }}>
                    {cfg.label}
                  </span>
                </div>

                {/* 4-cell grid: consequence, location, chain, check */}
                <div className="hf-pm-finding-grid">
                  <div className="hf-pm-cell">
                    <span className="hf-pm-cell-label">Consequence</span>
                    <p className="hf-pm-cell-value">{finding.consequence}</p>
                  </div>
                  <div className="hf-pm-cell">
                    <span className="hf-pm-cell-label">
                      <FileCode2 size={11} /> Location
                    </span>
                    <p className="hf-pm-cell-value hf-pm-mono">
                      {finding.filePath}{finding.line ? `:${finding.line}` : ""}
                    </p>
                    {finding.ownerContext && (
                      <p className="hf-pm-cell-meta">Owner: {finding.ownerContext}</p>
                    )}
                  </div>
                  <div className="hf-pm-cell hf-pm-cell-wide">
                    <span className="hf-pm-cell-label">
                      <GitBranch size={11} /> Dependency chain
                    </span>
                    <div className="hf-pm-chain">
                      {finding.dependencyChain.map((node, i) => (
                        <span key={i} className="hf-pm-chain-item">
                          {i > 0 && <ChevronRight size={10} className="hf-pm-chain-arrow" />}
                          <span className="hf-pm-chain-node">{node}</span>
                        </span>
                      ))}
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

      {/* Evidence gaps */}
      {result.evidenceGaps.length > 0 && (
        <div className="hf-pm-gaps">
          <span className="hf-pm-gaps-label">Evidence gaps</span>
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
          <span>No blocking findings. Standard review applies.</span>
        </div>
      )}
    </section>
  );
}
