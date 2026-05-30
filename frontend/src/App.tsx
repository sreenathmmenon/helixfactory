import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Brain, ClipboardCheck, Clock3, DatabaseZap, FileSearch, GitBranch, Home, LockKeyhole, Network, ShieldCheck, Sparkles } from "lucide-react";
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
import { SafetyReviewPage } from "./pages/SafetyReviewPage";
import { MemoryPage } from "./pages/MemoryPage";
import { HistoryPage } from "./pages/HistoryPage";

type Tab = "home" | "ingest" | "graph" | "impact" | "premortem" | "execution" | "qa" | "review" | "security" | "audit" | "history" | "memory" | "skills";

const REPO_KEY = "helixfactory.last-repository";

function saveRepo(repo: Repository) {
  try { localStorage.setItem(REPO_KEY, JSON.stringify(repo)); } catch { /* ignore */ }
}
function loadRepo(): Repository | undefined {
  try {
    const raw = localStorage.getItem(REPO_KEY);
    return raw ? JSON.parse(raw) as Repository : undefined;
  } catch { return undefined; }
}

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [repository, setRepository] = useState<Repository | undefined>(loadRepo);
  const [aiStatus, setAiStatus] = useState<AIStatus>();
  const [target, setTarget] = useState("");
  const [premortem, setPremortem] = useState<PreMortemResult>();
  const [premortemLoading, setPremortemLoading] = useState(false);
  const [premortemError, setPremortemError] = useState<string>();

  // Verify the cached repo still exists on the backend; clear if not
  useEffect(() => {
    const cached = loadRepo();
    if (!cached) return;
    let active = true;
    api.getRepository(cached.id)
      .then(repo => { if (active) { setRepository(repo); saveRepo(repo); } })
      .catch(() => {
        if (active) {
          setRepository(undefined);
          try { localStorage.removeItem(REPO_KEY); } catch { /* ignore */ }
        }
      });
    return () => { active = false; };
  }, []);

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
    ["home", <Home size={16} />, "Home", "What HelixFactory does and where to start"],
    ["ingest", <GitBranch size={16} />, "Ingest", "Build the evidence-backed repository twin"],
    ["graph", <Network size={16} />, "Twin", "Understand architecture and inspect impact"],
    ["impact", <AlertTriangle size={16} />, "Impact", "Show what a planned change can break"],
    ["premortem", <ShieldCheck size={16} />, "Pre-mortem", "Predict what can break before code changes"],
    ["audit", <FileSearch size={16} />, "Audit", "Prove every decision with a chronological evidence trail"],
    ["qa", <Brain size={16} />, "Q&A", "Ask the twin with cited evidence"],
    ["execution", <Activity size={16} />, "Execution", "Govern agent work through approval gates"],
    ["review", <ClipboardCheck size={16} />, "Assess Change", "Run the change safety decision report"],
    ["security", <LockKeyhole size={16} />, "Security", "Check sensitive operational risk"],
    ["history", <Clock3 size={16} />, "History", "Reconstruct architecture state"],
    ["memory", <Brain size={16} />, "Memory", "Reuse organizational knowledge"],
    ["skills", <Sparkles size={16} />, "Skills", "Refine operating memory"]
  ];
  const primaryTabs: Tab[] = ["home", "ingest", "review", "impact", "graph", "audit"];
  const operationTabs: Tab[] = ["premortem", "qa", "execution", "security", "history", "memory", "skills"];
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
            {repository ? (
              <>
                <span className="hf-top-repo-dot" />
                <span title={repository.url}>{repository.url.split("/").slice(-2).join("/")}</span>
                <span className="hf-top-divider" />
              </>
            ) : (
              <span className="hf-top-no-repo">No twin active</span>
            )}
            <strong>{aiStatus?.enabled ? `${aiStatus.provider} AI` : "Local mode"}</strong>
          </div>
        </div>
      </header>

      <div className={`hf-layout ${tab === "home" ? "hf-layout-home" : ""}`}>
        <aside className="hf-side-nav">
          <nav aria-label="Primary">
            {primaryTabs.map((tabKey) => tabMap.get(tabKey)!).map(([key, icon, label, description]) => (
              <button aria-label={`${label} ${description}`} className={`hf-nav-item ${tab === key ? "active" : ""}`} key={key} onClick={() => setTab(key)} title={description} type="button">
                <span>{icon}</span>
                <strong>{label}</strong>
              </button>
            ))}
            <details className="hf-nav-group">
              <summary title="Advanced workflows">More</summary>
              {operationTabs.map((tabKey) => tabMap.get(tabKey)!).map(([key, icon, label, description]) => (
                <button aria-label={`${label} ${description}`} className={`hf-nav-item hf-nav-item-secondary ${tab === key ? "active" : ""}`} key={key} onClick={() => setTab(key)} title={description} type="button">
                  <span>{icon}</span>
                  <strong>{label}</strong>
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
            {repository && (tab === "ingest" || tab === "premortem") && (
              <aside className="hf-active-repo">
                <div>
                  <span>Active repository</span>
                  <strong>{repository.url}</strong>
                </div>
                <span className="hf-pill">{repository.ingestionStatus}</span>
              </aside>
            )}
            {tab === "home" && <HomePage repository={repository} aiStatus={aiStatus} onNavigate={setTab} />}
            {tab === "ingest" && <IngestionPage onRepository={(repo) => { setRepository(repo); saveRepo(repo); setTab("graph"); }} onNavigate={(t) => setTab(t as Tab)} />}
            {tab === "graph" && <BlastRadiusPage repository={repository} preMortem={premortem} intent="twin" />}
            {tab === "impact" && <BlastRadiusPage repository={repository} preMortem={premortem} intent="impact" />}
            {tab === "premortem" && (
              <section className="hf-page hf-premortem-page hf-ops-page">
                <div className="hf-premortem-layout">
                  <div className="hf-panel hf-command-panel">
                    <span className="hf-section-kicker">Evidence-backed risk analysis</span>
                    <h3>Pre-mortem: should this change be allowed?</h3>
                    <p className="hf-muted" style={{ fontSize: "0.86rem" }}>
                      Enter a file, function, class, or module. HelixFactory traces code evidence and returns
                      a safety decision: what can break, why, where, and which checks should run first.
                    </p>
                    <label className="hf-field">
                      <span>Change target</span>
                      <input
                        className="hf-input"
                        aria-label="Pre-mortem target"
                        value={target}
                        onChange={(event) => setTarget(event.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && repository && !premortemLoading) void runPremortem(); }}
                        placeholder="app.py, src/flask/cli.py, helpers.py"
                      />
                    </label>
                    <div className="hf-premortem-examples">
                      <span>Quick examples:</span>
                      {["app.py", "cli.py", "helpers.py"].map(ex => (
                        <button key={ex} type="button" className="hf-ingest-example-btn" onClick={() => setTarget(ex)}>{ex}</button>
                      ))}
                    </div>
                    <button className="tool-button tool-button-primary" type="button" disabled={!repository || premortemLoading || !target.trim()} onClick={runPremortem}>
                      <ShieldCheck size={15} /> Run pre-mortem
                    </button>
                    {!repository && <StatusStates status="empty" message="Ingest a repository to run a pre-mortem." />}
                    {premortemLoading && <StatusStates status="loading" message="Tracing dependency chain and collecting evidence…" />}
                    {premortemError && <StatusStates status="failed" message={premortemError} />}
                    {!premortemLoading && !premortemError && !premortem && repository && (
                      <div className="hf-premortem-hint">
                        <p>Every finding must cite a real file, line number, dependency chain, and preventive check. No evidence means no confident claim.</p>
                      </div>
                    )}
                  </div>
                  <div className="hf-result-fill">
                    {!premortem && !premortemLoading && !premortemError && (
                      <div className="hf-result-placeholder">
                        <ShieldCheck size={32} strokeWidth={1.2} />
                        <strong>No pre-mortem run yet</strong>
                        <p>Enter a change target to produce a safety report: risk decision, evidence, dependency chain, preventive checks, and whether human approval is required.</p>
                      </div>
                    )}
                    {premortem && <PreMortemPanel result={premortem} />}
                  </div>
                </div>
              </section>
            )}
            {tab === "execution" && <ExecutionPage repository={repository} />}
            {tab === "qa" && <ArchitectureQAPage repository={repository} />}
            {tab === "review" && <SafetyReviewPage repository={repository} />}
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
