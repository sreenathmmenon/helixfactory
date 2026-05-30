import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Sigma from "sigma";
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Code2,
  Copy,
  FileText,
  GitBranch,
  Info,
  Link2,
  Maximize2,
  Network,
  RefreshCw,
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
  intent?: "twin" | "impact";
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
  entry_point: { fill: "#0d2217", stroke: "#2fd36b", icon: "●", label: "Entry point" },
  repository:  { fill: "#1a1a2e", stroke: "#8a93a7", icon: "⬢", label: "Repository" },
  file:        { fill: "#0d2b2c", stroke: "#0D7377", icon: "▣", label: "File" },
  function:    { fill: "#0d1f2d", stroke: "#4A90D9", icon: "ƒ", label: "Function" },
  class:       { fill: "#1a0d2b", stroke: "#9B59B6", icon: "◇", label: "Class" }
};

const EDGE_COLOR: Record<string, string> = {
  calls:      "#4A90D9",
  imports:    "#0D7377",
  extends:    "#9B59B6",
  depends_on: "#7a8192",
  defines:    "#4A90D9",
  contains:   "#7a8192"
};

const SEVERITY_COLOR: Partial<Record<Risk, string>> = {
  critical:                    "#E74C3C",
  high:                        "#F39C12",
  medium:                      "#F1C40F",
  blocked_insufficient_evidence: "#E74C3C"
};

const SEVERITY_LABEL: Partial<Record<Risk, string>> = {
  none:                          "No risk",
  low:                           "Low risk",
  medium:                        "Medium risk",
  high:                          "High risk — review required",
  critical:                      "Critical — block and escalate",
  blocked_insufficient_evidence: "Insufficient evidence to assess"
};

const SUBSYSTEM_COLORS = [
  "#0D7377","#4A90D9","#9B59B6","#27AE60",
  "#F39C12","#E67E22","#6C8AE4","#16A085"
];

const DETAIL_TABS: Array<{ tab: DetailTab; icon: LucideIcon; label: string; title: string }> = [
  { tab: "risk",          icon: ShieldAlert, label: "Risk",         title: "Impact readiness and risk context" },
  { tab: "summary",       icon: FileText,    label: "Summary",      title: "Plain-English summary of this node" },
  { tab: "relationships", icon: GitBranch,   label: "Links",        title: "What calls this and what it calls" },
  { tab: "code",          icon: Code2,       label: "Code",         title: "Source code evidence" },
  { tab: "evidence",      icon: Link2,       label: "Evidence",     title: "Dependency path and evidence edges" }
];

const EDGE_TYPES_WITH_COLORS: Array<{ key: string; label: string }> = [
  { key: "calls",      label: "Calls" },
  { key: "imports",    label: "Imports" },
  { key: "extends",    label: "Extends" },
  { key: "depends_on", label: "Depends on" },
  { key: "defines",    label: "Defines" },
  { key: "contains",   label: "Contains" }
];

const NODE_TYPE_DEFS: Array<{ key: string; label: string }> = [
  { key: "entry_point", label: "Entry point" },
  { key: "file",        label: "File" },
  { key: "function",    label: "Function" },
  { key: "class",       label: "Class" }
];

export function GraphCanvas({ repository, preMortem, intent = "twin" }: GraphCanvasProps) {
  const containerRef     = useRef<HTMLDivElement | null>(null);
  const minimapRef       = useRef<HTMLCanvasElement | null>(null);
  const graphologyRef    = useRef<SigmaGraph>();
  const rendererRef      = useRef<Sigma<SigmaNodeAttributes, SigmaEdgeAttributes>>();
  const requestSeq       = useRef(0);
  const detailSeq        = useRef(0);

  const [graph,            setGraph]            = useState<GraphView>();
  const [selected,         setSelected]         = useState<GraphNode>();
  const [hoveredId,        setHoveredId]        = useState<string>();
  const [summary,          setSummary]          = useState<NodeSummary>();
  const [summaryLoading,   setSummaryLoading]   = useState(false);
  const [nodeContext,      setNodeContext]       = useState<NodeContext>();
  const [nodeSource,       setNodeSource]       = useState<NodeSource>();
  const [detailLoading,    setDetailLoading]    = useState(false);
  const [detailError,      setDetailError]      = useState<string>();
  const [detailTab,        setDetailTab]        = useState<DetailTab>("risk");
  const [question,         setQuestion]         = useState("");
  const [quickSearch,      setQuickSearch]      = useState("");
  const [impactText,       setImpactText]       = useState("");
  const [impactResult,     setImpactResult]     = useState<PreMortemResult>();
  const [lastQuestions,    setLastQuestions]    = useState<string[]>([]);
  const [entryPoints,      setEntryPoints]      = useState<GraphNode[]>([]);
  const [overviewNodes,    setOverviewNodes]    = useState<GraphNode[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [entryPointsLoading, setEntryPointsLoading] = useState(false);
  const [error,            setError]            = useState<string>();
  const [lastLoader,       setLastLoader]       = useState<(() => Promise<GraphView>) | null>(null);
  const [mode,             setMode]             = useState<TwinMode>(intent === "impact" ? "impact" : "overview");
  const [depth,            setDepth]            = useState(2);
  const [centeredLabel,    setCenteredLabel]    = useState("Home");
  const [breadcrumbs,      setBreadcrumbs]      = useState<Array<{ id: string; name: string }>>([]);
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]);
  const [nodeTypes,        setNodeTypes]        = useState<string[]>([]);
  const [riskFilter,       setRiskFilter]       = useState<"all" | "risky">("all");
  const [highlightPath,    setHighlightPath]    = useState<GraphPath>();
  const [pathLoading,      setPathLoading]      = useState(false);
  const [severityByNode,   setSeverityByNode]   = useState<Map<string, Risk>>(new Map());
  const [savedViews,       setSavedViews]       = useState<SavedTwinView[]>(() => loadSavedViews());
  const [annotations,      setAnnotations]      = useState<Record<string, string>>(() => loadAnnotations());
  const [showRelCount,     setShowRelCount]     = useState(12);
  const [copiedSnippet,    setCopiedSnippet]    = useState(false);
  const [advancedOpen,     setAdvancedOpen]     = useState(false);
  const [backendSearchResults, setBackendSearchResults] = useState<GraphNode[]>([]);
  const [backendSearchLoading, setBackendSearchLoading] = useState(false);

  const repoName = repository?.url.split("/").filter(Boolean).slice(-1)[0] ?? "No repository";

  const visibleGraph = useMemo(
    () => filterGraph(graph, relationshipTypes, nodeTypes, riskFilter, severityByNode, selected?.id),
    [graph, relationshipTypes, nodeTypes, riskFilter, severityByNode, selected?.id]
  );
  const visibleNodeIds   = useMemo(() => new Set(visibleGraph.nodes.map(n => n.id)), [visibleGraph.nodes]);
  const quickCandidates  = useMemo(() => uniqueNodes([...(graph?.nodes ?? []), ...entryPoints, ...overviewNodes]), [graph, entryPoints, overviewNodes]);
  const quickResults     = useMemo(() => searchNodes(quickSearch, quickCandidates, severityByNode), [quickSearch, quickCandidates, severityByNode]);
  const connectedNodes   = useMemo(() => selected ? connectedNodeList(selected.id, graph, visibleGraph.edges) : [], [graph, selected, visibleGraph.edges]);
  const graphStats       = useMemo(() => summarizeNodes(visibleGraph.nodes, severityByNode), [visibleGraph.nodes, severityByNode]);
  const viewNarrative    = useMemo(
    () => explainCurrentView(mode, visibleGraph, centeredLabel, selected, impactResult, graphStats),
    [mode, visibleGraph, centeredLabel, selected, impactResult, graphStats]
  );
  const highlightedNodeIds = useMemo(() => new Set(highlightPath?.nodes.map(n => n.id) ?? []), [highlightPath]);
  const highlightedEdgeIds = useMemo(() => new Set(highlightPath?.edges.map(e => e.id) ?? []), [highlightPath]);

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

  // Preload entry points and overview nodes when repository changes
  useEffect(() => {
    if (!repository) {
      setEntryPoints([]);
      setOverviewNodes([]);
      setEntryPointsLoading(false);
      return;
    }
    const current = ++requestSeq.current;
    setEntryPointsLoading(true);
    Promise.allSettled([
      api.askGraph(repository.id, "What are the entry points?"),
      api.graphOverview(repository.id)
    ]).then(([entryResult, overviewResult]) => {
      if (current !== requestSeq.current) return;
      if (entryResult.status === "fulfilled") {
        setEntryPoints(
          entryResult.value.nodes
            .filter(n => n.isEntryPoint || n.type === "entry_point")
            .slice(0, 10)
        );
      }
      if (overviewResult.status === "fulfilled") {
        setOverviewNodes(overviewResult.value.nodes.slice(0, 15));
      }
    }).finally(() => {
      if (current === requestSeq.current) setEntryPointsLoading(false);
    });
  }, [repository?.id]);

  useEffect(() => {
    if (!graph) setMode(intent === "impact" ? "impact" : "overview");
  }, [intent, graph]);

  // Backend search fallback when local results are empty
  useEffect(() => {
    if (!quickSearch.trim() || !repository || quickResults.length > 0) {
      setBackendSearchResults([]);
      setBackendSearchLoading(false);
      return;
    }
    setBackendSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const view = await api.askGraph(repository.id, quickSearch);
        setBackendSearchResults(view.nodes.slice(0, 8));
      } catch {
        setBackendSearchResults([]);
      } finally {
        setBackendSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [quickSearch, repository?.id, quickResults.length]);

  // Load detail when node is selected
  useEffect(() => {
    if (!selected || !repository) return;
    const current = ++detailSeq.current;
    setSummary(undefined);
    setNodeContext(undefined);
    setNodeSource(undefined);
    setDetailError(undefined);
    setHighlightPath(undefined);
    setDetailTab("risk");
    setSummaryLoading(true);
    setDetailLoading(true);
    setShowRelCount(12);

    api.nodeSummary(repository.id, selected.id)
      .then(res => { if (current === detailSeq.current) setSummary(res); })
      .catch(err => {
        if (current === detailSeq.current)
          setSummary({ nodeId: selected.id, summary: humanError(err, "Summary unavailable.") });
      })
      .finally(() => { if (current === detailSeq.current) setSummaryLoading(false); });

    Promise.all([
      api.nodeContext(repository.id, selected.id),
      api.nodeSource(repository.id, selected.id)
    ])
      .then(([context, source]) => {
        if (current !== detailSeq.current) return;
        setNodeContext(context);
        setNodeSource(source);
      })
      .catch(err => {
        if (current === detailSeq.current)
          setDetailError(humanError(err, "Node intelligence unavailable."));
      })
      .finally(() => { if (current === detailSeq.current) setDetailLoading(false); });
  }, [selected?.id, repository?.id]);

  // Apply pre-mortem severity to graph nodes
  useEffect(() => {
    if (!preMortem || !graph) return;
    const next = new Map(severityByNode);
    for (const finding of preMortem.findings) {
      for (const node of graph.nodes) {
        if (node.path === finding.filePath) next.set(node.id, finding.severity);
      }
    }
    setSeverityByNode(next);
    setImpactResult(preMortem);
    setMode("impact");
  }, [preMortem?.changeId]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearGraph();
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setAdvancedOpen(true);
        window.setTimeout(() => {
          (document.getElementById("twin-symbol-search") as HTMLInputElement | null)?.focus();
        }, 0);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Rebuild Sigma graph when visibleGraph changes
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
      allowInvalidContainer:         true,
      autoCenter:                    true,
      autoRescale:                   true,
      defaultNodeColor:              "#4A90D9",
      defaultEdgeColor:              "#343b4a",
      enableEdgeEvents:              true,
      hideEdgesOnMove:               false,
      hideLabelsOnMove:              true,
      inertiaDuration:               260,
      inertiaRatio:                  0.82,
      labelColor:                    { color: "#eef3ff" },
      labelDensity:                  0.12,
      labelFont:                     "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      labelRenderedSizeThreshold:    visibleGraph.nodes.length > 20 ? 10 : visibleGraph.nodes.length > 12 ? 8 : 6,
      labelSize:                     12,
      minCameraRatio:                0.12,
      maxCameraRatio:                4.0,
      renderEdgeLabels:              false,
      renderLabels:                  true,
      stagePadding:                  80,
      zIndex:                        true,
      defaultDrawNodeLabel:          drawTwinNodeLabel,
      defaultDrawNodeHover:          drawTwinNodeHover,
      nodeReducer: (node, data) => reduceNode(node, data, {
        hoveredId,
        selectedId:          selected?.id,
        connectedIds:        connectedIdsForHover,
        highlightedNodeIds,
        severityByNode
      }),
      edgeReducer: (edge, data) => reduceEdge(edge, data, {
        hoveredId,
        selectedId:          selected?.id,
        highlightedEdgeIds,
        highlightedNodeIds
      })
    });

    rendererRef.current = renderer;

    renderer.on("enterNode", ({ node }) => setHoveredId(node));
    renderer.on("leaveNode",  ()          => setHoveredId(undefined));
    renderer.on("clickNode",  ({ node })  => {
      const graphNode = sigmaGraph.getNodeAttribute(node, "node");
      centerNode(graphNode);
    });
    renderer.on("clickEdge",  ({ edge })  => {
      const graphEdge = sigmaGraph.getEdgeAttribute(edge, "edge");
      const source    = visibleGraph.nodes.find(n => n.id === graphEdge.source);
      const target    = visibleGraph.nodes.find(n => n.id === graphEdge.target);
      if (source && target) {
        const next = source.id === selected?.id ? target : source;
        setSelected(next);
        void explainConnection(next);
      }
    });
    renderer.on("clickStage", () => setHoveredId(undefined));

    setTimeout(() => {
      renderer.getCamera().animatedReset({ duration: 380 });
      drawMinimap(minimapRef.current, sigmaGraph);
    }, 80);

    return () => {
      renderer.kill();
      if (rendererRef.current === renderer) rendererRef.current = undefined;
    };
  }, [visibleGraph, selected?.id, severityByNode]);

  // Update reducers on hover/selection/highlight changes without rebuilding
  useEffect(() => {
    rendererRef.current?.setSettings({
      nodeReducer: (node, data) => reduceNode(node, data, {
        hoveredId,
        selectedId:          selected?.id,
        connectedIds:        connectedIdsForHover,
        highlightedNodeIds,
        severityByNode
      }),
      edgeReducer: (edge, data) => reduceEdge(edge, data, {
        hoveredId,
        selectedId:          selected?.id,
        highlightedEdgeIds,
        highlightedNodeIds
      })
    });
    rendererRef.current?.refresh();
  }, [hoveredId, selected?.id, connectedIdsForHover, highlightedEdgeIds, highlightedNodeIds, severityByNode]);

  const loadGraph = useCallback(async (
    loader: () => Promise<GraphView>,
    options: {
      remember?: string;
      centeredLabel?: string;
      selectedId?: string;
      clearSelection?: boolean;
      mode?: TwinMode;
    } = {}
  ) => {
    if (!repository) {
      setError("Ingest a repository before exploring the twin.");
      return;
    }
    setLastLoader(() => loader);
    const current = ++requestSeq.current;
    setLoading(true);
    setError(undefined);
    try {
      const view    = await loader();
      if (current !== requestSeq.current) return;
      const cleaned = enforceContextualGraph(view);
      setGraph(cleaned);
      setMode(options.mode ?? "neighborhood");
      setCenteredLabel(options.centeredLabel ?? readableCenter(cleaned));
      setSeverityByNode(
        new Map(
          cleaned.nodes
            .map(n => [n.id, n.risk] as [string, Risk])
            .filter(([, r]) => r !== "none")
        )
      );
      if (options.clearSelection) {
        setSelected(undefined);
      } else if (options.selectedId) {
        setSelected(cleaned.nodes.find(n => n.id === options.selectedId));
      }
      if (options.remember) {
        setLastQuestions(qs =>
          [options.remember!, ...qs.filter(q => q !== options.remember)].slice(0, 4)
        );
      }
    } catch (err) {
      if (current === requestSeq.current) setError(humanError(err, "Graph request failed."));
    } finally {
      if (current === requestSeq.current) setLoading(false);
    }
  }, [repository]);

  const retryLastLoad = () => {
    if (!lastLoader) return;
    void loadGraph(lastLoader);
  };

  const askQuestion = (event?: FormEvent, text = question.trim()) => {
    event?.preventDefault();
    if (!text || !repository) return;
    void loadGraph(
      () => api.askGraph(repository.id, text),
      { remember: text, centeredLabel: text, clearSelection: true, mode: classifyQuestion(text) }
    );
  };

  const runQuickSearch = () => {
    const term = quickSearch.trim();
    if (!term || !repository) return;
    if (quickResults[0]) {
      centerNode(quickResults[0]);
      return;
    }
    setQuestion(term);
    void loadGraph(
      () => api.askGraph(repository.id, term),
      { remember: term, centeredLabel: term, clearSelection: true, mode: "search" }
    );
  };

  const showOverview = () => {
    if (!repository) return;
    void loadGraph(
      () => api.graphOverview(repository.id),
      { remember: "Architecture overview", centeredLabel: "architecture overview", clearSelection: true, mode: "overview" }
    );
  };

  const showEntryGraph = (node: GraphNode) => centerNode(node, 2, "entry");

  const centerNode = (node: GraphNode, nextDepth = depth, nextMode: TwinMode = "neighborhood") => {
    if (!repository) return;
    setSelected(node);
    setCenteredLabel(node.name);
    setBreadcrumbs(trail =>
      [...trail.filter(b => b.id !== node.id), { id: node.id, name: node.name }].slice(-5)
    );
    void loadGraph(
      () => api.queryGraph(repository.id, { type: "node", value: node.id }, nextDepth, relationshipTypes),
      { centeredLabel: node.name, selectedId: node.id, mode: nextMode }
    );
  };

  const revisitBreadcrumb = (crumb: { id: string; name: string }) => {
    const node = graph?.nodes.find(n => n.id === crumb.id);
    if (node) centerNode(node);
  };

  const showImpact = async () => {
    if (!repository) return;
    if (!impactText.trim()) {
      setError("Describe the planned change first.");
      return;
    }
    await runImpactAnalysis(impactText.trim(), selected?.id ?? impactText.trim(), selected?.name ?? "planned change");
  };

  const runImpactAnalysis = async (summary: string, targetRef: string, label: string) => {
    if (!repository) return;
    const current = ++requestSeq.current;
    setLoading(true);
    setError(undefined);
    setImpactResult(undefined);
    try {
      const [premortem, view] = await Promise.all([
        api.runPremortem(repository.id, summary, [targetRef]),
        api.blastRadius(repository.id, summary, [targetRef], Math.min(3, Math.max(depth, 2)), relationshipTypes)
      ]);
      if (current !== requestSeq.current) return;
      const cleaned = enforceContextualGraph(view);
      const nextSeverity = new Map<string, Risk>();
      for (const node of cleaned.nodes) nextSeverity.set(node.id, node.risk);
      for (const finding of premortem.findings) {
        const match = cleaned.nodes.find(n => n.path === finding.filePath);
        if (match) nextSeverity.set(match.id, finding.severity);
      }
      setGraph(cleaned);
      setMode("impact");
      setCenteredLabel(label);
      setSeverityByNode(nextSeverity);
      setImpactResult(premortem);
      setAdvancedOpen(false);
      if (!premortem.findings.length && premortem.evidenceGaps.length) {
        setError(`Impact analysis needs more evidence: ${premortem.evidenceGaps[0]}`);
      }
    } catch (err) {
      setError(humanError(err, "Impact analysis failed."));
    } finally {
      if (current === requestSeq.current) setLoading(false);
    }
  };

  const assessSelectedNode = () => {
    if (!selected) return;
    const summary = `Change ${selected.name}${selected.path ? ` in ${selected.path}` : ""}`;
    setImpactText(summary);
    void runImpactAnalysis(summary, selected.id, selected.name);
  };

  const changeDepth = (delta: number) => {
    const next = Math.max(1, Math.min(4, depth + delta));
    setDepth(next);
    if (selected) centerNode(selected, next);
  };

  const clearGraph = () => {
    requestSeq.current += 1;
    rendererRef.current?.kill();
    rendererRef.current  = undefined;
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
    setImpactResult(undefined);
    setError(undefined);
    setLastLoader(null);
  };

  const zoomCanvas = (direction: "in" | "out") => {
    const camera = rendererRef.current?.getCamera();
    if (!camera) return;
    const cur = camera.getState();
    camera.animate({ ratio: cur.ratio * (direction === "in" ? 0.7 : 1.35) }, { duration: 180 });
  };

  const fitCanvas = () => rendererRef.current?.getCamera().animatedReset({ duration: 300 });

  const saveCurrentView = () => {
    if (!graph) return;
    const view: SavedTwinView = {
      id:            `${Date.now()}`,
      name:          centeredLabel,
      graph,
      mode,
      centeredLabel,
      selectedId:    selected?.id
    };
    setSavedViews(cur =>
      persistSavedViews([view, ...cur.filter(v => v.name !== view.name)].slice(0, 8))
    );
  };

  const restoreSavedView = (view: SavedTwinView) => {
    setGraph(view.graph);
    setMode(view.mode);
    setCenteredLabel(view.centeredLabel);
    setSelected(view.selectedId ? view.graph.nodes.find(n => n.id === view.selectedId) : undefined);
  };

  const updateAnnotation = (nodeId: string, value: string) => {
    setAnnotations(cur => persistAnnotations({ ...cur, [nodeId]: value }));
  };

  const copySnippet = async () => {
    if (!nodeSource?.snippet) return;
    try {
      await navigator.clipboard.writeText(nodeSource.snippet);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch { /* ignore */ }
  };

  async function explainConnection(target: GraphNode) {
    if (!repository || !selected || target.id === selected.id) return;
    setPathLoading(true);
    setDetailError(undefined);
    setDetailTab("evidence");
    try {
      const path = await api.graphPath(
        repository.id, selected.id, target.id, relationshipTypes, Math.max(4, depth + 1)
      );
      setHighlightPath(path);
      setGraph(cur => cur ? mergePathIntoGraph(cur, path) : cur);
    } catch (err) {
      setDetailError(humanError(err, "No evidence path found between these nodes."));
    } finally {
      setPathLoading(false);
    }
  }

  const allRelGroups = nodeContext?.relationshipGroups ?? [];
  const visibleRelGroups = allRelGroups.flatMap(g => g.nodes).length;

  return (
    <section className={`hf-d3-page hf-twin-page intent-${intent} ${selected ? "has-selection" : ""}`}>

      {/* ── LEFT SIDEBAR ────────────────────────────────────────── */}
      <aside className="hf-d3-sidebar hf-twin-intent" aria-label="Twin controls">

        <div className="hf-d3-sidebar-head">
          <div>
            <h2>{intent === "impact" ? "Impact" : "Code Twin"}</h2>
            <span className="hf-twin-repo-name" title={repository?.url ?? ""}>{repoName}</span>
          </div>
          <span className={`hf-d3-mode ${mode}`} title={`Current exploration mode: ${mode}`}>{mode}</span>
        </div>

        <form className="hf-d3-section hf-d3-primary-intent hf-d3-ask-intent" onSubmit={askQuestion}>
          <label>
            1. Ask what you want to understand
            <span className="hf-d3-help-tip" title="Ask a plain-English question about the codebase architecture.">
              <Info size={11} />
            </span>
          </label>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                askQuestion();
              }
            }}
            placeholder={"Try: What handles routing? What are the entry points?"}
            rows={2}
          />
          <button
            type="submit"
            disabled={!repository || loading || !question.trim()}
            className="hf-d3-primary-btn"
          >
            <Sparkles size={13} /> Ask →
            <span className="hf-d3-kbd">⌘↵</span>
          </button>
          {lastQuestions.length > 0 && (
            <div className="hf-d3-chips" aria-label="Recent questions">
              {lastQuestions.map(q => (
                <button type="button" key={q} onClick={() => askQuestion(undefined, q)} title={q}>
                  {q.length > 36 ? q.slice(0, 33) + "…" : q}
                </button>
              ))}
            </div>
          )}
        </form>

        <section className="hf-d3-section hf-d3-primary-intent hf-d3-entry-intent">
          <label>2. Start from an entry point</label>
          <p className="hf-d3-section-hint">Trace how execution enters the system.</p>
          <div className="hf-d3-entry-list" role="list">
            {entryPoints.length > 0
              ? entryPoints.map(node => (
                  <button type="button" key={node.id} role="listitem" onClick={() => showEntryGraph(node)}>
                    <span style={{ color: NODE_STYLE.entry_point.stroke }}>●</span>
                    {node.name}
                    <small>{node.path ? truncatePath(node.path, 22) : ""}</small>
                  </button>
                ))
              : entryPointsLoading && repository
                ? <div className="hf-d3-skeleton" aria-label="Detecting entry points…" style={{ height: "2.5rem" }} />
                : <span className="hf-d3-empty-hint">{repository ? "No entry points detected yet." : "Ingest a repository first."}</span>
            }
          </div>
        </section>

        <section className="hf-d3-section hf-d3-primary-intent hf-d3-impact-planner">
          <label>3. Assess a planned change</label>
          <p className="hf-d3-section-hint">Describe the change. HelixFactory will show risk, blast radius, and evidence.</p>
          <textarea
            value={impactText}
            onChange={e => setImpactText(e.target.value)}
            placeholder="Example: Modify Flask request dispatch"
            rows={3}
          />
          <button
            type="button"
            disabled={!repository || loading || !impactText.trim()}
            onClick={showImpact}
            className="hf-d3-primary-btn"
          >
            <AlertTriangle size={13} /> Show what breaks
          </button>
        </section>

        <details
          className="hf-d3-section hf-d3-disclosure hf-d3-advanced-tools"
          open={advancedOpen}
          onToggle={e => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary>Advanced tools</summary>

          <div className="hf-d3-filter-section hf-d3-quick-search">
            <label htmlFor="twin-symbol-search">
              Exact symbol search
              <span className="hf-d3-help-tip" title="Type a function, class, or file name. Results appear instantly from loaded nodes.">
                <Info size={11} />
              </span>
            </label>
            <div>
              <Search size={13} />
              <input
                id="twin-symbol-search"
                value={quickSearch}
                onChange={e => setQuickSearch(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); runQuickSearch(); } }}
                placeholder="dispatch_request, app.py, auth…"
                autoComplete="off"
                spellCheck={false}
              />
              {quickSearch && (
                <button
                  type="button"
                  className="hf-d3-clear-search"
                  onClick={() => setQuickSearch("")}
                  aria-label="Clear search"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            {quickSearch && quickResults.length === 0 && !backendSearchLoading && backendSearchResults.length === 0 && (
              <p className="hf-d3-search-empty">No local match — press Enter to ask the twin.</p>
            )}
            {quickSearch && quickResults.length === 0 && backendSearchLoading && (
              <p className="hf-d3-search-loading">Searching full graph…</p>
            )}
            {(quickResults.length > 0 || backendSearchResults.length > 0) && (
              <div className="hf-d3-search-results" role="listbox" aria-label="Search results">
                {(quickResults.length > 0 ? quickResults : backendSearchResults).slice(0, 6).map(node => (
                  <button
                    type="button"
                    key={node.id}
                    role="option"
                    aria-selected={selected?.id === node.id}
                    onClick={() => { centerNode(node); setQuickSearch(""); setBackendSearchResults([]); }}
                  >
                    <span className="hf-d3-node-icon" style={{ color: styleFor(node).stroke }}>
                      {styleFor(node).icon}
                    </span>
                    <strong>{node.name}</strong>
                    <small>{node.path ? truncatePath(node.path, 30) : node.type}</small>
                    {(severityByNode.get(node.id) === "critical" || severityByNode.get(node.id) === "high") && (
                      <span className="hf-d3-risk-dot" aria-label="Has risk" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hf-d3-filter-section">
            <span className="hf-d3-filter-label">Architecture overview</span>
            <button
              type="button"
              onClick={showOverview}
              disabled={!repository || loading}
              className="hf-d3-primary-btn"
            >
              <Network size={13} /> Load architecture spine
            </button>
            {overviewNodes.length > 0 && (
              <div className="hf-d3-god-list" aria-label="Architecture overview nodes">
                {uniqueNodesByName(uniqueNodes(overviewNodes)).slice(0, 5).map(node => (
                  <button type="button" key={node.id} onClick={() => centerNode(node)} title={node.path ?? node.type}>
                    <span className="hf-d3-node-icon" style={{ color: styleFor(node).stroke }}>
                      {styleFor(node).icon}
                    </span>
                    <span>{node.name}</span>
                    <small className="hf-d3-conn-count">{node.connectionCount}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hf-d3-filter-section">
            <span className="hf-d3-filter-label">Exploration mode</span>
            <div className="hf-d3-mode-grid">
              {(["overview","entry","neighborhood","impact","review","memory"] as TwinMode[]).map(m => (
                <button
                  key={m}
                  className={mode === m ? "active" : ""}
                  type="button"
                  onClick={() => setMode(m)}
                  title={MODE_DESCRIPTIONS[m]}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="hf-d3-filter-section">
            <span className="hf-d3-filter-label">Relationship types</span>
            <div className="hf-d3-filter-grid">
              <button
                className={relationshipTypes.length === 0 ? "active" : ""}
                type="button"
                onClick={() => setRelationshipTypes([])}
              >
                <span style={{ background: "#d8dee9" }} />
                All types
              </button>
              {EDGE_TYPES_WITH_COLORS.map(({ key, label }) => (
                <button
                  className={relationshipTypes.length === 0 || relationshipTypes.includes(key) ? "active" : ""}
                  key={key}
                  type="button"
                  onClick={() =>
                    setRelationshipTypes(cur =>
                      cur.includes(key) ? cur.filter(r => r !== key) : [...cur, key]
                    )
                  }
                >
                  <span style={{ background: EDGE_COLOR[key] ?? "#555" }} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="hf-d3-filter-section">
            <span className="hf-d3-filter-label">Node types</span>
            <div className="hf-d3-filter-grid">
              <button
                className={nodeTypes.length === 0 ? "active" : ""}
                type="button"
                onClick={() => setNodeTypes([])}
              >
                <span style={{ background: "#d8dee9" }} />
                All types
              </button>
              {NODE_TYPE_DEFS.map(({ key, label }) => (
                <button
                  className={nodeTypes.length === 0 || nodeTypes.includes(key) ? "active" : ""}
                  key={key}
                  type="button"
                  onClick={() =>
                    setNodeTypes(cur =>
                      cur.includes(key) ? cur.filter(t => t !== key) : [...cur, key]
                    )
                  }
                >
                  <span style={{ background: NODE_STYLE[key]?.stroke ?? "#555" }} />
                  {label}
                </button>
              ))}
              <button
                className={riskFilter === "risky" ? "active" : ""}
                type="button"
                onClick={() => setRiskFilter(v => v === "risky" ? "all" : "risky")}
              >
                <span style={{ background: "#F39C12" }} />
                Risk-marked only
              </button>
            </div>
          </div>

          <div className="hf-d3-filter-section">
            <span className="hf-d3-filter-label">Saved views</span>
            <button
              type="button"
              onClick={saveCurrentView}
              disabled={!graph}
            >
              <BookOpen size={13} /> Save current view
            </button>
            {savedViews.length > 0 && (
              <div className="hf-d3-god-list">
                {savedViews.map(view => (
                  <button
                    type="button"
                    key={view.id}
                    onClick={() => restoreSavedView(view)}
                    title={`Restore: ${view.name} (${view.graph.nodes.length} nodes)`}
                  >
                    <span>{view.name}</span>
                    <small className="hf-d3-conn-count">{view.graph.nodes.length}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </details>

      </aside>

      {/* ── MAIN CANVAS ─────────────────────────────────────────── */}
      <div className="hf-d3-main hf-twin-main">

        {/* Status bar */}
        <div className="hf-d3-status" role="status" aria-live="polite">
          <span className="hf-d3-status-text">
            {graph
              ? `Viewing ${centeredLabel} — ${visibleGraph.nodes.length} related nodes, ${visibleGraph.edges.length} relationships, depth ${depth}`
              : "Start by asking a question or choosing an entry point"}
          </span>
          <nav className="hf-d3-breadcrumb" aria-label="Navigation history">
            <button type="button" onClick={clearGraph} className="hf-d3-crumb-home">
              Home
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id} className="hf-d3-crumb-item">
                <ChevronRight size={11} />
                <button type="button" onClick={() => revisitBreadcrumb(crumb)}
                  className={i === breadcrumbs.length - 1 ? "hf-d3-crumb-active" : ""}>
                  {crumb.name}
                </button>
              </span>
            ))}
          </nav>
          {selected && (
            <button
              type="button"
              className="hf-d3-what-breaks"
              onClick={() => askQuestion(undefined, `What breaks if I change ${selected.name}?`)}
              title={`What breaks if I change ${selected.name}?`}
            >
              <AlertTriangle size={11} /> What breaks?
            </button>
          )}
          <div className="hf-d3-depth-controls">
            <button type="button" onClick={() => changeDepth(-1)} disabled={depth <= 1} aria-label="Decrease depth">−</button>
            <span className="hf-depth-label" aria-label={`Graph depth: ${depth}`}>Depth {depth}</span>
            <button type="button" onClick={() => changeDepth(1)}  disabled={depth >= 4} aria-label="Increase depth">+</button>
            <button type="button" onClick={clearGraph} aria-label="Clear graph" className="hf-d3-clear-btn">
              <RotateCcw size={12} /> Clear
            </button>
          </div>
        </div>

        {graph && (
          <section className="hf-twin-narrative" aria-label="Current graph explanation">
            <div>
              <span className="hf-twin-narrative-kicker">{viewNarrative.kicker}</span>
              <strong>{viewNarrative.title}</strong>
              <p>{viewNarrative.body}</p>
            </div>
            <div className="hf-twin-narrative-actions">
              {selected ? (
                <>
                  <button type="button" onClick={assessSelectedNode} disabled={loading}>
                    <AlertTriangle size={12} /> Assess impact
                  </button>
                  <button type="button" onClick={() => askQuestion(undefined, `Explain ${selected.name} and why it matters`)}>
                    <Sparkles size={12} /> Explain node
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={showOverview} disabled={loading}>
                    <Network size={12} /> Refresh overview
                  </button>
                  <button type="button" onClick={() => askQuestion(undefined, "What should I inspect first?")}>
                    <Sparkles size={12} /> Guide me
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {impactResult && (
          <ImpactSummary result={impactResult} graphStats={graphStats} />
        )}

        {/* Insight bar — only when graph is loaded */}
        {graph && !impactResult && (
          <div className={`hf-d3-insight-bar${mode === "impact" ? " mode-impact" : ""}`} aria-label="Graph statistics">
            {mode === "impact" && (
              <span title="Impact analysis is active — nodes colored by risk severity" style={{ color: "var(--hf-amber)" }}>
                <AlertTriangle size={11} /> Impact analysis active
              </span>
            )}
            {mode === "search" && lastQuestions[0] && (
              <span title={lastQuestions[0]} style={{ maxWidth: "20rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <Search size={11} /> {lastQuestions[0]}
              </span>
            )}
            {mode === "entry" && (
              <span title="Tracing from entry point">
                <span style={{ color: NODE_STYLE.entry_point.stroke }}>●</span> Entry point trace
              </span>
            )}
            {graphStats.entryPoints > 0 && mode !== "entry" && (
              <span title={`${graphStats.entryPoints} entry points`}>
                <span style={{ color: NODE_STYLE.entry_point.stroke }}>●</span>
                {graphStats.entryPoints} entry
              </span>
            )}
            <span title={`${graphStats.files} files`}>▣ {graphStats.files} files</span>
            <span title={`${graphStats.functions} functions`}>ƒ {graphStats.functions} fn</span>
            {graphStats.classes > 0 && (
              <span title={`${graphStats.classes} classes`}>◇ {graphStats.classes} cls</span>
            )}
            {graphStats.subsystems > 1 && (
              <span title={`${graphStats.subsystems} subsystems detected`}>◈ {graphStats.subsystems} subsystems</span>
            )}
            {graphStats.risky > 0 && (
              <button
                type="button"
                className="hf-d3-insight-risk-chip risk"
                title={`${graphStats.risky} nodes with risk marking — click to filter`}
                onClick={() => setRiskFilter(v => v === "risky" ? "all" : "risky")}
                style={{ cursor: "pointer" }}
              >
                <AlertTriangle size={11} /> {graphStats.risky} at risk
              </button>
            )}
          </div>
        )}

        {/* Canvas */}
        <div className={`hf-d3-canvas hf-sigma-canvas${visibleGraph.nodes.some(n => (severityByNode.get(n.id) ?? n.risk) === "critical") ? " hf-twin-has-critical" : ""}`}>
          <div ref={containerRef} className="hf-sigma-stage" aria-label="Repository architecture graph" role="img" />

          {!graph && !loading && (
            <EmptyState
              repository={repository}
              onAsk={text => askQuestion(undefined, text)}
              onOverview={showOverview}
              entryPoints={entryPoints}
              onEntry={showEntryGraph}
              lastQuestions={lastQuestions}
              intent={intent}
            />
          )}

          {loading && (
            <div className="hf-d3-loading" role="status" aria-live="polite">
              <span className="hf-d3-loading-dot" />
              Loading contextual graph…
            </div>
          )}

          {error && !loading && (
            <div className="hf-d3-error" role="alert">
              <AlertTriangle size={14} />
              <span>{error}</span>
              {lastLoader && (
                <button type="button" onClick={retryLastLoad} className="hf-d3-retry-btn">
                  <RefreshCw size={12} /> Retry
                </button>
              )}
            </div>
          )}

          {graph && (
            <>
              {/* Zoom / fit controls */}
              <div className="hf-d3-canvas-controls" aria-label="Viewport controls">
                <button type="button" onClick={() => zoomCanvas("in")}  aria-label="Zoom in"><ZoomIn  size={13} /></button>
                <button type="button" onClick={() => zoomCanvas("out")} aria-label="Zoom out"><ZoomOut size={13} /></button>
                <button type="button" onClick={fitCanvas}               aria-label="Fit all nodes"><Maximize2 size={13} /></button>
                <button type="button" onClick={clearGraph}              aria-label="Reset graph"><RotateCcw  size={13} /></button>
              </div>

              {/* Legend */}
              <div className="hf-d3-legend" aria-label="Node type legend">
                {Object.entries(NODE_STYLE)
                  .filter(([type]) => type !== "repository")
                  .map(([type, style]) => (
                    <span key={type}>
                      <i style={{ background: style.stroke }} />
                      {style.label}
                    </span>
                  ))}
                <span><i style={{ background: "#ffffff" }} />Selected</span>
                {graphStats.risky > 0 && (
                  <span><i style={{ background: "#E74C3C" }} />Risk-marked</span>
                )}
              </div>

              {/* Minimap */}
              <canvas
                ref={minimapRef}
                className="hf-d3-minimap hf-sigma-minimap"
                width="160"
                height="100"
                aria-label="Graph minimap overview"
                title="Minimap — overview of all graph nodes"
                aria-hidden="true"
              />
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT DETAIL PANEL ──────────────────────────────────── */}
      {selected && (
        <aside className="hf-d3-detail hf-twin-detail" aria-label={`Node details: ${selected.name}`}>
          <button
            className="hf-d3-close"
            type="button"
            onClick={() => setSelected(undefined)}
            aria-label="Close node details"
          >
            <X size={15} />
          </button>

          {/* Node header */}
          <div className="hf-d3-detail-head">
            <div>
              <h2 title={selected.name}>{selected.name}</h2>
              <p className="hf-d3-detail-path" title={selected.path ?? "Repository node"}>
                {selected.path ? truncatePath(selected.path, 48) : "Repository node"}
              </p>
            </div>
            <span
              className="hf-d3-type"
              style={{ borderColor: styleFor(selected).stroke, color: styleFor(selected).stroke }}
            >
              {styleFor(selected).icon} {NODE_STYLE[selected.type]?.label ?? selected.type}
            </span>
          </div>

          {/* Node meta — horizontal inline chips */}
          <div className="hf-d3-node-meta-row" role="list" aria-label="Node metadata">
            {selected.startLine != null && (
              <span className="hf-d3-meta-chip" title="Source line range">
                :{selected.startLine}–{selected.endLine ?? selected.startLine}
              </span>
            )}
            <span className="hf-d3-meta-chip" title="Direct connections in current view">
              {connectedNodes.length} links
            </span>
            {(selected.owner ?? selected.lastModifiedBy) && (
              <span className="hf-d3-meta-chip" title="Code owner">
                👤 {selected.owner ?? selected.lastModifiedBy}
              </span>
            )}
            {selected.lastModifiedAt && (
              <span className="hf-d3-meta-chip" title="Last modified">
                {formatDate(selected.lastModifiedAt)}
              </span>
            )}
            {(severityByNode.get(selected.id) ?? selected.risk) !== "none" && (
              <span
                className={`hf-d3-meta-chip hf-d3-risk-chip risk-${severityByNode.get(selected.id) ?? selected.risk}`}
              >
                <AlertTriangle size={10} />
                {SEVERITY_LABEL[severityByNode.get(selected.id) ?? selected.risk] ?? selected.risk}
              </span>
            )}
          </div>

          {/* Tabs */}
          <div className="hf-d3-detail-tabs" role="tablist" aria-label="Node intelligence sections">
            {DETAIL_TABS.map(({ tab, icon: Icon, label, title }) => (
              <button
                className={detailTab === tab ? "active" : ""}
                type="button"
                key={tab}
                role="tab"
                aria-selected={detailTab === tab}
                aria-controls={`twin-tab-${tab}`}
                onClick={() => setDetailTab(tab)}
                title={title}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {detailError && (
            <div className="hf-d3-detail-error" role="alert">
              <AlertTriangle size={13} /> {detailError}
            </div>
          )}

          {/* ── SUMMARY TAB ── */}
          {detailTab === "summary" && (
            <section id="twin-tab-summary" role="tabpanel" aria-labelledby="tab-summary">
              <h3>Plain-English summary</h3>
              {summaryLoading
                ? <div className="hf-d3-skeleton" aria-label="Loading summary" />
                : <p className="hf-d3-summary-text">{summary?.summary ?? "No summary available."}</p>
              }
              <div className="hf-d3-quick-actions">
                <button
                  type="button"
                  onClick={() => { setImpactText(`Change ${selected.name}`); setAdvancedOpen(false); }}
                >
                  <AlertTriangle size={12} /> Analyze impact
                </button>
                <button
                  type="button"
                  onClick={() => askQuestion(undefined, `What breaks if I change ${selected.name}?`)}
                  disabled={!repository}
                >
                  <Sparkles size={12} /> Ask risk question
                </button>
              </div>
              <label className="hf-d3-annotation">
                <span>Team note</span>
                <textarea
                  value={annotations[selected.id] ?? ""}
                  onChange={e => updateAnnotation(selected.id, e.target.value)}
                  placeholder="Add review notes, architectural context, or a decision rationale."
                />
              </label>
            </section>
          )}

          {/* ── RELATIONSHIPS TAB ── */}
          {detailTab === "relationships" && (
            <section id="twin-tab-relationships" role="tabpanel" aria-labelledby="tab-relationships">
              <h3>
                Callers, callees &amp; imports
                {!detailLoading && visibleRelGroups > 0 && (
                  <span className="hf-d3-count-badge">{visibleRelGroups}</span>
                )}
              </h3>
              {detailLoading && <div className="hf-d3-skeleton" aria-label="Loading relationships" />}
              {!detailLoading && allRelGroups.length === 0 && (
                <p className="hf-d3-empty-hint">No relationship evidence found for this node.</p>
              )}
              <div className="hf-d3-relationship-groups">
                {allRelGroups.map(group => {
                  const groupKey = `${group.direction}-${group.relationship}`;
                  const allNodes = group.nodes;
                  const shown = allNodes.slice(0, showRelCount);
                  return (
                    <div key={groupKey} className="hf-d3-rel-group">
                      <h4 className={`hf-d3-rel-heading direction-${group.direction}`}>
                        <span className="hf-d3-rel-dir">{group.direction === "incoming" ? "↘ into" : "↗ from"}</span>
                        {" "}
                        <span className="hf-d3-rel-type">{group.relationship.replace(/_/g, " ")}</span>
                        <span className="hf-d3-count-badge">{allNodes.length}</span>
                      </h4>
                      {shown.map(node => (
                        <div className="hf-d3-rel-row" key={node.id}>
                          <button
                            type="button"
                            onClick={() => centerNode(node)}
                            title={`Navigate to ${node.name}`}
                          >
                            <span
                              className="hf-d3-node-icon"
                              style={{ color: styleFor(node).stroke }}
                            >
                              {styleFor(node).icon}
                            </span>
                            <span>{isRawId(node.name) ? (node.path ? node.path.split("/").pop() : node.type) : node.name}</span>
                            <small>{node.path ? truncatePath(node.path, 26) : node.type}</small>
                          </button>
                          <button
                            type="button"
                            onClick={() => explainConnection(node)}
                            title="Show evidence path connecting these nodes"
                            className="hf-d3-why-btn"
                          >
                            Trace path →
                          </button>
                        </div>
                      ))}
                      {allNodes.length > showRelCount && (
                        <button
                          type="button"
                          className="hf-d3-show-more"
                          onClick={() => setShowRelCount(n => n + 20)}
                        >
                          Show {Math.min(20, allNodes.length - showRelCount)} more…
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── CODE TAB ── */}
          {detailTab === "code" && (
            <section id="twin-tab-code" role="tabpanel" aria-labelledby="tab-code">
              <div className="hf-d3-code-header">
                <h3>Source evidence</h3>
                {nodeSource?.snippet && (
                  <button
                    type="button"
                    className="hf-d3-copy-btn"
                    onClick={copySnippet}
                    aria-label="Copy source code"
                    title="Copy to clipboard"
                  >
                    <Copy size={12} />
                    {copiedSnippet ? "Copied!" : "Copy"}
                  </button>
                )}
              </div>
              {detailLoading && <div className="hf-d3-skeleton" aria-label="Loading source" />}
              {!detailLoading && nodeSource?.unavailableReason && (
                <div className="hf-d3-source-unavailable">
                  <Info size={13} />
                  <span>{nodeSource.unavailableReason}</span>
                </div>
              )}
              {!detailLoading && nodeSource?.snippet && (
                <>
                  {nodeSource.path && (
                    <div className="hf-d3-source-path">
                      <Code2 size={11} />
                      <span>{nodeSource.path}</span>
                      {nodeSource.startLine != null && (
                        <span className="hf-d3-line-range">:{nodeSource.startLine}–{nodeSource.endLine ?? nodeSource.startLine}</span>
                      )}
                      {nodeSource.language && (
                        <span className="hf-d3-lang-badge">{nodeSource.language}</span>
                      )}
                    </div>
                  )}
                  <pre className="hf-d3-code"><code>{nodeSource.snippet}</code></pre>
                </>
              )}
            </section>
          )}

          {/* ── EVIDENCE TAB ── */}
          {detailTab === "evidence" && (
            <section id="twin-tab-evidence" role="tabpanel" aria-labelledby="tab-evidence">
              <h3>Dependency path &amp; evidence</h3>
              {pathLoading && (
                <div className="hf-d3-skeleton" aria-label="Finding evidence path" />
              )}
              {highlightPath ? (
                <div className="hf-d3-path-card">
                  <div className="hf-d3-path-header">
                    <strong>
                      {highlightPath.source.name}
                      <ChevronRight size={12} />
                      {highlightPath.target.name}
                    </strong>
                    <span className={`hf-d3-confidence confidence-${highlightPath.confidence}`}>
                      {highlightPath.confidence}
                    </span>
                  </div>
                  <p>{highlightPath.explanation}</p>
                  <div className="hf-d3-path-chain">
                    {highlightPath.nodes.map((n, i) => (
                      <span key={n.id} className="hf-d3-path-step">
                        {i > 0 && <ChevronRight size={10} className="hf-d3-path-arrow" />}
                        <button
                          type="button"
                          onClick={() => centerNode(n)}
                          style={{ color: styleFor(n).stroke }}
                          title={n.path ?? n.type}
                        >
                          {styleFor(n).icon} {n.name}
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : !pathLoading && (
                <p className="hf-d3-empty-hint">
                  Click <strong>Trace path →</strong> next to any related node to show its dependency path.
                </p>
              )}

              {(nodeContext?.evidenceEdges ?? []).length > 0 && (
                <>
                  <h3 className="hf-d3-sub-heading">Evidence edges</h3>
                  <div className="hf-d3-evidence-list">
                    {(nodeContext?.evidenceEdges ?? []).slice(0, 12).map(edge => (
                      <div key={edge.id} className="hf-d3-evidence-edge">
                        <span
                          className="hf-d3-edge-type-dot"
                          style={{ background: EDGE_COLOR[edge.type] ?? "#555" }}
                        />
                        <span className="hf-d3-edge-type">{edge.type.replace(/_/g, " ")}</span>
                        {edge.evidencePath && (
                          <span className="hf-d3-edge-path">
                            {truncatePath(edge.evidencePath, 32)}
                            {edge.evidenceLine ? `:${edge.evidenceLine}` : ""}
                          </span>
                        )}
                        <span className={`hf-d3-edge-confidence confidence-${edge.confidence}`}>
                          {edge.confidence}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── RISK TAB ── */}
          {detailTab === "risk" && (
            <section id="twin-tab-risk" role="tabpanel" aria-labelledby="tab-risk">
              <h3>Impact readiness</h3>
              {/* If no pre-mortem has run, show a prompt to run one */}
              {(severityByNode.get(selected.id) ?? selected.risk) === "none" ? (
                <div className="hf-d3-risk-unassessed">
                  <div className="hf-d3-risk-unassessed-icon"><AlertTriangle size={20} /></div>
                  <strong>Risk not yet assessed</strong>
                  <p>Run a pre-mortem to see evidence-backed risk for changing this node — what will break, who owns it, and what to check.</p>
                  <button
                    type="button"
                    className="hf-d3-primary-btn"
                    onClick={assessSelectedNode}
                    disabled={!repository}
                  >
                    <AlertTriangle size={13} /> Assess impact now
                  </button>
                  <button
                    type="button"
                    onClick={() => askQuestion(undefined, `What breaks if I change ${selected.name}?`)}
                  >
                    <Sparkles size={12} /> Ask risk question
                  </button>
                </div>
              ) : (
              <div
                className={`hf-d3-risk-card risk-${severityByNode.get(selected.id) ?? selected.risk}`}
                role="status"
              >
                <div className="hf-d3-risk-header">
                  <AlertTriangle size={14} />
                  <strong>{SEVERITY_LABEL[severityByNode.get(selected.id) ?? selected.risk] ?? selected.risk}</strong>
                </div>
                <p>{impactCopy(selected, graph, visibleGraph.edges)}</p>
              </div>
              )}

              {connectedNodes.length > 0 && (
                <>
                  <h3 className="hf-d3-sub-heading">
                    Connected nodes
                    <span className="hf-d3-count-badge">{connectedNodes.length}</span>
                  </h3>
                  <div className="hf-d3-connected-list">
                    {connectedNodes.slice(0, 14).map(node => (
                      <button type="button" key={node.id} onClick={() => centerNode(node)}>
                        <span
                          className="hf-d3-node-icon"
                          style={{ color: styleFor(node).stroke }}
                        >
                          {styleFor(node).icon}
                        </span>
                        <span>{node.name}</span>
                        <small>{node.path ? truncatePath(node.path, 24) : node.type}</small>
                      </button>
                    ))}
                    {connectedNodes.length > 14 && (
                      <p className="hf-d3-empty-hint">+{connectedNodes.length - 14} more in current view</p>
                    )}
                  </div>
                </>
              )}

              <div className="hf-d3-action-grid">
                <button
                  type="button"
                  onClick={assessSelectedNode}
                >
                  <AlertTriangle size={12} /> Assess impact
                </button>
                <button
                  type="button"
                  onClick={() => askQuestion(undefined, `What breaks if I change ${selected.name}?`)}
                  disabled={!repository}
                >
                  <Sparkles size={12} /> Ask the twin
                </button>
              </div>
            </section>
          )}
        </aside>
      )}
    </section>
  );
}

// ── MODE DESCRIPTIONS ──────────────────────────────────────────────

const MODE_DESCRIPTIONS: Record<TwinMode, string> = {
  overview:     "Show the most connected nodes — the architectural spine",
  entry:        "Start from executable entry points",
  neighborhood: "Navigate the neighborhood of a selected node",
  impact:       "Highlight risk and blast radius of a planned change",
  review:       "Focus on nodes relevant to a PR review",
  memory:       "Surface architectural decisions and historical context",
  search:       "Result of a search or question to the twin"
};

// ── EMPTY STATE ────────────────────────────────────────────────────

function EmptyState({
  repository,
  onAsk,
  onOverview,
  entryPoints,
  onEntry,
  lastQuestions,
  intent
}: {
  repository?: Repository;
  onAsk: (text: string) => void;
  onOverview: () => void;
  entryPoints: GraphNode[];
  onEntry: (node: GraphNode) => void;
  lastQuestions: string[];
  intent: "twin" | "impact";
}) {
  if (!repository) {
    return (
      <div className="hf-d3-empty hf-twin-empty">
        <Network size={40} strokeWidth={1.2} />
        <h2>No repository ingested</h2>
        <p>Ingest a GitHub repository to build the code twin, then return here to explore it.</p>
        <div className="hf-d3-empty-hint-row">
          <span>Go to <strong>Ingest</strong> in the left navigation to get started.</span>
        </div>
      </div>
    );
  }

  // Repository exists — show entry points as the hero action if available
  const hasEntryPoints = entryPoints.length > 0;

  return (
    <div className="hf-d3-empty hf-twin-empty">
      {intent === "impact" ? <AlertTriangle size={36} strokeWidth={1.2} /> : <Network size={36} strokeWidth={1.2} />}
      <h2>{intent === "impact" ? "What change are you planning?" : "Where do you want to start?"}</h2>
      <p>
        {intent === "impact"
          ? "Describe the change in the left panel. HelixFactory will run pre-mortem plus blast radius and show evidence before anyone changes code."
          : "Choose an intent. HelixFactory will load a small, evidence-backed view — never the entire repository dumped onto the canvas."}
      </p>

      {/* Entry points — the hero action when available */}
      {hasEntryPoints && (
        <div className="hf-d3-empty-ep-section">
          <span className="hf-d3-empty-ep-label">
            <span style={{ color: NODE_STYLE.entry_point.stroke }}>●</span>
            Entry points — start here
          </span>
          <div className="hf-d3-empty-ep-grid">
            {entryPoints.slice(0, 6).map(ep => (
              <button
                type="button"
                key={ep.id}
                onClick={() => onEntry(ep)}
                className="hf-d3-empty-ep-btn"
                title={ep.path ?? ep.type}
              >
                <span className="hf-d3-empty-ep-icon" style={{ color: NODE_STYLE.entry_point.stroke }}>●</span>
                <span className="hf-d3-empty-ep-name">{ep.name}</span>
                {ep.path && <small className="hf-d3-empty-ep-path">{truncatePath(ep.path, 32)}</small>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fallback actions */}
      <div className="hf-d3-empty-actions">
        <button type="button" onClick={onOverview} className="hf-d3-empty-primary">
          <Network size={14} /> Load architecture overview
        </button>
        {!hasEntryPoints && (
          <button type="button" onClick={() => onAsk("What are the entry points?")} className="hf-d3-empty-secondary">
            <Sparkles size={14} /> Detect entry points
          </button>
        )}
        <button type="button" onClick={() => onAsk("What is the most critical component?")} className="hf-d3-empty-secondary">
          <ShieldAlert size={14} /> Most critical component
        </button>
        <button type="button" onClick={() => onAsk("What handles routing?")} className="hf-d3-empty-secondary">
          <Sparkles size={14} /> Ask: routing
        </button>
      </div>

      {lastQuestions.length > 0 && (
        <div className="hf-d3-empty-last-questions">
          <span className="hf-d3-empty-ep-label">Recent questions</span>
          <div className="hf-d3-empty-actions">
            {lastQuestions.slice(0, 3).map(q => (
              <button
                key={q}
                type="button"
                className="hf-d3-empty-secondary"
                onClick={() => onAsk(q)}
                title={q}
              >
                {q.length > 40 ? q.slice(0, 37) + "…" : q}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="hf-d3-empty-footer">Press <kbd>Esc</kbd> to reset · Click any node to center · <kbd>⌘↵</kbd> to ask · <kbd>/</kbd> to search</p>
    </div>
  );
}

function ImpactSummary({ result, graphStats }: { result: PreMortemResult; graphStats: ReturnType<typeof summarizeNodes> }) {
  const blocking = result.riskStatus === "critical" || result.riskStatus === "high" || result.riskStatus === "blocked_insufficient_evidence";
  const topFinding = result.findings[0];
  const evidenceRef = topFinding ? `${topFinding.filePath}:${topFinding.line}` : result.evidenceGaps[0] ? "Evidence incomplete" : "No blocking evidence";
  return (
    <section className={`hf-twin-impact-summary risk-${result.riskStatus}`} aria-label="Impact assessment summary">
      <div>
        <span className="hf-twin-narrative-kicker">Change safety decision</span>
        <strong>{blocking ? "Do not auto-change this code" : "No blocking risk found in visible evidence"}</strong>
        <p>
          {topFinding
            ? `${topFinding.title}. ${topFinding.consequence}`
            : result.evidenceGaps[0] ?? "The twin did not find a blocking dependency-chain finding for this change."}
        </p>
      </div>
      <dl>
        <div>
          <dt>Gate</dt>
          <dd>{result.requiresHumanApproval || blocking ? "Human approval required" : "Automation can continue"}</dd>
        </div>
        <div>
          <dt>Risk</dt>
          <dd>{result.riskStatus.replace(/_/g, " ")}</dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd title={evidenceRef}>{evidenceRef}</dd>
        </div>
        <div>
          <dt>In view</dt>
          <dd>{graphStats.files} files · {graphStats.functions} fn</dd>
        </div>
        <div>
          <dt>Findings</dt>
          <dd>{result.findings.length} finding{result.findings.length === 1 ? "" : "s"} · {result.evidenceGaps.length} gap{result.evidenceGaps.length === 1 ? "" : "s"}</dd>
        </div>
      </dl>
    </section>
  );
}

// ── SIGMA GRAPH BUILDER ────────────────────────────────────────────

function buildSigmaGraph(view: GraphView, selectedId: string | undefined, severityByNode: Map<string, Risk>): SigmaGraph {
  const graph     = new Graph<SigmaNodeAttributes, SigmaEdgeAttributes>({ multi: true, type: "directed" });
  const subsystems = subsystemMap(view.nodes);
  const center    = selectedId ?? (view.center.type === "node" ? view.center.value : view.nodes[0]?.id);

  for (const [index, node] of view.nodes.entries()) {
    const subsystem    = subsystemFor(node);
    const style        = styleFor(node);
    const angle        = (index / Math.max(1, view.nodes.length)) * Math.PI * 2;
    const radius       = node.id === center ? 0.02 : 1 + Math.log2(index + 2) * 0.18;
    const severity     = severityByNode.get(node.id) ?? node.risk;
    const severityColor = SEVERITY_COLOR[severity];

    graph.addNode(node.id, {
      x:            Math.cos(angle) * radius,
      y:            Math.sin(angle) * radius,
      size:         nodeSize(node),
      label:        labelFor(node),
      color:        severityColor ? darkenForSeverity(severity) : style.fill,
      borderColor:  severityColor ?? subsystemColor(subsystems.get(subsystem) ?? 0),
      type:         "circle",
      node,
      subsystem,
      severity,
      forceLabel:   node.id === selectedId || Boolean(node.isEntryPoint),
      zIndex:       node.id === selectedId ? 8 : node.isEntryPoint ? 5 : 1
    });
  }

  for (const edge of view.edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    const color = EDGE_COLOR[edge.type] ?? "#404758";
    graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, {
      label:        edge.type,
      color,
      size:         edge.type === "extends" ? 2.2 : edge.type === "depends_on" ? 1.1 : 1.5,
      type:         edge.type === "depends_on" ? "line" : "arrow",
      relationship: edge.type,
      edge
    });
  }

  if (graph.order > 1) {
    try {
      forceAtlas2.assign(graph, {
        iterations: graph.order > 28 ? 300 : 180,
        settings: {
          adjustSizes:         true,
          barnesHutOptimize:   graph.order > 30,
          edgeWeightInfluence: 0.1,   // lower = less spoke effect from hub nodes
          gravity:             0.5,   // low gravity = nodes spread further
          linLogMode:          true,  // reduces hub dominance
          scalingRatio:        20,    // higher = more repulsion between nodes
          slowDown:            10,
          strongGravityMode:   false
        }
      });
    } catch { /* keep deterministic radial fallback */ }
  }

  // Normalize positions so graph is centered around 0,0
  sanitizeGraphPositions(graph);
  const xs: number[] = [], ys: number[] = [];
  graph.forEachNode((_, attrs) => { xs.push(attrs.x); ys.push(attrs.y); });
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  graph.forEachNode((node, attrs) => {
    graph.setNodeAttribute(node, "x", attrs.x - cx);
    graph.setNodeAttribute(node, "y", attrs.y - cy);
  });

  if (center && graph.hasNode(center)) {
    graph.setNodeAttribute(center, "forceLabel", true);
  }
  // Force all labels visible when graph is small enough to avoid clutter
  if (graph.order <= 16) {
    graph.forEachNode(node => {
      graph.setNodeAttribute(node, "forceLabel", true);
    });
  }
  return graph;
}

function sanitizeGraphPositions(graph: SigmaGraph) {
  const total = Math.max(1, graph.order);
  let index   = 0;
  graph.forEachNode((node, attrs) => {
    if (Number.isFinite(attrs.x) && Number.isFinite(attrs.y)) { index += 1; return; }
    const angle  = (index / total) * Math.PI * 2;
    const radius = 1.2 + Math.floor(index / Math.max(1, Math.ceil(Math.sqrt(total)))) * 0.35;
    graph.mergeNodeAttributes(node, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    });
    index += 1;
  });
}

// ── NODE / EDGE REDUCERS ───────────────────────────────────────────

function reduceNode(
  node: string,
  data: SigmaNodeAttributes,
  state: {
    hoveredId?: string;
    selectedId?: string;
    connectedIds: Set<string>;
    highlightedNodeIds: Set<string>;
    severityByNode: Map<string, Risk>;
  }
) {
  const severity      = state.severityByNode.get(node) ?? data.severity;
  const selected      = node === state.selectedId;
  const hovered       = node === state.hoveredId;
  const highlighted   = state.highlightedNodeIds.has(node);
  const unrelated     = !!(state.hoveredId && !state.connectedIds.has(node));
  const severityColor = SEVERITY_COLOR[severity];

  return {
    x:          Number.isFinite(data.x) ? data.x : 0,
    y:          Number.isFinite(data.y) ? data.y : 0,
    color:      unrelated   ? "#131822"
                : selected  ? "#f8fbff"
                : hovered   ? "#49d8d3"
                : severityColor ? darkenForSeverity(severity)
                : data.color,
    size:       unrelated   ? Math.max(3, data.size * 0.68)
                : selected  ? data.size + 4.5
                : (hovered || highlighted) ? data.size + 3
                : data.size,
    label:      unrelated   ? "" : data.label,
    forceLabel: selected || hovered || highlighted || data.forceLabel,
    highlighted: false,
    borderColor: selected   ? "#ffffff"
                : severityColor ?? data.borderColor,
    zIndex:     selected    ? 20
                : (hovered || highlighted) ? 15
                : data.zIndex ?? 1,
    hidden:     false
  };
}

function reduceEdge(
  edge: string,
  data: SigmaEdgeAttributes,
  state: {
    hoveredId?: string;
    selectedId?: string;
    highlightedEdgeIds: Set<string>;
    highlightedNodeIds: Set<string>;
  }
) {
  const source             = data.edge.source;
  const target             = data.edge.target;
  const connectedToHover   = !!(state.hoveredId   && (source === state.hoveredId   || target === state.hoveredId));
  const connectedToSelected = !!(state.selectedId && (source === state.selectedId  || target === state.selectedId));
  const highlighted        = state.highlightedEdgeIds.has(edge) ||
    (state.highlightedNodeIds.has(source) && state.highlightedNodeIds.has(target));
  const dimmed             = !!(state.hoveredId && !connectedToHover);

  return {
    color:   dimmed                            ? "#101520"
             : (connectedToHover || highlighted) ? "#ffffff"
             : data.color,
    size:    dimmed                            ? 0.32
             : (connectedToHover || highlighted) ? Math.max(3, data.size + 1.5)
             : connectedToSelected             ? data.size + 0.8
             : data.size,
    hidden:  false,
    label:   (connectedToHover || highlighted) ? data.label : "",
    zIndex:  (connectedToHover || highlighted) ? 20
             : connectedToSelected             ? 10
             : 1
  };
}

// ── CANVAS LABEL RENDERERS ─────────────────────────────────────────

function drawTwinNodeLabel(
  context: CanvasRenderingContext2D,
  data: { x: number; y: number; size: number; label: string | null; color: string },
  _settings: unknown
) {
  if (!data.label) return;
  // Short name only — no path in label to prevent overlap
  const name = data.label.length > 28 ? `${data.label.slice(0, 25)}…` : data.label;
  context.save();
  context.font = "700 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  const w = Math.min(200, context.measureText(name).width + 20);
  const x = data.x + data.size + 7;
  const y = data.y - 11;
  // Background pill
  roundRect(context, x, y, w, 22, 5);
  context.fillStyle   = "rgba(7, 9, 14, 0.95)";
  context.fill();
  // Colored left accent bar
  context.fillStyle = data.color && data.color !== "#131822" ? data.color : "rgba(120,169,255,0.7)";
  context.globalAlpha = 0.85;
  context.fillRect(x, y, 3, 22);
  context.globalAlpha = 1;
  // Label text
  context.fillStyle   = "#f2f6ff";
  context.fillText(name, x + 11, y + 15);
  context.restore();
}

function drawTwinNodeHover(
  context: CanvasRenderingContext2D,
  data: { x: number; y: number; size: number; label: string | null; color: string },
  settings: unknown
) {
  context.save();
  context.shadowColor  = "rgba(8, 189, 186, 0.55)";
  context.shadowBlur   = 20;
  context.beginPath();
  context.arc(data.x, data.y, data.size + 5, 0, Math.PI * 2);
  context.fillStyle    = "rgba(8, 189, 186, 0.14)";
  context.fill();
  context.lineWidth    = 2;
  context.strokeStyle  = "#08bdba";
  context.stroke();
  context.restore();
  drawTwinNodeLabel(context, data, settings);
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number, y: number, width: number, height: number, radius: number
) {
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

// ── FILTER / GRAPH HELPERS ─────────────────────────────────────────

function filterGraph(
  graph: GraphView | undefined,
  relationshipTypes: string[],
  nodeTypes: string[],
  riskFilter: "all" | "risky",
  severityByNode: Map<string, Risk>,
  selectedId?: string
): GraphView {
  if (!graph) return { center: { type: "query", value: "" }, depth: 0, nodes: [], edges: [], riskSummary: {} };
  const nodes = graph.nodes.filter(node => {
    if (node.id === selectedId) return true;
    if (nodeTypes.length && !nodeTypes.includes(node.type)) return false;
    if (riskFilter === "risky") {
      const risk = severityByNode.get(node.id) ?? node.risk;
      return risk === "critical" || risk === "high" || risk === "medium" || risk === "blocked_insufficient_evidence";
    }
    return true;
  });
  const ids   = new Set(nodes.map(n => n.id));
  const edges = graph.edges.filter(edge =>
    ids.has(edge.source)
    && ids.has(edge.target)
    && (relationshipTypes.length === 0 || relationshipTypes.includes(edge.type))
  );
  return { ...graph, nodes, edges };
}

function enforceContextualGraph(view: GraphView): GraphView {
  const cap   = view.depth <= 1 ? 12 : view.depth === 2 ? 28 : view.depth === 3 ? 45 : 55;
  const nodes = view.nodes
    .filter(n => !isNoiseNode(n))
    .sort((a, b) => Number(b.id === view.center.value) - Number(a.id === view.center.value) || b.connectionCount - a.connectionCount)
    .slice(0, cap);
  const ids   = new Set(nodes.map(n => n.id));
  return { ...view, nodes, edges: view.edges.filter(e => ids.has(e.source) && ids.has(e.target)) };
}

function styleFor(node: GraphNode) {
  if (node.isEntryPoint || node.type === "entry_point") return NODE_STYLE.entry_point;
  return NODE_STYLE[node.type] ?? NODE_STYLE.file;
}

function nodeSize(node: GraphNode) {
  if (node.type === "repository") return 8; // keep repository node small
  const base = node.isEntryPoint || node.type === "entry_point" ? 13
             : node.type === "class"    ? 11
             : node.type === "file"     ? 9
             : 8;
  // scale with connections but cap so no single node dominates
  return base + Math.min(5, node.connectionCount * 0.25);
}

function labelFor(node: GraphNode) {
  // name only — path causes label overlap; shown in tooltip/panel instead
  return node.name;
}

function readableCenter(view: GraphView) {
  if (view.center.type === "node") return view.nodes.find(n => n.id === view.center.value)?.name ?? "selected node";
  return view.center.value || "overview";
}

function classifyQuestion(text: string): TwinMode {
  const v = text.toLowerCase();
  if (v.includes("entry")) return "entry";
  if (v.includes("impact") || v.includes("break") || v.includes("change")) return "impact";
  if (v.includes("review") || v.includes("pr") || v.includes("merge request")) return "review";
  if (v.includes("memory") || v.includes("decision") || v.includes("mistake")) return "memory";
  if (v.includes("overview") || v.includes("critical") || v.includes("connected") || v.includes("architecture")) return "overview";
  return "search";
}

function searchNodes(query: string, nodes: GraphNode[], severityByNode: Map<string, Risk>) {
  const terms = query.toLowerCase().split(/[^a-z0-9_./-]+/).filter(Boolean);
  if (!terms.length) return [];
  return nodes
    .map(node => ({ node, score: scoreNode(node, terms, severityByNode) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.node.connectionCount - a.node.connectionCount)
    .slice(0, 8)
    .map(item => item.node);
}

function scoreNode(node: GraphNode, terms: string[], severityByNode: Map<string, Risk>) {
  const haystack = `${node.name} ${node.path ?? ""} ${node.type}`.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (node.name.toLowerCase() === term)         score += 22;
    else if (node.name.toLowerCase().includes(term)) score += 13;
    else if (haystack.includes(term))              score += 5;
  }
  if (node.isEntryPoint) score += 3;
  const risk = severityByNode.get(node.id);
  if (risk === "critical" || risk === "high") score += 2;
  return score + Math.min(8, node.connectionCount / 4);
}

function connectedNodeList(nodeId: string, graph: GraphView | undefined, edges: GraphEdge[]) {
  if (!graph) return [];
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.source === nodeId) ids.add(edge.target);
    if (edge.target === nodeId) ids.add(edge.source);
  }
  return graph.nodes.filter(n => ids.has(n.id)).sort((a, b) => b.connectionCount - a.connectionCount);
}

function summarizeNodes(nodes: GraphNode[], severityByNode: Map<string, Risk>) {
  const subsystems = new Set(nodes.map(subsystemFor));
  return {
    entryPoints: nodes.filter(n => n.isEntryPoint || n.type === "entry_point").length,
    files:       nodes.filter(n => n.type === "file").length,
    functions:   nodes.filter(n => n.type === "function").length,
    classes:     nodes.filter(n => n.type === "class").length,
    subsystems:  subsystems.size,
    risky:       nodes.filter(n => {
      const risk = severityByNode.get(n.id) ?? n.risk;
      return risk === "critical" || risk === "high" || risk === "medium" || risk === "blocked_insufficient_evidence";
    }).length
  };
}

function explainCurrentView(
  mode: TwinMode,
  graph: GraphView,
  centeredLabel: string,
  selected: GraphNode | undefined,
  impactResult: PreMortemResult | undefined,
  stats: ReturnType<typeof summarizeNodes>
) {
  if (mode === "impact" && impactResult) {
    const blocking = impactResult.requiresHumanApproval ? "requires human approval" : "does not require a blocking gate";
    return {
      kicker: "What this means",
      title: `Impact view for ${centeredLabel}`,
      body: `HelixFactory ran pre-mortem plus blast radius together. ${impactResult.findings.length} finding(s), ${impactResult.evidenceGaps.length} evidence gap(s), and this change ${blocking}. Red or amber nodes are the areas to inspect first.`
    };
  }
  if (selected) {
    return {
      kicker: "Selected node",
      title: `${selected.name} is centered in context`,
      body: `This view shows the nearest ${graph.nodes.length} code elements connected to ${selected.name}. Use Assess impact to run an evidence-backed pre-mortem, or open Links/Code/Evidence on the right to understand why it is connected.`
    };
  }
  if (mode === "overview") {
    return {
      kicker: "Architecture spine",
      title: `${graph.nodes.length} high-connection nodes loaded`,
      body: `This is not the full repository. It shows the most connected production nodes, grouped by subsystem. Start with entry points or the highest-connection files to understand the system quickly.`
    };
  }
  if (mode === "entry") {
    return {
      kicker: "Execution entry",
      title: `Tracing from ${centeredLabel}`,
      body: `This view starts from an entry point and expands outward through imports, definitions, and dependencies. Follow the brightest connected nodes to understand the execution path.`
    };
  }
  if (mode === "search") {
    return {
      kicker: "Search result",
      title: `Centered on ${centeredLabel}`,
      body: `The graph is scoped to evidence related to your question. If the answer feels off, use Symbol search for exact names or ask a more specific question like “what calls X?”`
    };
  }
  return {
    kicker: "Code twin",
    title: `${stats.files} files, ${stats.functions} functions, ${stats.classes} classes in view`,
    body: `This contextual graph is capped to avoid noise. Click any node to recenter, hover to isolate its neighborhood, and use the right panel for source, relationships, and evidence.`
  };
}

function impactCopy(node: GraphNode, graph: GraphView | undefined, edges: GraphEdge[]) {
  const direct = edges.filter(e => e.source === node.id || e.target === node.id).length;
  const unique = graph ? new Set(edges.flatMap(e => [e.source, e.target])).size - 1 : 0;
  if (direct === 0) return "This node has no direct relationships in the current view. Load a wider graph to assess impact.";
  return `${direct} direct relationship${direct !== 1 ? "s" : ""} and ${Math.max(0, unique)} transitive neighbors in the current view. Run impact analysis for evidence-backed risk before making changes.`;
}

function mergePathIntoGraph(graph: GraphView, path: GraphPath): GraphView {
  const nodes       = uniqueNodes([...graph.nodes, ...path.nodes]);
  const edgesById   = new Map<string, GraphEdge>();
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

function uniqueNodesByName(nodes: GraphNode[]) {
  const byName = new Map<string, GraphNode>();
  for (const node of nodes) {
    const existing = byName.get(node.name);
    if (!existing || node.connectionCount > existing.connectionCount) {
      byName.set(node.name, node);
    }
  }
  return [...byName.values()];
}

function isNoiseNode(node: GraphNode) {
  const path = (node.path ?? "").toLowerCase();
  return /(^|\/)(tests?|docs?|examples?|fixtures?|vendor|node_modules|dist|build|coverage|migrations|\.venv|venv)(\/|$)/.test(path)
    || /(^|\/)(test_.*\.py|.*_test\.py|.*\.(spec|test)\.(ts|tsx|js|jsx)|conftest\.py)$/.test(path);
}

function subsystemFor(node: GraphNode) {
  const path  = node.path ?? node.name;
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 2 && ["src", "app", "backend", "frontend"].includes(parts[0])) return parts[1];
  return parts[0] ?? node.type;
}

function subsystemMap(nodes: GraphNode[]) {
  const names = [...new Set(nodes.map(subsystemFor))].sort();
  return new Map(names.map((name, i) => [name, i]));
}

function subsystemColor(index: number) {
  return SUBSYSTEM_COLORS[index % SUBSYSTEM_COLORS.length];
}

function darkenForSeverity(severity: Risk) {
  if (severity === "critical" || severity === "blocked_insufficient_evidence") return "#2a0808";
  if (severity === "high")   return "#2a1608";
  if (severity === "medium") return "#2a2408";
  return "#0d1f2d";
}

function truncatePath(value: string, max: number) {
  if (value.length <= max) return value;
  return `…${value.slice(-(max - 1))}`;
}

function isRawId(name: string) {
  return /^[0-9a-f]{10,}$/.test(name);
}

function humanError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const msg = error.message
    .replace(/^HelixFactory API is not reachable\. Tried /, "")
    .replace(/\s+/g, " ")
    .trim();
  return msg || fallback;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}

// ── MINIMAP ────────────────────────────────────────────────────────

function drawMinimap(canvas: HTMLCanvasElement | null, graph: SigmaGraph | undefined) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#090b10";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#2a3244";
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1);
  if (!graph || graph.order === 0) return;

  const nodes = graph.nodes().map(id => ({
    id,
    x:     graph.getNodeAttribute(id, "x"),
    y:     graph.getNodeAttribute(id, "y"),
    color: graph.getNodeAttribute(id, "borderColor")
  }));
  const xs   = nodes.map(n => n.x);
  const ys   = nodes.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx   = (v: number) => 8 + ((v - minX) / Math.max(0.0001, maxX - minX)) * (canvas.width  - 16);
  const sy   = (v: number) => 8 + ((v - minY) / Math.max(0.0001, maxY - minY)) * (canvas.height - 16);

  ctx.globalAlpha = 0.38;
  graph.forEachEdge((_edge, attrs, source, target) => {
    const s = nodes.find(n => n.id === source);
    const t = nodes.find(n => n.id === target);
    if (!s || !t) return;
    ctx.strokeStyle = attrs.color;
    ctx.beginPath();
    ctx.moveTo(sx(s.x), sy(s.y));
    ctx.lineTo(sx(t.x), sy(t.y));
    ctx.stroke();
  });

  ctx.globalAlpha = 1;
  for (const node of nodes) {
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(sx(node.x), sy(node.y), 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── LOCAL PERSISTENCE ──────────────────────────────────────────────

function loadSavedViews(): SavedTwinView[] {
  try { return JSON.parse(localStorage.getItem("helixfactory.twin.savedViews") ?? "[]") as SavedTwinView[]; }
  catch { return []; }
}

function persistSavedViews(views: SavedTwinView[]) {
  localStorage.setItem("helixfactory.twin.savedViews", JSON.stringify(views));
  return views;
}

function loadAnnotations(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem("helixfactory.twin.annotations") ?? "{}") as Record<string, string>; }
  catch { return {}; }
}

function persistAnnotations(annotations: Record<string, string>) {
  localStorage.setItem("helixfactory.twin.annotations", JSON.stringify(annotations));
  return annotations;
}
