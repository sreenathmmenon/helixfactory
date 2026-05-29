import { Activity, Brain, ChevronRight, DatabaseZap, GitBranch, Network, ShieldCheck, Sparkles } from "lucide-react";
import type { AIStatus, Repository } from "../services/types";

type HomeTab = "ingest" | "graph" | "premortem" | "execution" | "qa" | "review" | "security" | "audit" | "history" | "memory" | "skills";

interface HomePageProps {
  repository?: Repository;
  aiStatus?: AIStatus;
  onNavigate: (tab: HomeTab) => void;
}

const CAPABILITIES = [
  {
    icon: Network,
    color: "teal",
    title: "Living Code Twin",
    desc: "Parse every function, class, and import into a graph. Every feature is grounded in real code structure — no hallucinations.",
    tab: "graph" as HomeTab
  },
  {
    icon: ShieldCheck,
    color: "amber",
    title: "Evidence-backed Pre-mortem",
    desc: "Predict failure modes before a change is made. Every finding cites file, line, dependency chain, and owner.",
    tab: "premortem" as HomeTab
  },
  {
    icon: Brain,
    color: "blue",
    title: "Architecture Q&A",
    desc: "Ask plain-English questions. Get answers cited to the twin — not generated from thin air.",
    tab: "qa" as HomeTab
  },
  {
    icon: Activity,
    color: "purple",
    title: "Governed Execution",
    desc: "Run AI agents within approval gates. HIGH and CRITICAL changes require human sign-off before execution.",
    tab: "execution" as HomeTab
  },
  {
    icon: GitBranch,
    color: "green",
    title: "Git-native Audit Trail",
    desc: "Every platform action is a structured git commit. Portable, inspectable, compliance-ready.",
    tab: "audit" as HomeTab
  },
  {
    icon: Sparkles,
    color: "red",
    title: "Blast Radius",
    desc: "Map direct and transitive impact of any proposed change before a single line is written.",
    tab: "graph" as HomeTab
  }
];

const STEPS = [
  { n: "01", label: "Ingest",     detail: "Clone a GitHub repo and build the code twin in 30–90 seconds." },
  { n: "02", label: "Explore",    detail: "Navigate the graph by asking questions or clicking through nodes." },
  { n: "03", label: "Pre-mortem", detail: "Before any change, predict failures with evidence-backed risk analysis." },
  { n: "04", label: "Execute",    detail: "Run AI-assisted changes inside approval gates with a full audit trail." }
];

export function HomePage({ repository, aiStatus, onNavigate }: HomePageProps) {
  const hasRepo = Boolean(repository);

  return (
    <section className="hf-home">
      {/* Hero command */}
      <div className="hf-home-command">
        <div className="hf-home-title">
          <span className="hf-section-kicker">Enterprise AI SDLC Control Plane</span>
          <h2 aria-label="HelixFactory Control Plane">
            Before AI changes your code,<br />
            HelixFactory makes it<br />
            <span className="hf-home-hero-accent">understand your system.</span>
          </h2>
          <p>
            A living code digital twin that grounds every AI action in real architecture evidence —
            with risk gates, blast radius, and a git-native audit trail built in.
          </p>
          <div className="hf-home-proofline" aria-label="Workspace status">
            <span>
              {hasRepo
                ? `${(repository!.nodeCount ?? 0).toLocaleString()} twin nodes · ${(repository!.edgeCount ?? 0).toLocaleString()} edges`
                : "No repository ingested"}
            </span>
            <span>{aiStatus?.enabled ? `${aiStatus.provider} AI active` : "Local analysis mode"}</span>
            <span>Human gates for HIGH + CRITICAL risk</span>
          </div>
        </div>
        <div className="hf-action-row hf-home-actions">
          <button
            className="tool-button tool-button-primary"
            type="button"
            onClick={() => onNavigate(hasRepo ? "premortem" : "ingest")}
          >
            {hasRepo ? <ShieldCheck size={16} /> : <GitBranch size={16} />}
            {hasRepo ? "Run pre-mortem" : "Ingest a repository"}
          </button>
          {hasRepo && (
            <button className="tool-button" type="button" onClick={() => onNavigate("graph")}>
              <Network size={16} /> Explore twin
            </button>
          )}
          <button className="tool-button" type="button" onClick={() => onNavigate("qa")}>
            <Brain size={16} /> Ask architecture
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="hf-home-console">
        <div className="hf-command-card">
          <div className="hf-panel-header">
            <DatabaseZap size={15} style={{ color: "var(--hf-blue)" }} />
            <h3 className="hf-panel-title" style={{ fontSize: "0.9rem" }}>How it works</h3>
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
              <h3 className="hf-panel-title" style={{ fontSize: "0.9rem" }}>Active workspace</h3>
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
              onClick={() => onNavigate("graph")}
              style={{ marginTop: "0.25rem" }}
            >
              <Network size={15} /> Open Twin <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <div className="hf-command-card hf-home-readiness">
            <div className="hf-panel-header">
              <GitBranch size={15} style={{ color: "var(--hf-blue)" }} />
              <h3 className="hf-panel-title" style={{ fontSize: "0.9rem" }}>Get started</h3>
            </div>
            <p style={{ color: "var(--hf-muted)", fontSize: "0.88rem", margin: 0, lineHeight: 1.55 }}>
              Ingest any public GitHub repository to build the twin. Parsing typically takes 30–90 seconds.
              All features unlock once ingestion completes.
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

      {/* Capabilities */}
      <div className="hf-capability-map">
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
