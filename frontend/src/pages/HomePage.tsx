import { AlertTriangle, ChevronRight, DatabaseZap, FileSearch, GitBranch, Network, ShieldCheck } from "lucide-react";
import type { AIStatus, Repository } from "../services/types";

type HomeTab = "ingest" | "graph" | "impact" | "premortem" | "execution" | "qa" | "review" | "security" | "audit" | "history" | "memory" | "skills";

interface HomePageProps {
  repository?: Repository;
  aiStatus?: AIStatus;
  onNavigate: (tab: HomeTab) => void;
}

const CAPABILITIES = [
  {
    icon: AlertTriangle,
    color: "blue",
    title: "Assess change safety",
    desc: "Describe a planned AI or human change and get risk, blast radius, gate decision, and evidence.",
    tab: "impact" as HomeTab
  },
  {
    icon: Network,
    color: "teal",
    title: "Understand the system",
    desc: "Ask questions or start from entry points. The graph stays contextual instead of dumping the whole repo.",
    tab: "graph" as HomeTab
  },
  {
    icon: FileSearch,
    color: "purple",
    title: "Prove the decision",
    desc: "Keep a chronological audit trail for the risk decision, impact evidence, and human gate.",
    tab: "audit" as HomeTab
  }
];

const STEPS = [
  { n: "01", label: "Understand", detail: "Ingest the repository and build the evidence-backed code twin." },
  { n: "02", label: "Assess", detail: "Describe the planned change; HelixFactory predicts risk and blast radius." },
  { n: "03", label: "Gate", detail: "HIGH and CRITICAL risk blocks automation until a human reviews the evidence." },
  { n: "04", label: "Prove", detail: "Every decision becomes a git-native evidence trail for audit and review." }
];

export function HomePage({ repository, aiStatus, onNavigate }: HomePageProps) {
  const hasRepo = Boolean(repository);

  return (
    <section className="hf-home">
      {/* Hero command */}
      <div className="hf-home-command">
        <div className="hf-home-title">
          <span className="hf-section-kicker">AI change safety platform</span>
          <h2 aria-label="HelixFactory Control Plane">
            AI can write code fast.<br />
            HelixFactory proves<br />
            <span className="hf-home-hero-accent">what it could break.</span>
          </h2>
          <p>
            Before an AI agent or developer changes production code, HelixFactory builds a living
            code twin, predicts risk with evidence, shows blast radius, and records the decision trail.
          </p>
          <div className="hf-home-proofline" aria-label="Workspace status">
            <span>
              {hasRepo
                ? `${(repository!.nodeCount ?? 0).toLocaleString()} evidence nodes · ${(repository!.edgeCount ?? 0).toLocaleString()} relationships`
                : "Start by ingesting a repository"}
            </span>
            <span>{aiStatus?.enabled ? `${aiStatus.provider} AI active` : "Local analysis mode"}</span>
            <span>HIGH + CRITICAL risk blocks automation</span>
          </div>
        </div>
        <div className="hf-action-row hf-home-actions">
          <button
            className="tool-button tool-button-primary"
            type="button"
            onClick={() => onNavigate(hasRepo ? "impact" : "ingest")}
          >
            {hasRepo ? <ShieldCheck size={16} /> : <GitBranch size={16} />}
            {hasRepo ? "Analyze a risky change" : "Build the code twin"}
          </button>
          {hasRepo && (
            <button className="tool-button" type="button" onClick={() => onNavigate("graph")}>
              <Network size={16} /> Explore twin
            </button>
          )}
          <button className="tool-button" type="button" onClick={() => onNavigate("audit")}>
            <FileSearch size={16} /> View audit proof
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="hf-home-console">
        <div className="hf-command-card">
          <div className="hf-panel-header">
            <DatabaseZap size={15} style={{ color: "var(--hf-blue)" }} />
              <h3 className="hf-panel-title" style={{ fontSize: "0.9rem" }}>The safety loop</h3>
          </div>
          <div className="hf-step-strip">
            {STEPS.map(step => (
              <article key={step.n}>
                <span>{step.n}</span>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </div>

        {hasRepo ? (
          <div className="hf-command-card hf-home-readiness">
            <div className="hf-panel-header">
              <ShieldCheck size={15} style={{ color: "var(--hf-green)" }} />
              <h3 className="hf-panel-title" style={{ fontSize: "0.9rem" }}>Ready for analysis</h3>
            </div>
            <dl>
              <div>
                <dt>Repository</dt>
                <dd title={repository!.url}>{repository!.url.replace("https://github.com/", "")}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{repository!.ingestionStatus}</dd>
              </div>
              <div>
                <dt>Twin size</dt>
                <dd>{(repository!.nodeCount ?? 0).toLocaleString()} nodes · {(repository!.edgeCount ?? 0).toLocaleString()} edges</dd>
              </div>
              {aiStatus?.enabled && (
                <div>
                  <dt>AI provider</dt>
                  <dd>{aiStatus.provider}{aiStatus.model ? ` · ${aiStatus.model}` : ""}</dd>
                </div>
              )}
            </dl>
            <button
              className="tool-button tool-button-primary"
              type="button"
              onClick={() => onNavigate("impact")}
              style={{ marginTop: "0.25rem" }}
            >
              <AlertTriangle size={15} /> Analyze a change <ChevronRight size={14} />
            </button>
            <button
              className="tool-button"
              type="button"
              onClick={() => onNavigate("graph")}
            >
              <Network size={15} /> Open Twin
            </button>
          </div>
        ) : (
          <div className="hf-command-card hf-home-readiness">
            <div className="hf-panel-header">
              <GitBranch size={15} style={{ color: "var(--hf-blue)" }} />
              <h3 className="hf-panel-title" style={{ fontSize: "0.9rem" }}>Get started</h3>
            </div>
            <p style={{ color: "var(--hf-muted)", fontSize: "0.88rem", margin: 0, lineHeight: 1.55 }}>
              Ingest a public GitHub repository to build the evidence layer. The product becomes useful
              when the twin can cite real files, symbols, and dependency paths.
            </p>
            <button
              className="tool-button tool-button-primary"
              type="button"
              onClick={() => onNavigate("ingest")}
              style={{ marginTop: "0.5rem" }}
            >
              <GitBranch size={15} /> Ingest a repository <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Decision modules */}
      <div className="hf-capability-map">
        <div className="hf-section-heading">
          <span className="hf-section-kicker">The buyer reason</span>
          <h3>One product decision: should this change be allowed?</h3>
          <p>Everything visible here supports the same enterprise workflow: understand the code, predict what breaks, prove the gate.</p>
        </div>
        <div className="hf-capability-grid">
          {CAPABILITIES.map(cap => (
            <button
              key={cap.title}
              type="button"
              className={`hf-capability-card ${cap.color}`}
              onClick={() => onNavigate(cap.tab)}
            >
              <span><cap.icon size={15} /></span>
              <strong>{cap.title}</strong>
              <p>{cap.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
