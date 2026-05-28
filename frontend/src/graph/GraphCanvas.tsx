import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Sigma from "sigma";
import {
  Code2,
  FileText,
  GitBranch,
  Link2,
  Maximize2,
  Network,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon
} from "lucide-react";
import { api } from "../services/api";
import type {
  GraphEdge,
  GraphNode,
  GraphPath,
  GraphView,
  NodeContext,
  NodeSource,
  NodeSummary,
  PreMortemResult,
  Repository,
  Risk
} from "../services/types";

type GraphCanvasProps = {
  repository?: Repository;
  preMortem?: PreMortemResult;
};

type TwinMode = "overview" | "entry" | "search" | "neighborhood" | "impact" | "review" | "memory";
type DetailTab = "summary" | "relationships" | "code" | "evidence" | "risk";
type SavedTwinView = {
  id: string;
  name: string;
  graph: GraphView;
  mode: TwinMode;
  centeredLabel: string;
  selectedId?: string;
};

type SigmaNodeAttributes = {
  x: number;
  y: number;
  size: number;
  label: string;
  color: string;
  borderColor: string;
  type: string;
  node: GraphNode;
  subsystem: string;
  severity: Risk;
  hidden?: boolean;
  forceLabel?: boolean;
  zIndex?: number;
};

type SigmaEdgeAttributes = {
  label: string;
  color: string;
  size: number;
  type: string;
  relationship: string;
  edge: GraphEdge;
  hidden?: boolean;
};

type SigmaGraph = Graph<SigmaNodeAttributes, SigmaEdgeAttributes>;

const NODE_STYLE: Record<string, { fill: string; stroke: string; icon: string; label: string }> = {
  entry_point: { fill: "#123321", stroke: "#2fd36b", icon: "●", label: "entry" },
  repository: { fill: "#1a1a2e", stroke: "#8a93a7", icon: "⬢", label: "repo" },
  file: { fill: "#0d2b2c", stroke: "#0D7377", icon: "▣", label: "file" },
  function: { fill: "#0d1f2d", stroke: "#4A90D9", icon: "ƒ", label: "function" },
  class: { fill: "#1a0d2b", stroke: "#9B59B6", icon: "◇", label: "class" }
};

const EDGE_COLOR: Record<string, string> = {
  calls: "#4A90D9",
  imports: "#0D7377",
  extends: "#9B59B6",
  depends_on: "#7a8192"
};

const SEVERITY_COLOR: Partial<Record<Risk, string>> = {
  critical: "#E74C3C",
  high: "#F39C12",
  medium: "#F1C40F",
  blocked_insufficient_evidence: "#E74C3C"
};

const SUBSYSTEM_COLORS = ["#0D7377", "#4A90D9", "#9B59B6", "#27AE60", "#F39C12", "#E67E22", "#6C8AE4", "#16A085"];
const SUGGESTIONS = ["What are the entry points?", "Show architecture overview", "What is most connected?"];
const RELATIONSHIPS = ["calls", "imports", "extends", "depends_on"];
const NODE_TYPES = ["entry_point", "file", "function", "class"];

const DETAIL_TABS: Array<{ tab: DetailTab; icon: LucideIcon; label: string }> = [
  { tab: "summary", icon: FileText, label: "Summary" },
  { tab: "relationships", icon: GitBranch, label: "Links" },
  { tab: "code", icon: Code2, label: "Code" },
  { tab: "evidence", icon: Link2, label: "Evidence" },
  { tab: "risk", icon: ShieldAlert, label: "Risk" }
];

export function GraphCanvas({ repository, preMortem }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const graphologyRef = useRef<SigmaGraph>();
  const rendererRef = useRef<Sigma<SigmaNodeAttributes, SigmaEdgeAttributes>>();
  const requestSeq = useRef(0);
  const detailSeq = useRef(0);
  const [graph, setGraph] = useState<GraphView>();
  const [selected, setSelected] = useState<GraphNode>();
  const [hoveredId, setHoveredId] = useState<string>();
  const [summary, setSummary] = useState<NodeSummary>();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [nodeContext, setNodeContext] = useState<NodeContext>();
  const [nodeSource, setNodeSource] = useState<NodeSource>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>();
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [question, setQuestion] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [impactText, setImpactText] = useState("");
  const [lastQuestions, setLastQuestions] = useState<string[]>([]);
  const [entryPoints, setEntryPoints] = useState<GraphNode[]>([]);
  const [overviewNodes, setOverviewNodes] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<TwinMode>("overview");
  const [depth, setDepth] = useState(1);
  const [centeredLabel, setCenteredLabel] = useState("Home");
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]);
  const [nodeTypes, setNodeTypes] = useState<string[]>([]);
  const [riskFilter, setRiskFilter] = useState<"all" | "risky">("all");
  const [highlightPath, setHighlightPath] = useState<GraphPath>();
  const [pathLoading, setPathLoading] = useState(false);
  const [severityByNode, setSeverityByNode] = useState<Map<string, Risk>>(new Map());
  const [savedViews, setSavedViews] = useState<SavedTwinView[]>(() => loadSavedViews());
  const [annotations, setAnnotations] = useState<Record<string, string>>(() => loadAnnotations());

  const repoName = repository?.url.split("/").filter(Boolean).slice(-1)[0] ?? "No repository";
  const visibleGraph = useMemo(() => filterGraph(graph, relationshipTypes, nodeTypes, riskFilter, severityByNode, selected?.id), [graph, relationshipTypes, nodeTypes, riskFilter, severityByNode, selected?.id]);
  const visibleNodeIds = useMemo(() => new Set(visibleGraph.nodes.map((node) => node.id)), [visibleGraph.nodes]);
  const quickCandidates = useMemo(() => uniqueNodes([...(graph?.nodes ?? []), ...entryPoints, ...overviewNodes]), [graph, entryPoints, overviewNodes]);
  const quickResults = useMemo(() => searchNodes(quickSearch, quickCandidates, severityByNode), [quickSearch, quickCandidates, severityByNode]);
  const connectedNodes = useMemo(() => selected ? connectedNodeList(selected.id, graph, visibleGraph.edges) : [], [graph, selected, visibleGraph.edges]);
  const graphStats = useMemo(() => summarizeNodes(visibleGraph.nodes, severityByNode), [visibleGraph.nodes, severityByNode]);
  const highlightedNodeIds = useMemo(() => new Set(highlightPath?.nodes.map((node) => node.id) ?? []), [highlightPath]);
  const highlightedEdgeIds = useMemo(() => new Set(highlightPath?.edges.map((edge) => edge.id) ?? []), [highlightPath]);

  const connectedIdsForHover = useMemo(() => {
    if (!hoveredId) return new Set<string>();
    const ids = new Set<string>([hoveredId]);
    for (const edge of visibleGraph.edges) {
      if (edge.source === hoveredId || edge.target === hoveredId) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
    }
    return ids;
  }, [hoveredId, visibleGraph.edges]);

  useEffect(() => {
    if (!repository) {
      setEntryPoints([]);
      setOverviewNodes([]);
      return;
    }
    const current = ++requestSeq.current;
    Promise.allSettled([
      api.askGraph(repository.id, "What are the entry points?"),
      api.graphOverview(repository.id)
    ]).then(([entryResult, overviewResult]) => {
      if (current !== requestSeq.current) return;
      if (entryResult.status === "fulfilled") {
        setEntryPoints(entryResult.value.nodes.filter((node) => node.isEntryPoint || node.type === "entry_point").slice(0, 10));
      }
      if (overviewResult.status === "fulfilled") {
        setOverviewNodes(overviewResult.value.nodes.slice(0, 15));
      }
    });
  }, [repository?.id]);

  useEffect(() => {
    if (!selected || !repository) return;
    const current = ++detailSeq.current;
    setSummary(undefined);
    setNodeContext(undefined);
    setNodeSource(undefined);
    setDetailError(undefined);
    setHighlightPath(undefined);
    setDetailTab("summary");
    setSummaryLoading(true);
    setDetailLoading(true);
    api.nodeSummary(repository.id, selected.id)
      .then((response) => {
        if (current === detailSeq.current) setSummary(response);
      })
      .catch((err) => {
        if (current === detailSeq.current) setSummary({ nodeId: selected.id, summary: humanError(err, "Node summary is unavailable.") });
      })
      .finally(() => {
        if (current === detailSeq.current) setSummaryLoading(false);
      });
    Promise.all([api.nodeContext(repository.id, selected.id), api.nodeSource(repository.id, selected.id)])
      .then(([context, source]) => {
        if (current !== detailSeq.current) return;
        setNodeContext(context);
        setNodeSource(source);
      })
      .catch((err) => {
        if (current === detailSeq.current) setDetailError(humanError(err, "Node intelligence is unavailable."));
      })
      .finally(() => {
        if (current === detailSeq.current) setDetailLoading(false);
      });
  }, [selected?.id, repository?.id]);

  useEffect(() => {
    if (!preMortem || !graph) return;
    const next = new Map(severityByNode);
    for (const finding of preMortem.findings) {
      for (const node of graph.nodes) {
        if (node.path === finding.filePath) next.set(node.id, finding.severity);
      }
    }
    setSeverityByNode(next);
    setMode("impact");
  }, [preMortem?.changeId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearGraph();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !graph) {
      rendererRef.current?.kill();
      rendererRef.current = undefined;
      graphologyRef.current = undefined;
      drawMinimap(minimapRef.current, undefined);
      return;
    }

    rendererRef.current?.kill();
    const sigmaGraph = buildSigmaGraph(visibleGraph, selected?.id, severityByNode);
    graphologyRef.current = sigmaGraph;
    const renderer = new Sigma<SigmaNodeAttributes, SigmaEdgeAttributes>(sigmaGraph, container, {
      allowInvalidContainer: true,
      autoCenter: true,
      autoRescale: true,
      defaultNodeColor: "#4A90D9",
      defaultEdgeColor: "#343b4a",
      enableEdgeEvents: true,
      hideEdgesOnMove: false,
      hideLabelsOnMove: true,
      inertiaDuration: 260,
      inertiaRatio: 0.82,
      labelColor: { color: "#eef3ff" },
      labelDensity: 0.055,
      labelFont: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      labelRenderedSizeThreshold: visibleGraph.nodes.length > 18 ? 12 : 9,
      labelSize: 11,
      minCameraRatio: 0.18,
      maxCameraRatio: 3.2,
      renderEdgeLabels: false,
      renderLabels: true,
      stagePadding: 24,
      zIndex: true,
      defaultDrawNodeLabel: drawTwinNodeLabel,
      defaultDrawNodeHover: drawTwinNodeHover,
      nodeReducer: (node, data) => reduceNode(node, data, {
        hoveredId,
        selectedId: selected?.id,
        connectedIds: connectedIdsForHover,
        highlightedNodeIds,
        severityByNode
      }),
      edgeReducer: (edge, data) => reduceEdge(edge, data, {
        hoveredId,
        selectedId: selected?.id,
        highlightedEdgeIds,
        highlightedNodeIds
      })
    });
    rendererRef.current = renderer;
    renderer.on("enterNode", ({ node }) => setHoveredId(node));
    renderer.on("leaveNode", () => setHoveredId(undefined));
    renderer.on("clickNode", ({ node }) => {
      const graphNode = sigmaGraph.getNodeAttribute(node, "node");
      centerNode(graphNode);
    });
    renderer.on("clickEdge", ({ edge }) => {
      const graphEdge = sigmaGraph.getEdgeAttribute(edge, "edge");
      const source = visibleGraph.nodes.find((node) => node.id === graphEdge.source);
      const target = visibleGraph.nodes.find((node) => node.id === graphEdge.target);
      if (source && target) {
        setSelected(source.id === selected?.id ? target : source);
        void explainConnection(source.id === selected?.id ? target : source);
      }
    });
    renderer.on("clickStage", () => setHoveredId(undefined));
    setTimeout(() => {
      renderer.getCamera().animatedReset({ duration: 420 });
      drawMinimap(minimapRef.current, sigmaGraph);
    }, 80);

    return () => {
      renderer.kill();
      if (rendererRef.current === renderer) rendererRef.current = undefined;
    };
  }, [visibleGraph, selected?.id, severityByNode]);

  useEffect(() => {
    rendererRef.current?.setSettings({
      nodeReducer: (node, data) => reduceNode(node, data, {
        hoveredId,
        selectedId: selected?.id,
        connectedIds: connectedIdsForHover,
        highlightedNodeIds,
        severityByNode
      }),
      edgeReducer: (edge, data) => reduceEdge(edge, data, {
        hoveredId,
        selectedId: selected?.id,
        highlightedEdgeIds,
        highlightedNodeIds
      })
    });
    rendererRef.current?.refresh();
  }, [hoveredId, selected?.id, connectedIdsForHover, highlightedEdgeIds, highlightedNodeIds, severityByNode]);

  const loadGraph = useCallback(async (
    loader: () => Promise<GraphView>,
    options: { remember?: string; centeredLabel?: string; selectedId?: string; clearSelection?: boolean; mode?: TwinMode } = {}
  ) => {
    if (!repository) {
      setError("Ingest a repository before exploring the twin.");
      return;
    }
    const current = ++requestSeq.current;
    setLoading(true);
    setError(undefined);
    try {
      const view = await loader();
      if (current !== requestSeq.current) return;
      const cleaned = enforceContextualGraph(view);
      setGraph(cleaned);
      setMode(options.mode ?? "neighborhood");
      setCenteredLabel(options.centeredLabel ?? readableCenter(cleaned));
      setSeverityByNode(new Map(cleaned.nodes.map((node) => [node.id, node.risk]).filter(([, risk]) => risk !== "none") as Array<[string, Risk]>));
      if (options.clearSelection) {
        setSelected(undefined);
      } else if (options.selectedId) {
        setSelected(cleaned.nodes.find((node) => node.id === options.selectedId));
      }
      if (options.remember) {
        setLastQuestions((items) => [options.remember!, ...items.filter((item) => item !== options.remember)].slice(0, 3));
      }
    } catch (err) {
      if (current === requestSeq.current) setError(humanError(err, "Graph request failed."));
    } finally {
      if (current === requestSeq.current) setLoading(false);
    }
  }, [repository]);

  const askQuestion = (event?: FormEvent, text = question.trim()) => {
    event?.preventDefault();
    if (!text || !repository) return;
    void loadGraph(() => api.askGraph(repository.id, text), { remember: text, centeredLabel: text, clearSelection: true, mode: classifyQuestion(text) });
  };

  const runQuickSearch = () => {
    const term = quickSearch.trim();
    if (!term || !repository) return;
    if (quickResults[0]) {
      centerNode(quickResults[0]);
      return;
    }
    setQuestion(term);
    void loadGraph(() => api.askGraph(repository.id, term), { remember: term, centeredLabel: term, clearSelection: true, mode: "search" });
  };

  const showOverview = () => {
    if (!repository) return;
    void loadGraph(() => api.graphOverview(repository.id), { remember: "Architecture overview", centeredLabel: "architecture overview", clearSelection: true, mode: "overview" });
  };

  const showEntryGraph = (node: GraphNode) => centerNode(node, 1, "entry");

  const centerNode = (node: GraphNode, nextDepth = depth, nextMode: TwinMode = "neighborhood") => {
    if (!repository) return;
    setSelected(node);
    setCenteredLabel(node.name);
    setBreadcrumbs((trail) => [...trail.filter((item) => item.id !== node.id), { id: node.id, name: node.name }].slice(-6));
    void loadGraph(() => api.queryGraph(repository.id, { type: "node", value: node.id }, nextDepth, relationshipTypes), { centeredLabel: node.name, selectedId: node.id, mode: nextMode });
  };

  const revisitBreadcrumb = (crumb: { id: string; name: string }) => {
    const node = graph?.nodes.find((item) => item.id === crumb.id);
    if (node) centerNode(node);
  };

  const showImpact = async () => {
    if (!repository) {
      setError("Ingest a repository before calculating impact.");
      return;
    }
    if (!impactText.trim()) {
      setError("Describe the planned change first.");
      return;
    }
    const current = ++requestSeq.current;
    setLoading(true);
    setError(undefined);
    try {
      const target = selected?.id ?? impactText;
      const [premortem, view] = await Promise.all([
        api.runPremortem(repository.id, impactText, [target]),
        api.blastRadius(repository.id, impactText, [target], Math.min(3, Math.max(depth, 2)), relationshipTypes)
      ]);
      if (current !== requestSeq.current) return;
      const cleaned = enforceContextualGraph(view);
      const nextSeverity = new Map<string, Risk>();
      for (const node of cleaned.nodes) nextSeverity.set(node.id, node.risk);
      for (const finding of premortem.findings) {
        const match = cleaned.nodes.find((node) => node.path === finding.filePath);
        if (match) nextSeverity.set(match.id, finding.severity);
      }
      setGraph(cleaned);
      setMode("impact");
      setCenteredLabel(selected?.name ?? "planned change");
      setSeverityByNode(nextSeverity);
      if (!premortem.findings.length && premortem.evidenceGaps.length) {
        setError(`Impact analysis needs more evidence: ${premortem.evidenceGaps[0]}`);
      }
    } catch (err) {
      setError(humanError(err, "Impact analysis failed."));
    } finally {
      if (current === requestSeq.current) setLoading(false);
    }
  };

  const changeDepth = (delta: number) => {
    const next = Math.max(1, Math.min(4, depth + delta));
    setDepth(next);
    if (selected) centerNode(selected, next);
  };

  const clearGraph = () => {
    requestSeq.current += 1;
    rendererRef.current?.kill();
    rendererRef.current = undefined;
    graphologyRef.current = undefined;
    setGraph(undefined);
    setSelected(undefined);
    setSummary(undefined);
    setNodeContext(undefined);
    setNodeSource(undefined);
    setDetailError(undefined);
    setHighlightPath(undefined);
    setCenteredLabel("Home");
    setQuickSearch("");
    setMode("overview");
    setBreadcrumbs([]);
    setSeverityByNode(new Map());
    setError(undefined);
  };

  const zoomCanvas = (direction: "in" | "out") => {
    const camera = rendererRef.current?.getCamera();
    if (!camera) return;
    const current = camera.getState();
    camera.animate({ ratio: current.ratio * (direction === "in" ? 0.72 : 1.32) }, { duration: 180 });
  };

  const fitCanvas = () => rendererRef.current?.getCamera().animatedReset({ duration: 300 });

  const saveCurrentView = () => {
    if (!graph) return;
    const view: SavedTwinView = {
      id: `${Date.now()}`,
      name: centeredLabel,
      graph,
      mode,
      centeredLabel,
      selectedId: selected?.id
    };
    setSavedViews((current) => persistSavedViews([view, ...current.filter((item) => item.name !== view.name)].slice(0, 6)));
  };

  const restoreSavedView = (view: SavedTwinView) => {
    setGraph(view.graph);
    setMode(view.mode);
    setCenteredLabel(view.centeredLabel);
    setSelected(view.selectedId ? view.graph.nodes.find((node) => node.id === view.selectedId) : undefined);
  };

  const updateAnnotation = (nodeId: string, value: string) => {
    setAnnotations((current) => persistAnnotations({ ...current, [nodeId]: value }));
  };

  async function explainConnection(target: GraphNode) {
    if (!repository || !selected || target.id === selected.id) return;
    setPathLoading(true);
    setDetailError(undefined);
    try {
      const path = await api.graphPath(repository.id, selected.id, target.id, relationshipTypes, Math.max(4, depth + 1));
      setHighlightPath(path);
      setGraph((current) => current ? mergePathIntoGraph(current, path) : current);
      setDetailTab("evidence");
    } catch (err) {
      setDetailError(humanError(err, "No evidence path was found."));
    } finally {
      setPathLoading(false);
    }
  }

  return (
    <section className={`hf-d3-page hf-twin-page ${selected ? "has-selection" : ""}`}>
      <aside className="hf-d3-sidebar hf-twin-intent">
        <div className="hf-d3-sidebar-head">
          <div>
            <h2>Explore</h2>
            <span>{repoName}</span>
          </div>
          <span className={`hf-d3-mode ${mode}`}>{mode}</span>
        </div>

        <div className="hf-d3-section hf-d3-quick-search">
          <label htmlFor="twin-symbol-search">Symbol search</label>
          <div>
            <Search size={14} />
            <input
              id="twin-symbol-search"
              value={quickSearch}
              onChange={(event) => setQuickSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  runQuickSearch();
                }
              }}
              placeholder="router, auth, OAuth2PasswordBearer"
            />
          </div>
          <button type="button" disabled={!repository || !quickSearch.trim()} onClick={runQuickSearch}>Center result</button>
          {quickResults.length > 0 && (
            <div className="hf-d3-search-results">
              {quickResults.slice(0, 6).map((node) => (
                <button type="button" key={node.id} onClick={() => centerNode(node)}>
                  <span>{styleFor(node).icon}</span>
                  <strong>{node.name}</strong>
                  <small>{node.path ?? node.type}</small>
                </button>
              ))}
            </div>
          )}
          <small>Search stays local while typing. Backend runs only when you center or ask.</small>
        </div>

        <form className="hf-d3-section" onSubmit={askQuestion}>
          <label>Ask the twin</label>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={"What do you want to understand?\nTry: \"What are the entry points?\""}
          />
          <button type="submit" disabled={!repository || loading || !question.trim()}>Ask →</button>
          <div className="hf-d3-chips">
            {lastQuestions.map((item) => <button type="button" key={item} onClick={() => askQuestion(undefined, item)}>{item}</button>)}
          </div>
        </form>

        <section className="hf-d3-section">
          <label>Entry points</label>
          <small>Start with execution paths instead of filenames.</small>
          <div className="hf-d3-entry-list">
            {entryPoints.length ? entryPoints.map((node) => (
              <button type="button" key={node.id} onClick={() => showEntryGraph(node)}>● {node.name}</button>
            )) : <span>Entry points load after ingestion.</span>}
          </div>
        </section>

        <section className="hf-d3-section">
          <label>Architecture overview</label>
          <button type="button" onClick={showOverview} disabled={!repository || loading}>Show architecture spine</button>
          <div className="hf-d3-god-list">
            {overviewNodes.slice(0, 6).map((node) => (
              <button type="button" key={node.id} onClick={() => centerNode(node)}>{node.name}<span>{node.connectionCount}</span></button>
            ))}
          </div>
        </section>

        <details className="hf-d3-section hf-d3-disclosure">
          <summary>Modes and filters</summary>
          <div className="hf-d3-mode-grid">
            {[
              ["overview", "Overview"],
              ["entry", "Entry"],
              ["neighborhood", "Neighborhood"],
              ["impact", "Impact"],
              ["review", "Review"],
              ["memory", "Memory"]
            ].map(([value, label]) => (
              <button className={mode === value ? "active" : ""} type="button" key={value} onClick={() => setMode(value as TwinMode)}>
                {label}
              </button>
            ))}
          </div>
          <label>Relationships</label>
          <div className="hf-d3-filter-grid">
            <button className={relationshipTypes.length === 0 ? "active" : ""} type="button" onClick={() => setRelationshipTypes([])}>
              <span style={{ background: "#d8dee9" }} /> all
            </button>
            {RELATIONSHIPS.map((relationship) => (
              <button
                className={relationshipTypes.length === 0 || relationshipTypes.includes(relationship) ? "active" : ""}
                key={relationship}
                type="button"
                onClick={() => setRelationshipTypes((current) => current.includes(relationship) ? current.filter((item) => item !== relationship) : [...current, relationship])}
              >
                <span style={{ background: EDGE_COLOR[relationship] ?? "#555" }} />
                {relationship.replace("_", " ")}
              </button>
            ))}
          </div>
          <label>Node types</label>
          <div className="hf-d3-filter-grid">
            <button className={nodeTypes.length === 0 ? "active" : ""} type="button" onClick={() => setNodeTypes([])}>
              <span style={{ background: "#d8dee9" }} /> all types
            </button>
            {NODE_TYPES.map((type) => (
              <button
                className={nodeTypes.length === 0 || nodeTypes.includes(type) ? "active" : ""}
                key={type}
                type="button"
                onClick={() => setNodeTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type])}
              >
                <span style={{ background: NODE_STYLE[type].stroke }} />
                {type.replace("_", " ")}
              </button>
            ))}
            <button className={riskFilter === "risky" ? "active" : ""} type="button" onClick={() => setRiskFilter((value) => value === "risky" ? "all" : "risky")}>
              <span style={{ background: "#F39C12" }} /> risk only
            </button>
          </div>
        </details>

        <details className="hf-d3-section hf-d3-disclosure" open>
          <summary>Impact and views</summary>
          <label>Planned change</label>
          <textarea value={impactText} onChange={(event) => setImpactText(event.target.value)} placeholder="What are you planning to change?" />
          <button type="button" disabled={!repository || loading || !impactText.trim()} onClick={showImpact}>Show impact →</button>
          <button type="button" onClick={saveCurrentView} disabled={!graph}>Save current view</button>
          <div className="hf-d3-god-list">
            {savedViews.map((view) => <button type="button" key={view.id} onClick={() => restoreSavedView(view)}>{view.name}<span>{view.graph.nodes.length}</span></button>)}
          </div>
        </details>
      </aside>

      <div className="hf-d3-main hf-twin-main">
        <div className="hf-d3-status">
          <span>{graph ? `Centered on ${centeredLabel} — ${visibleGraph.nodes.length} nodes, ${visibleGraph.edges.length} edges at depth ${depth}` : "No graph loaded"}</span>
          <nav aria-label="Twin breadcrumb">
            <button type="button" onClick={clearGraph}>Home</button>
            {breadcrumbs.map((crumb) => <button type="button" key={crumb.id} onClick={() => revisitBreadcrumb(crumb)}>{crumb.name}</button>)}
          </nav>
          <div>
            <button type="button" onClick={() => changeDepth(-1)}>−</button>
            <span>Depth {depth}</span>
            <button type="button" onClick={() => changeDepth(1)}>+</button>
            <button type="button" onClick={clearGraph}>× Clear</button>
          </div>
        </div>

        {graph && (
          <div className="hf-d3-insight-bar">
            <span><GitBranch size={14} /> {graphStats.entryPoints} entry points</span>
            <span>{graphStats.files} files</span>
            <span>{graphStats.functions} functions</span>
            <span>{graphStats.classes} classes</span>
            <span>{graphStats.subsystems} subsystems</span>
            <span className={graphStats.risky > 0 ? "risk" : ""}>{graphStats.risky} risk-marked</span>
          </div>
        )}

        <div className="hf-d3-canvas hf-sigma-canvas">
          <div ref={containerRef} className="hf-sigma-stage" aria-label="Repository architecture graph" />
          {!graph && <EmptyState onAsk={(text) => askQuestion(undefined, text)} onOverview={showOverview} />}
          {loading && <div className="hf-d3-loading">Loading contextual graph…</div>}
          {error && <div className="hf-d3-error">{error}</div>}
          {graph && (
            <>
              <div className="hf-d3-canvas-controls" aria-label="Graph viewport controls">
                <button type="button" onClick={() => zoomCanvas("in")} aria-label="Zoom in"><ZoomIn size={14} /></button>
                <button type="button" onClick={() => zoomCanvas("out")} aria-label="Zoom out"><ZoomOut size={14} /></button>
                <button type="button" onClick={fitCanvas} aria-label="Fit graph"><Maximize2 size={14} /></button>
                <button type="button" onClick={clearGraph} aria-label="Reset graph"><RotateCcw size={14} /></button>
              </div>
              <div className="hf-d3-legend" aria-label="Graph legend">
                {Object.entries(NODE_STYLE).filter(([type]) => type !== "repository").map(([type, style]) => (
                  <span key={type}><i style={{ background: style.stroke }} />{style.label}</span>
                ))}
                <span><i style={{ background: "#ffffff" }} />selected</span>
                <span><i style={{ background: "#E74C3C" }} />critical</span>
              </div>
              <canvas ref={minimapRef} className="hf-d3-minimap hf-sigma-minimap" width="120" height="80" />
            </>
          )}
        </div>
      </div>

      {selected && (
        <aside className="hf-d3-detail hf-twin-detail">
          <button className="hf-d3-close" type="button" onClick={() => setSelected(undefined)} aria-label="Close node details"><X size={16} /></button>
          <div className="hf-d3-detail-head">
            <div>
              <h2>{selected.name}</h2>
              <p>{selected.path ?? "Repository node"}</p>
            </div>
            <span className="hf-d3-type" style={{ borderColor: styleFor(selected).stroke }}>{selected.type}</span>
          </div>
          <div className="hf-d3-node-meta">
            <span>Lines {selected.startLine ?? "?"}-{selected.endLine ?? "?"}</span>
            <span>{selected.connectionCount} connections</span>
            <span>Owner {selected.owner ?? selected.lastModifiedBy ?? "unknown"}</span>
          </div>

          <div className="hf-d3-detail-tabs" role="tablist" aria-label="Node intelligence sections">
            {DETAIL_TABS.map(({ tab, icon: Icon, label }) => (
              <button className={detailTab === tab ? "active" : ""} type="button" key={tab} onClick={() => setDetailTab(tab)}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          {detailError && <div className="hf-d3-detail-error">{detailError}</div>}

          {detailTab === "summary" && (
            <section>
              <h3>Plain-English summary</h3>
              {summaryLoading ? <div className="hf-d3-skeleton" /> : <p>{summary?.summary ?? "No summary available yet."}</p>}
              <label className="hf-d3-annotation">
                Team note
                <textarea value={annotations[selected.id] ?? ""} onChange={(event) => updateAnnotation(selected.id, event.target.value)} placeholder="Add review notes or architectural context." />
              </label>
            </section>
          )}

          {detailTab === "relationships" && (
            <section>
              <h3>Callers, callees, imports</h3>
              {detailLoading && <div className="hf-d3-skeleton" />}
              <div className="hf-d3-relationship-groups">
                {(nodeContext?.relationshipGroups ?? []).map((group) => (
                  <div key={`${group.direction}-${group.relationship}`}>
                    <h4>{group.direction} {group.relationship}</h4>
                    {group.nodes.map((node) => (
                      <div className="hf-d3-rel-row" key={`${group.direction}-${group.relationship}-${node.id}`}>
                        <button type="button" onClick={() => centerNode(node)}>
                          <span>{node.name}</span>
                          <small>{node.path ?? node.type}</small>
                        </button>
                        <button type="button" onClick={() => explainConnection(node)}>Why?</button>
                      </div>
                    ))}
                  </div>
                ))}
                {!detailLoading && !nodeContext?.relationshipGroups?.length && <small>No relationship evidence returned for this node.</small>}
              </div>
            </section>
          )}

          {detailTab === "code" && (
            <section>
              <h3>Source evidence</h3>
              {detailLoading && <div className="hf-d3-skeleton" />}
              {nodeSource?.unavailableReason && <p>{nodeSource.unavailableReason}</p>}
              {!detailLoading && nodeSource?.snippet && <pre className="hf-d3-code"><code>{nodeSource.snippet}</code></pre>}
              <div className="hf-d3-action-grid">
                <button type="button" disabled={!nodeSource?.path}>Open in editor</button>
                <button type="button" disabled={!nodeSource?.path}>Open in GitHub</button>
              </div>
            </section>
          )}

          {detailTab === "evidence" && (
            <section>
              <h3>Why connected?</h3>
              {pathLoading && <div className="hf-d3-skeleton" />}
              {highlightPath ? (
                <div className="hf-d3-path-card">
                  <strong>{highlightPath.confidence} confidence</strong>
                  <p>{highlightPath.explanation}</p>
                  <ol>{highlightPath.nodes.map((node) => <li key={node.id}>{node.name}</li>)}</ol>
                </div>
              ) : <p>Select a neighbor and press Why to show the dependency path.</p>}
              <div className="hf-d3-evidence-list">
                {(nodeContext?.evidenceEdges ?? []).slice(0, 8).map((edge) => (
                  <span key={edge.id}>{edge.type}: {edge.evidencePath ?? "twin edge"}{edge.evidenceLine ? `:${edge.evidenceLine}` : ""}</span>
                ))}
              </div>
            </section>
          )}

          {detailTab === "risk" && (
            <section>
              <h3>Impact readiness</h3>
              <div className={`hf-d3-risk-card risk-${severityByNode.get(selected.id) ?? selected.risk}`}>
                <strong>{severityByNode.get(selected.id) ?? selected.risk}</strong>
                <p>{impactCopy(selected, graph, visibleGraph.edges)}</p>
              </div>
              <div className="hf-d3-connected-list">
                {connectedNodes.slice(0, 12).map((node) => (
                  <button type="button" key={node.id} onClick={() => centerNode(node)}>
                    <span>{node.name}</span>
                    <small>{node.path ?? node.type}</small>
                  </button>
                ))}
              </div>
              <div className="hf-d3-action-grid">
                <button type="button" onClick={() => { setImpactText(`Change ${selected.name}`); setMode("impact"); }}>Prepare impact report</button>
                <button type="button" onClick={() => { setQuestion(`What breaks if I change ${selected.name}?`); askQuestion(undefined, `What breaks if I change ${selected.name}?`); }}>Ask risk question</button>
              </div>
            </section>
          )}
        </aside>
      )}
    </section>
  );
}

function EmptyState({ onAsk, onOverview }: { onAsk: (text: string) => void; onOverview: () => void }) {
  return (
    <div className="hf-d3-empty hf-twin-empty">
      <Network />
      <h2>Your codebase, understood</h2>
      <p>Start with intent: ask a question, choose an entry point, or load a small architecture spine. The full universe is never shown.</p>
      <div>
        {SUGGESTIONS.map((item) => (
          <button type="button" key={item} onClick={() => item === "Show architecture overview" ? onOverview() : onAsk(item)}>
            <Sparkles size={14} /> {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function buildSigmaGraph(view: GraphView, selectedId: string | undefined, severityByNode: Map<string, Risk>): SigmaGraph {
  const graph = new Graph<SigmaNodeAttributes, SigmaEdgeAttributes>({ multi: true, type: "directed" });
  const subsystems = subsystemMap(view.nodes);
  const center = selectedId ?? (view.center.type === "node" ? view.center.value : view.nodes[0]?.id);
  for (const [index, node] of view.nodes.entries()) {
    const subsystem = subsystemFor(node);
    const style = styleFor(node);
    const angle = (index / Math.max(1, view.nodes.length)) * Math.PI * 2;
    const radius = node.id === center ? 0.02 : 1 + Math.log2(index + 2) * 0.18;
    const severity = severityByNode.get(node.id) ?? node.risk;
    const severityColor = SEVERITY_COLOR[severity];
    graph.addNode(node.id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      size: nodeSize(node),
      label: labelFor(node),
      color: severityColor ? darkenForSeverity(severity) : style.fill,
      borderColor: severityColor ?? subsystemColor(subsystems.get(subsystem) ?? 0),
      type: "circle",
      node,
      subsystem,
      severity,
      forceLabel: node.id === selectedId || Boolean(node.isEntryPoint),
      zIndex: node.id === selectedId ? 8 : node.isEntryPoint ? 5 : 1
    });
  }
  for (const edge of view.edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    const color = EDGE_COLOR[edge.type] ?? "#404758";
    graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, {
      label: edge.type,
      color,
      size: edge.type === "extends" ? 2 : edge.type === "depends_on" ? 1 : 1.4,
      type: edge.type === "depends_on" ? "line" : "arrow",
      relationship: edge.type,
      edge
    });
  }
  if (graph.order > 1) {
    try {
      forceAtlas2.assign(graph, {
        iterations: graph.order > 28 ? 110 : 70,
        settings: {
          adjustSizes: true,
          barnesHutOptimize: graph.order > 40,
          edgeWeightInfluence: 0.6,
          gravity: 1.35,
          linLogMode: false,
          scalingRatio: 6,
          slowDown: 4,
          strongGravityMode: true
        }
      });
    } catch {
      // Keep deterministic radial coordinates if the layout engine cannot run.
    }
  }
  sanitizeGraphPositions(graph);
  if (center && graph.hasNode(center)) {
    graph.setNodeAttribute(center, "x", 0);
    graph.setNodeAttribute(center, "y", 0);
    graph.setNodeAttribute(center, "forceLabel", true);
  }
  sanitizeGraphPositions(graph);
  return graph;
}

function sanitizeGraphPositions(graph: SigmaGraph) {
  const total = Math.max(1, graph.order);
  let index = 0;
  graph.forEachNode((node, attrs) => {
    if (Number.isFinite(attrs.x) && Number.isFinite(attrs.y)) {
      index += 1;
      return;
    }
    const angle = (index / total) * Math.PI * 2;
    const radius = 1.2 + Math.floor(index / Math.max(1, Math.ceil(Math.sqrt(total)))) * 0.35;
    graph.mergeNodeAttributes(node, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
    index += 1;
  });
}

function reduceNode(node: string, data: SigmaNodeAttributes, state: {
  hoveredId?: string;
  selectedId?: string;
  connectedIds: Set<string>;
  highlightedNodeIds: Set<string>;
  severityByNode: Map<string, Risk>;
}) {
  const severity = state.severityByNode.get(node) ?? data.severity;
  const selected = node === state.selectedId;
  const hovered = node === state.hoveredId;
  const highlighted = state.highlightedNodeIds.has(node);
  const unrelated = state.hoveredId && !state.connectedIds.has(node);
  const severityColor = SEVERITY_COLOR[severity];
  return {
    x: Number.isFinite(data.x) ? data.x : 0,
    y: Number.isFinite(data.y) ? data.y : 0,
    color: unrelated ? "#171d29" : selected ? "#f8fbff" : hovered ? "#49d8d3" : severityColor ? darkenForSeverity(severity) : data.color,
    size: unrelated ? Math.max(3, data.size * 0.72) : selected ? data.size + 4 : hovered || highlighted ? data.size + 3 : data.size,
    label: unrelated ? "" : data.label,
    forceLabel: selected || hovered || highlighted || data.forceLabel,
    highlighted: false,
    borderColor: selected ? "#ffffff" : severityColor ?? data.borderColor,
    zIndex: selected ? 20 : hovered || highlighted ? 15 : data.zIndex ?? 1,
    hidden: false
  };
}

function reduceEdge(edge: string, data: SigmaEdgeAttributes, state: {
  hoveredId?: string;
  selectedId?: string;
  highlightedEdgeIds: Set<string>;
  highlightedNodeIds: Set<string>;
}) {
  const source = data.edge.source;
  const target = data.edge.target;
  const connectedToHover = state.hoveredId && (source === state.hoveredId || target === state.hoveredId);
  const connectedToSelected = state.selectedId && (source === state.selectedId || target === state.selectedId);
  const highlighted = state.highlightedEdgeIds.has(edge) || (state.highlightedNodeIds.has(source) && state.highlightedNodeIds.has(target));
  const dimmed = state.hoveredId && !connectedToHover;
  return {
    color: dimmed ? "#151923" : connectedToHover || highlighted ? "#ffffff" : data.color,
    size: dimmed ? 0.35 : connectedToHover || highlighted ? Math.max(2.8, data.size + 1.4) : connectedToSelected ? data.size + 0.7 : data.size,
    hidden: false,
    label: connectedToHover || highlighted ? data.label : "",
    zIndex: connectedToHover || highlighted ? 20 : connectedToSelected ? 10 : 1
  };
}

function drawTwinNodeLabel(context: CanvasRenderingContext2D, data: { x: number; y: number; size: number; label: string | null; color: string }, _settings: unknown) {
  if (!data.label) return;
  const label = data.label.length > 42 ? `${data.label.slice(0, 39)}...` : data.label;
  context.save();
  context.font = "600 11px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const width = Math.min(270, context.measureText(label).width + 18);
  const x = data.x + data.size + 8;
  const y = data.y - 13;
  roundRect(context, x, y, width, 24, 6);
  context.fillStyle = "rgba(9, 13, 20, 0.88)";
  context.fill();
  context.strokeStyle = "rgba(120, 169, 255, 0.28)";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = "#e7edf8";
  context.fillText(label, x + 9, y + 16);
  context.restore();
}

function drawTwinNodeHover(context: CanvasRenderingContext2D, data: { x: number; y: number; size: number; label: string | null; color: string }, settings: unknown) {
  context.save();
  context.shadowColor = "rgba(8, 189, 186, 0.52)";
  context.shadowBlur = 18;
  context.beginPath();
  context.arc(data.x, data.y, data.size + 4, 0, Math.PI * 2);
  context.fillStyle = "rgba(8, 189, 186, 0.16)";
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = "#08bdba";
  context.stroke();
  context.restore();
  drawTwinNodeLabel(context, data, settings);
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function filterGraph(
  graph: GraphView | undefined,
  relationshipTypes: string[],
  nodeTypes: string[],
  riskFilter: "all" | "risky",
  severityByNode: Map<string, Risk>,
  selectedId?: string
): GraphView {
  if (!graph) return { center: { type: "query", value: "" }, depth: 0, nodes: [], edges: [], riskSummary: {} };
  const nodes = graph.nodes.filter((node) => {
    if (node.id === selectedId) return true;
    if (nodeTypes.length && !nodeTypes.includes(node.type)) return false;
    if (riskFilter === "risky") {
      const risk = severityByNode.get(node.id) ?? node.risk;
      return risk === "critical" || risk === "high" || risk === "medium" || risk === "blocked_insufficient_evidence";
    }
    return true;
  });
  const ids = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) =>
    ids.has(edge.source)
    && ids.has(edge.target)
    && (relationshipTypes.length === 0 || relationshipTypes.includes(edge.type))
  );
  return { ...graph, nodes, edges };
}

function enforceContextualGraph(view: GraphView): GraphView {
  const cap = view.depth <= 1 ? 12 : view.depth === 2 ? 25 : view.depth === 3 ? 40 : 50;
  const nodes = view.nodes
    .filter((node) => !isNoiseNode(node))
    .sort((a, b) => Number(b.id === view.center.value) - Number(a.id === view.center.value) || b.connectionCount - a.connectionCount)
    .slice(0, cap);
  const ids = new Set(nodes.map((node) => node.id));
  return { ...view, nodes, edges: view.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) };
}

function styleFor(node: GraphNode) {
  if (node.isEntryPoint || node.type === "entry_point") return NODE_STYLE.entry_point;
  return NODE_STYLE[node.type] ?? NODE_STYLE.file;
}

function nodeSize(node: GraphNode) {
  if (node.isEntryPoint || node.type === "entry_point") return 11;
  if (node.type === "class") return 9.5;
  if (node.type === "file") return 8.5;
  return 7.5;
}

function labelFor(node: GraphNode) {
  return `${node.name}${node.path ? `  ·  ${truncatePath(node.path, 28)}` : ""}`;
}

function readableCenter(view: GraphView) {
  if (view.center.type === "node") return view.nodes.find((node) => node.id === view.center.value)?.name ?? "selected node";
  return view.center.value || "overview";
}

function classifyQuestion(text: string): TwinMode {
  const value = text.toLowerCase();
  if (value.includes("entry")) return "entry";
  if (value.includes("impact") || value.includes("break")) return "impact";
  if (value.includes("review") || value.includes("pr") || value.includes("merge request")) return "review";
  if (value.includes("memory") || value.includes("decision") || value.includes("mistake")) return "memory";
  if (value.includes("overview") || value.includes("critical") || value.includes("connected")) return "overview";
  return "search";
}

function searchNodes(query: string, nodes: GraphNode[], severityByNode: Map<string, Risk>) {
  const terms = query.toLowerCase().split(/[^a-z0-9_./-]+/).filter(Boolean);
  if (!terms.length) return [];
  return nodes
    .map((node) => ({ node, score: scoreNode(node, terms, severityByNode) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.node.connectionCount - a.node.connectionCount)
    .slice(0, 8)
    .map((item) => item.node);
}

function scoreNode(node: GraphNode, terms: string[], severityByNode: Map<string, Risk>) {
  const haystack = `${node.name} ${node.path ?? ""} ${node.type}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (node.name.toLowerCase() === term) score += 20;
    else if (node.name.toLowerCase().includes(term)) score += 12;
    else if (haystack.includes(term)) score += 5;
  }
  if (node.isEntryPoint) score += 3;
  if (severityByNode.get(node.id) === "critical" || severityByNode.get(node.id) === "high") score += 2;
  return score + Math.min(8, node.connectionCount / 4);
}

function connectedNodeList(nodeId: string, graph: GraphView | undefined, edges: GraphEdge[]) {
  if (!graph) return [];
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.source === nodeId) ids.add(edge.target);
    if (edge.target === nodeId) ids.add(edge.source);
  }
  return graph.nodes.filter((node) => ids.has(node.id)).sort((a, b) => b.connectionCount - a.connectionCount);
}

function summarizeNodes(nodes: GraphNode[], severityByNode: Map<string, Risk>) {
  const subsystems = new Set(nodes.map(subsystemFor));
  return {
    entryPoints: nodes.filter((node) => node.isEntryPoint || node.type === "entry_point").length,
    files: nodes.filter((node) => node.type === "file").length,
    functions: nodes.filter((node) => node.type === "function").length,
    classes: nodes.filter((node) => node.type === "class").length,
    subsystems: subsystems.size,
    risky: nodes.filter((node) => {
      const risk = severityByNode.get(node.id) ?? node.risk;
      return risk === "critical" || risk === "high" || risk === "medium" || risk === "blocked_insufficient_evidence";
    }).length
  };
}

function impactCopy(node: GraphNode, graph: GraphView | undefined, edges: GraphEdge[]) {
  const direct = edges.filter((edge) => edge.source === node.id || edge.target === node.id).length;
  const transitive = graph ? new Set(edges.flatMap((edge) => [edge.source, edge.target])).size - 1 : 0;
  return `Changing this node has ${direct} direct graph relationships and ${Math.max(0, transitive)} visible transitive neighbors in the current view. Use impact mode for evidence-backed checks before execution.`;
}

function mergePathIntoGraph(graph: GraphView, path: GraphPath): GraphView {
  const nodes = uniqueNodes([...graph.nodes, ...path.nodes]);
  const edgesById = new Map<string, GraphEdge>();
  for (const edge of [...graph.edges, ...path.edges]) edgesById.set(edge.id, edge);
  return { ...graph, nodes, edges: [...edgesById.values()] };
}

function uniqueNodes(nodes: GraphNode[]) {
  const byId = new Map<string, GraphNode>();
  for (const node of nodes) {
    if (!isNoiseNode(node)) byId.set(node.id, node);
  }
  return [...byId.values()];
}

function isNoiseNode(node: GraphNode) {
  const path = (node.path ?? "").toLowerCase();
  return /(^|\/)(tests?|docs?|examples?|fixtures?|vendor|node_modules|dist|build|coverage|migrations|\.venv|venv)(\/|$)/.test(path)
    || /(^|\/)(test_.*\.py|.*_test\.py|.*\.(spec|test)\.(ts|tsx|js|jsx)|conftest\.py)$/.test(path);
}

function subsystemFor(node: GraphNode) {
  const path = node.path ?? node.name;
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2 && ["src", "app", "backend", "frontend"].includes(parts[0])) return parts[1];
  return parts[0] ?? node.type;
}

function subsystemMap(nodes: GraphNode[]) {
  const names = [...new Set(nodes.map(subsystemFor))].sort();
  return new Map(names.map((name, index) => [name, index]));
}

function subsystemColor(index: number) {
  return SUBSYSTEM_COLORS[index % SUBSYSTEM_COLORS.length];
}

function darkenForSeverity(severity: Risk) {
  if (severity === "critical" || severity === "blocked_insufficient_evidence") return "#2d0a0a";
  if (severity === "high") return "#2d1a0a";
  if (severity === "medium") return "#302a08";
  return "#0d1f2d";
}

function truncatePath(value: string, max: number) {
  if (value.length <= max) return value;
  return `…${value.slice(-(max - 1))}`;
}

function humanError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  return error.message.replace(/^HelixFactory API is not reachable\. Tried /, "").replace(/\s+/g, " ").trim() || fallback;
}

function drawMinimap(canvas: HTMLCanvasElement | null, graph: SigmaGraph | undefined) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#090b10";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#303848";
  context.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  if (!graph || graph.order === 0) return;
  const nodes = graph.nodes().map((id) => ({ id, x: graph.getNodeAttribute(id, "x"), y: graph.getNodeAttribute(id, "y"), color: graph.getNodeAttribute(id, "borderColor") }));
  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scaleX = (value: number) => 8 + ((value - minX) / Math.max(0.0001, maxX - minX)) * (canvas.width - 16);
  const scaleY = (value: number) => 8 + ((value - minY) / Math.max(0.0001, maxY - minY)) * (canvas.height - 16);
  context.globalAlpha = 0.45;
  graph.forEachEdge((_edge, attrs, source, target) => {
    const sourceNode = nodes.find((node) => node.id === source);
    const targetNode = nodes.find((node) => node.id === target);
    if (!sourceNode || !targetNode) return;
    context.strokeStyle = attrs.color;
    context.beginPath();
    context.moveTo(scaleX(sourceNode.x), scaleY(sourceNode.y));
    context.lineTo(scaleX(targetNode.x), scaleY(targetNode.y));
    context.stroke();
  });
  context.globalAlpha = 1;
  for (const node of nodes) {
    context.fillStyle = node.color;
    context.beginPath();
    context.arc(scaleX(node.x), scaleY(node.y), 2.2, 0, Math.PI * 2);
    context.fill();
  }
}

function loadSavedViews(): SavedTwinView[] {
  try {
    return JSON.parse(localStorage.getItem("helixfactory.twin.savedViews") ?? "[]") as SavedTwinView[];
  } catch {
    return [];
  }
}

function persistSavedViews(views: SavedTwinView[]) {
  localStorage.setItem("helixfactory.twin.savedViews", JSON.stringify(views));
  return views;
}

function loadAnnotations(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem("helixfactory.twin.annotations") ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function persistAnnotations(annotations: Record<string, string>) {
  localStorage.setItem("helixfactory.twin.annotations", JSON.stringify(annotations));
  return annotations;
}
