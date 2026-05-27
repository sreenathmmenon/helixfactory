import { useEffect, useState } from "react";
import { Activity, Brain, Clock3, DatabaseZap, FileSearch, GitBranch, Home, LockKeyhole, Network, ShieldCheck, Sparkles, Split } from "lucide-react";
import { PreMortemPanel } from "./components/PreMortemPanel";
import { StatusStates } from "./components/StatusStates";
import { api } from "./services/api";
import type { AIStatus, PreMortemResult, Repository } from "./services/types";
import { HomePage } from "./pages/HomePage";
import { IngestionPage } from "./pages/IngestionPage";
import { BlastRadiusPage } from "./pages/BlastRadiusPage";
import { ArchitectureQAPage } from "./pages/ArchitectureQAPage";
import { AuditEvidencePage } from "./pages/AuditEvidencePage";
import { ExecutionPage } from "./pages/ExecutionPage";
import { SkillRefinementPage } from "./pages/SkillRefinementPage";
import { SecurityPage } from "./pages/SecurityPage";
import { ReviewPage } from "./pages/ReviewPage";
import { MemoryPage } from "./pages/MemoryPage";
import { HistoryPage } from "./pages/HistoryPage";

type Tab = "home" | "ingest" | "graph" | "premortem" | "execution" | "qa" | "review" | "security" | "audit" | "history" | "memory" | "skills";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [repository, setRepository] = useState<Repository>();
  const [aiStatus, setAiStatus] = useState<AIStatus>();
  const [target, setTarget] = useState("");
  const [premortem, setPremortem] = useState<PreMortemResult>();
  const [premortemLoading, setPremortemLoading] = useState(false);
  const [premortemError, setPremortemError] = useState<string>();
  useEffect(() => {
    let active = true;
    api.aiStatus()
      .then((status) => { if (active) setAiStatus(status); })
      .catch(() => { if (active) setAiStatus({ enabled: false, provider: "unreachable", reason: "Backend AI status is unavailable" }); });
    return () => { active = false; };
  }, []);
  async function runPremortem() {
    if (!repository) return;
    setPremortemLoading(true);
    setPremortemError(undefined);
    try {
      setPremortem(await api.runPremortem(repository.id, `Modify ${target}`, [target || repository.id]));
    } catch (err) {
      setPremortem(undefined);
      setPremortemError(err instanceof Error ? err.message : "Pre-mortem failed");
    } finally {
      setPremortemLoading(false);
    }
  }
  const tabs: Array<[Tab, JSX.Element, string, string]> = [
    ["home", <Home size={16} />, "Home", "Enterprise AI SDLC command center"],
    ["ingest", <GitBranch size={16} />, "Ingest", "Build the repository twin"],
    ["graph", <Network size={16} />, "Twin", "Explore code structure"],
    ["premortem", <ShieldCheck size={16} />, "Pre-mortem", "Block risky changes early"],
    ["execution", <Activity size={16} />, "Execution", "Govern agent work"],
    ["qa", <Brain size={16} />, "Q&A", "Ask with cited evidence"],
    ["review", <Split size={16} />, "Review", "Run specialist gates"],
    ["security", <LockKeyhole size={16} />, "Security", "Check sensitive risk"],
    ["audit", <FileSearch size={16} />, "Audit", "Inspect proof chain"],
    ["history", <Clock3 size={16} />, "History", "Reconstruct architecture state"],
    ["memory", <Brain size={16} />, "Memory", "Reuse organizational knowledge"],
    ["skills", <Sparkles size={16} />, "Skills", "Refine operating memory"]
  ];
  const primaryTabs: Tab[] = ["home", "ingest", "graph", "premortem", "qa"];
  const operationTabs: Tab[] = ["execution", "review", "security", "audit", "history", "memory", "skills"];
  const activeTab = tabs.find(([key]) => key === tab) ?? tabs[0];
  const tabMap = new Map(tabs.map((item) => [item[0], item]));

  return (
    <main className="hf-app-shell">
      <header className="hf-topbar">
        <div className="hf-topbar-inner">
          <div className="hf-brand">
            <div className="hf-brand-mark"><DatabaseZap size={18} /></div>
            <div>
              <h1>Helix<span>Factory</span></h1>
              <p>Governed repository intelligence</p>
            </div>
          </div>
          <div className="hf-top-status">
            <span>{repository ? "Twin active" : "No repository"}</span>
            <strong>{aiStatus?.enabled ? `${aiStatus.provider} AI` : "Local mode"}</strong>
          </div>
        </div>
      </header>

      <div className={`hf-layout ${tab === "home" ? "hf-layout-home" : ""}`}>
        <aside className="hf-side-nav">
          <nav aria-label="Primary">
            {primaryTabs.map((tabKey) => tabMap.get(tabKey)!).map(([key, icon, label, description]) => (
              <button aria-label={`${label} ${description}`} className={`hf-nav-item ${tab === key ? "active" : ""}`} key={key} onClick={() => setTab(key)} title={label} type="button">
                <span>{icon}</span>
              </button>
            ))}
            <details className="hf-nav-group" open>
              <summary title="Operations">Ops</summary>
              {operationTabs.map((tabKey) => tabMap.get(tabKey)!).map(([key, icon, label, description]) => (
                <button aria-label={`${label} ${description}`} className={`hf-nav-item hf-nav-item-secondary ${tab === key ? "active" : ""}`} key={key} onClick={() => setTab(key)} title={label} type="button">
                  <span>{icon}</span>
                </button>
              ))}
            </details>
          </nav>
        </aside>

        <div className={`hf-main-area hf-main-${tab}`}>
          <div className="hf-workbench">
            {tab !== "home" && tab !== "graph" && (
              <div className="hf-page-chrome">
                <h2>{activeTab[2]}</h2>
                <span>{activeTab[3]}</span>
              </div>
            )}
            {repository && tab !== "graph" && (
              <aside className="hf-active-repo">
                <div>
                  <span>Active repository</span>
                  <strong>{repository.url}</strong>
                </div>
                <span className="hf-pill">{repository.ingestionStatus}</span>
              </aside>
            )}
            {tab === "home" && <HomePage repository={repository} aiStatus={aiStatus} onNavigate={setTab} />}
            {tab === "ingest" && <IngestionPage onRepository={(repo) => { setRepository(repo); setTab("graph"); }} />}
            {tab === "graph" && <BlastRadiusPage repository={repository} preMortem={premortem} />}
            {tab === "premortem" && (
              <section className="hf-page">
                <div className={`hf-page-grid ${premortem ? "" : "hf-page-grid-single"}`}>
                  <div className="hf-panel hf-command-panel">
                    <span className="hf-section-kicker">Risk target</span>
                    <h3>Run a pre-mortem before implementation</h3>
                    <label className="hf-field">
                      <span>Change target</span>
                      <input className="hf-input" aria-label="Pre-mortem target" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="e.g. auth middleware, router startup, ingestion parser" />
                    </label>
                    <button className="tool-button tool-button-primary" type="button" disabled={!repository || premortemLoading} onClick={runPremortem}>Run pre-mortem</button>
                    {!repository && <StatusStates status="empty" message="Ingest a repository before running a pre-mortem." />}
                    {premortemLoading && <StatusStates status="loading" message="Resolving target evidence and dependency chain" />}
                    {premortemError && <StatusStates status="failed" message={premortemError} />}
                  </div>
                  {premortem && <PreMortemPanel result={premortem} />}
                </div>
              </section>
            )}
            {tab === "execution" && <ExecutionPage repository={repository} />}
            {tab === "qa" && <ArchitectureQAPage repository={repository} />}
            {tab === "review" && <ReviewPage repository={repository} />}
            {tab === "security" && <SecurityPage repository={repository} />}
            {tab === "audit" && <AuditEvidencePage repository={repository} />}
            {tab === "history" && <HistoryPage repository={repository} />}
            {tab === "memory" && <MemoryPage repository={repository} />}
            {tab === "skills" && <SkillRefinementPage />}
          </div>
        </div>
      </div>
    </main>
  );
}
