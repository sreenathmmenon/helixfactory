import { Brain, GitBranch, Network, ShieldCheck } from "lucide-react";
import type { AIStatus, Repository } from "../services/types";

type HomeTab = "ingest" | "graph" | "premortem" | "execution" | "qa" | "review" | "security" | "audit" | "history" | "memory" | "skills";

interface HomePageProps {
  repository?: Repository;
  aiStatus?: AIStatus;
  onNavigate: (tab: HomeTab) => void;
}

export function HomePage({ repository, aiStatus, onNavigate }: HomePageProps) {
  return (
    <section className="hf-home">
      <div className="hf-home-command">
        <div className="hf-home-title">
          <span className="hf-section-kicker">Enterprise AI SDLC control plane</span>
          <h2>HelixFactory Control Plane</h2>
          <p>Build a code twin, forecast change risk, and gate AI work with evidence before production code is touched.</p>
          <div className="hf-home-proofline" aria-label="Workspace status">
            <span>{repository ? `${repository.nodeCount ?? 0} twin nodes` : "No repository ingested"}</span>
            <span>{aiStatus?.enabled ? `${aiStatus.provider} AI enabled` : "Local analysis mode"}</span>
            <span>Human gates for high-risk changes</span>
          </div>
        </div>
        <div className="hf-action-row hf-home-actions">
          <button className="tool-button tool-button-primary" type="button" onClick={() => onNavigate(repository ? "premortem" : "ingest")}>
            {repository ? <ShieldCheck size={16} /> : <GitBranch size={16} />}
            {repository ? "Run pre-mortem" : "Ingest repository"}
          </button>
          <button className="tool-button" type="button" onClick={() => onNavigate("graph")}><Network size={16} /> Explore twin</button>
          <button className="tool-button" type="button" onClick={() => onNavigate("qa")}><Brain size={16} /> Ask architecture</button>
        </div>
      </div>
    </section>
  );
}
