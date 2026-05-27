import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Code2, FileText, GitBranch, Link2, Network, RotateCcw, Search, ShieldAlert, X, type LucideIcon } from "lucide-react";
import { api } from "../services/api";
import type { GraphEdge, GraphNode, GraphPath, GraphView, NodeContext, NodeSource, NodeSummary, PreMortemResult, Repository, Risk } from "../services/types";

type GraphCanvasProps = {
  repository?: Repository;
  preMortem?: PreMortemResult;
};

type D3Node = GraphNode & d3.SimulationNodeDatum;
type D3Link = GraphEdge & d3.SimulationLinkDatum<D3Node>;

const NODE_STYLE: Record<string, { fill: string; stroke: string; icon: string }> = {
  entry_point: { fill: "#0d2b1a", stroke: "#27AE60", icon: "★" },
  file: { fill: "#0d2b2c", stroke: "#0D7377", icon: "▣" },
  function: { fill: "#0d1f2d", stroke: "#4A90D9", icon: "ƒ" },
  class: { fill: "#1a0d2b", stroke: "#9B59B6", icon: "◇" },
  repository: { fill: "#1a1a2e", stroke: "#555", icon: "⬢" }
};

const EDGE_COLOR: Record<string, string> = {
  calls: "#4A90D9",
  imports: "#0D7377",
  extends: "#9B59B6",
  depends_on: "#333"
};

const SUGGESTIONS = ["What are the entry points?", "Show architecture overview", "What is most connected?"];
const RELATIONSHIPS = ["calls", "imports", "extends", "depends_on"];
const NODE_TYPES = ["entry_point", "file", "function", "class"];
type DetailTab = "summary" | "relationships" | "code" | "evidence" | "risk";
type GraphLayoutMode = "force" | "call_tree" | "dependency" | "cluster" | "impact";
type SavedTwinView = {
  id: string;
  name: string;
  graph: GraphView;
  centeredLabel: string;
  depth: number;
  layoutMode: GraphLayoutMode;
  relationshipTypes: string[];
  nodeTypes: string[];
  riskFilter: "all" | "risky";
  selectedId?: string;
};
const DETAIL_TABS: Array<{ tab: DetailTab; icon: LucideIcon; label: string }> = [
  { tab: "summary", icon: FileText, label: "Summary" },
  { tab: "relationships", icon: GitBranch, label: "Links" },
  { tab: "code", icon: Code2, label: "Code" },
  { tab: "evidence", icon: Link2, label: "Evidence" },
  { tab: "risk", icon: ShieldAlert, label: "Risk" }
];

export function GraphCanvas({ repository, preMortem }: GraphCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const minimapRef = useRef<SVGSVGElement | null>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Link>>();
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const rootGroupRef = useRef<SVGGElement | null>(null);
  const [question, setQuestion] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [impactText, setImpactText] = useState("");
  const [lastQuestions, setLastQuestions] = useState<string[]>([]);
  const [graph, setGraph] = useState<GraphView>();
  const [selected, setSelected] = useState<GraphNode>();
  const [summary, setSummary] = useState<NodeSummary>();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [nodeContext, setNodeContext] = useState<NodeContext>();
  const [nodeSource, setNodeSource] = useState<NodeSource>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string>();
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [highlightPath, setHighlightPath] = useState<GraphPath>();
  const [pathLoading, setPathLoading] = useState(false);
  const [sidebarEntryPoints, setSidebarEntryPoints] = useState<GraphNode[]>([]);
  const [overviewNodes, setOverviewNodes] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [depth, setDepth] = useState(1);
  const [centeredLabel, setCenteredLabel] = useState("Home");
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode }>();
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [severityByNode, setSeverityByNode] = useState<Map<string, Risk>>(new Map());
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]);
  const [nodeTypes, setNodeTypes] = useState<string[]>([]);
  const [riskFilter, setRiskFilter] = useState<"all" | "risky">("all");
  const [mode, setMode] = useState<"overview" | "search" | "impact">("overview");
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>("force");
  const [savedViews, setSavedViews] = useState<SavedTwinView[]>(() => loadSavedViews());
  const [annotations, setAnnotations] = useState<Record<string, string>>(() => loadAnnotations());
  const requestSeq = useRef(0);
  const detailSeq = useRef(0);

  const entryPoints = useMemo(() => {
    const fromGraph = (graph?.nodes ?? []).filter((node) => node.isEntryPoint || node.type === "entry_point");
    return (fromGraph.length ? fromGraph : sidebarEntryPoints).slice(0, 8);
  }, [graph, sidebarEntryPoints]);
  const quickCandidates = useMemo(() => uniqueNodes([...(graph?.nodes ?? []), ...overviewNodes, ...sidebarEntryPoints]), [graph, overviewNodes, sidebarEntryPoints]);
  const quickResults = useMemo(() => searchNodes(quickSearch, quickCandidates, severityByNode), [quickSearch, quickCandidates, severityByNode]);
  const modeRelationships = useMemo(() => relationshipsForLayout(layoutMode), [layoutMode]);
  const visibleNodes = useMemo(() => {
    const selectedId = selected?.id;
    return (graph?.nodes ?? []).filter((node) => {
      if (node.id === selectedId) return true;
      const typeAllowed = nodeTypes.length === 0 || nodeTypes.includes(node.type);
      const riskAllowed = riskFilter === "all" || severityByNode.get(node.id) === "critical" || severityByNode.get(node.id) === "high" || node.risk === "critical" || node.risk === "high";
      return typeAllowed && riskAllowed;
    });
  }, [graph, nodeTypes, riskFilter, selected?.id, severityByNode]);
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => (graph?.edges ?? []).filter((edge) =>
      visibleNodeIds.has(edge.source)
      && visibleNodeIds.has(edge.target)
      && (relationshipTypes.length === 0 || relationshipTypes.includes(edge.type))
      && (modeRelationships.length === 0 || modeRelationships.includes(edge.type))
    ),
    [graph, modeRelationships, relationshipTypes, visibleNodeIds]
  );
  const connectedNodes = useMemo(() => selected ? connectedNodeList(selected.id, graph, visibleEdges) : [], [graph, selected, visibleEdges]);
  const highlightedNodeIds = useMemo(() => new Set(highlightPath?.nodes.map((node) => node.id) ?? []), [highlightPath]);
  const highlightedEdgeIds = useMemo(() => new Set(highlightPath?.edges.map((edge) => edge.id) ?? []), [highlightPath]);
  const graphStats = useMemo(() => summarizeNodes(visibleNodes), [visibleNodes]);
  const impactStats = useMemo(() => selected ? calculateImpact(selected.id, graph, visibleEdges) : undefined, [graph, selected, visibleEdges]);
  const repoName = repository?.url.split("/").filter(Boolean).slice(-1)[0] ?? "No repository";

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const rect = entry.contentRect;
      setSize({ width: Math.max(320, rect.width), height: Math.max(420, rect.height) });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    renderGraph();
  }, [graph, selected?.id, size.width, size.height, severityByNode, relationshipTypes, nodeTypes, riskFilter, highlightedEdgeIds, highlightedNodeIds, layoutMode]);

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
    if (!selected || !repository) return;
    const currentDetail = ++detailSeq.current;
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
        if (currentDetail === detailSeq.current) setSummary(response);
      })
      .catch((err) => {
        if (currentDetail === detailSeq.current) setSummary({ nodeId: selected.id, summary: err instanceof Error ? err.message : "Node summary failed." });
      })
      .finally(() => {
        if (currentDetail === detailSeq.current) setSummaryLoading(false);
      });
    Promise.all([api.nodeContext(repository.id, selected.id), api.nodeSource(repository.id, selected.id)])
      .then(([context, source]) => {
        if (currentDetail !== detailSeq.current) return;
        setNodeContext(context);
        setNodeSource(source);
      })
      .catch((err) => {
        if (currentDetail === detailSeq.current) setDetailError(err instanceof Error ? err.message : "Node intelligence failed.");
      })
      .finally(() => {
        if (currentDetail === detailSeq.current) setDetailLoading(false);
      });
  }, [selected?.id, repository?.id]);

  useEffect(() => {
    if (!repository) {
      setSidebarEntryPoints([]);
      setOverviewNodes([]);
      return;
    }
    api.askGraph(repository.id, "What are the entry points?")
      .then((view) => setSidebarEntryPoints(view.nodes.filter((node) => node.isEntryPoint || node.type === "entry_point")))
      .catch(() => setSidebarEntryPoints([]));
    api.graphOverview(repository.id)
      .then((view) => setOverviewNodes(view.nodes.slice(0, 15)))
      .catch(() => setOverviewNodes([]));
  }, [repository?.id]);

  const loadGraph = useCallback(async (
    loader: () => Promise<GraphView>,
    options: { remember?: string; centeredLabel?: string; selectedId?: string; clearSelection?: boolean; mode?: "overview" | "search" | "impact" } = {}
  ) => {
    if (!repository) {
      setError("Ingest a repository before exploring the graph.");
      return;
    }
    const currentRequest = ++requestSeq.current;
    setLoading(true);
    setError(undefined);
    try {
      const view = await loader();
      if (currentRequest !== requestSeq.current) return;
      setGraph(view);
      if (options.clearSelection) {
        setSelected(undefined);
      } else if (options.selectedId) {
        setSelected(view.nodes.find((node) => node.id === options.selectedId));
      }
      setCenteredLabel(options.centeredLabel ?? view.nodes.find((node) => node.id === options.selectedId)?.name ?? "overview");
      if (options.mode) setMode(options.mode);
      setSeverityByNode(new Map(view.nodes.map((node) => [node.id, node.risk]).filter(([, risk]) => risk !== "none") as Array<[string, Risk]>));
      if (options.remember) {
        setLastQuestions((items) => [options.remember!, ...items.filter((item) => item !== options.remember)].slice(0, 3));
      }
    } catch (err) {
      if (currentRequest !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : "Graph request failed.");
    } finally {
      if (currentRequest === requestSeq.current) setLoading(false);
    }
  }, [repository]);

  const askQuestion = (event?: FormEvent, text = question.trim()) => {
    event?.preventDefault();
    if (!text) return;
    if (!repository) {
      setError("Ingest a repository before exploring the graph.");
      return;
    }
    void loadGraph(() => api.askGraph(repository.id, text), { remember: text, centeredLabel: text, clearSelection: true, mode: "search" });
  };

  const runQuickSearch = () => {
    const term = quickSearch.trim();
    if (!term) return;
    if (quickResults[0]) {
      centerNode(quickResults[0]);
      return;
    }
    if (!repository) {
      setError("Ingest a repository before searching the twin.");
      return;
    }
    setQuestion(term);
    void loadGraph(() => api.askGraph(repository.id, term), { remember: term, centeredLabel: term, clearSelection: true, mode: "search" });
  };

  const showOverview = () => {
    if (!repository) {
      setError("Ingest a repository before loading the architecture overview.");
      return;
    }
    void loadGraph(() => api.graphOverview(repository.id), { remember: "Show architecture overview", centeredLabel: "architecture overview", clearSelection: true, mode: "overview" });
  };

  const centerNode = (node: GraphNode, nextDepth = depth) => {
    if (!repository) return;
    setSelected(node);
    setCenteredLabel(node.name);
    setBreadcrumbs((trail) => [...trail.filter((item) => item.id !== node.id), { id: node.id, name: node.name }].slice(-5));
    void loadGraph(() => api.queryGraph(repository.id, { type: "node", value: node.id }, nextDepth, relationshipTypes), { centeredLabel: node.name, selectedId: node.id, mode: "overview" });
  };

  const revisitBreadcrumb = (crumb: { id: string; name: string }) => {
    const node = graph?.nodes.find((item) => item.id === crumb.id);
    if (node) {
      centerNode(node);
      return;
    }
    if (!repository) return;
    setCenteredLabel(crumb.name);
    void loadGraph(() => api.queryGraph(repository.id, { type: "node", value: crumb.id }, depth, relationshipTypes), { centeredLabel: crumb.name, selectedId: crumb.id, mode: "overview" });
  };

  const showImpact = async () => {
    if (!repository) {
      setError("Ingest a repository before calculating blast radius.");
      return;
    }
    if (!impactText.trim()) {
      setError("Describe the change before calculating blast radius.");
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const premortem = await api.runPremortem(repository.id, impactText, [selected?.id ?? impactText]);
      const view = await api.blastRadius(repository.id, impactText, [selected?.id ?? impactText], depth, relationshipTypes);
      setGraph(view);
      setMode("impact");
      setCenteredLabel(selected?.name ?? impactText);
      const nextSeverity = new Map<string, Risk>();
      for (const node of view.nodes) nextSeverity.set(node.id, node.risk);
      for (const finding of premortem.findings) {
        const match = view.nodes.find((node) => node.path === finding.filePath);
        if (match) nextSeverity.set(match.id, finding.severity);
      }
      setSeverityByNode(nextSeverity);
      runRipple(nextSeverity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Blast radius failed.");
    } finally {
      setLoading(false);
    }
  };

  const clearGraph = () => {
    simulationRef.current?.stop();
    requestSeq.current += 1;
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

  const changeDepth = (delta: number) => {
    const next = Math.max(1, Math.min(4, depth + delta));
    setDepth(next);
    if (selected) centerNode(selected, next);
  };

  const saveCurrentView = () => {
    if (!graph) return;
    const view: SavedTwinView = {
      id: `${Date.now()}`,
      name: centeredLabel,
      graph,
      centeredLabel,
      depth,
      layoutMode,
      relationshipTypes,
      nodeTypes,
      riskFilter,
      selectedId: selected?.id
    };
    setSavedViews((current) => persistSavedViews([view, ...current.filter((item) => item.name !== view.name)].slice(0, 6)));
  };

  const restoreSavedView = (view: SavedTwinView) => {
    setGraph(view.graph);
    setCenteredLabel(view.centeredLabel);
    setDepth(view.depth);
    setLayoutMode(view.layoutMode);
    setRelationshipTypes(view.relationshipTypes);
    setNodeTypes(view.nodeTypes);
    setRiskFilter(view.riskFilter);
    setSelected(view.selectedId ? view.graph.nodes.find((node) => node.id === view.selectedId) : undefined);
    setMode("overview");
  };

  const updateAnnotation = (nodeId: string, value: string) => {
    setAnnotations((current) => persistAnnotations({ ...current, [nodeId]: value }));
  };

  const explainConnection = async (target: GraphNode) => {
    if (!repository || !selected) return;
    setPathLoading(true);
    setDetailError(undefined);
    try {
      const path = await api.graphPath(repository.id, selected.id, target.id, relationshipTypes, Math.max(4, depth + 1));
      setHighlightPath(path);
      setGraph((current) => current ? mergePathIntoGraph(current, path) : current);
      setDetailTab("evidence");
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "No evidence path was found.");
    } finally {
      setPathLoading(false);
    }
  };

  const changeLayoutMode = (next: GraphLayoutMode) => {
    setLayoutMode(next);
    if (next === "impact") setRiskFilter("risky");
    if (next === "call_tree" || next === "dependency") setMode("overview");
  };

  const toggleRelationship = (relationship: string) => {
    setRelationshipTypes((current) => current.includes(relationship)
      ? current.filter((item) => item !== relationship)
      : [...current, relationship]);
  };

  const toggleNodeType = (type: string) => {
    setNodeTypes((current) => current.includes(type)
      ? current.filter((item) => item !== type)
      : [...current, type]);
  };

  const zoomCanvas = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(180).call(zoomRef.current.scaleBy, factor);
  };

  const fitCurrentGraph = () => {
    const nodes = simulationRef.current?.nodes() as D3Node[] | undefined;
    if (nodes?.length) fitGraphToViewport(nodes);
  };

  function renderGraph() {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current as SVGSVGElement);
    simulationRef.current?.stop();
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    defs.append("pattern").attr("id", "dot-grid").attr("width", 30).attr("height", 30).attr("patternUnits", "userSpaceOnUse")
      .append("circle").attr("cx", 1).attr("cy", 1).attr("r", 1).attr("fill", "rgba(255,255,255,0.06)");
    defs.append("filter").attr("id", "node-blur").append("feGaussianBlur").attr("stdDeviation", 4);
    defs.append("marker").attr("id", "arrow").attr("viewBox", "0 0 10 10").attr("refX", 20).attr("refY", 5).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
      .append("path").attr("d", "M 0 0 L 10 5 L 0 10 z").attr("fill", "context-stroke");

    svg.append("rect").attr("width", "100%").attr("height", "100%").attr("fill", "url(#dot-grid)");
    const root = svg.append("g").attr("class", "hf-d3-root");
    rootGroupRef.current = root.node();
    zoomRef.current = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 2.8]).on("zoom", (event) => {
      root.attr("transform", event.transform);
      root.selectAll<SVGTextElement, D3Node | D3Link>(".hf-d3-label-sub").style("opacity", event.transform.k > 0.72 ? 1 : 0);
      root.selectAll<SVGTextElement, D3Link>(".hf-d3-edge-label").style("opacity", event.transform.k > 1.05 ? 1 : 0);
    });
    svg.call(zoomRef.current);

    if (!graph || graph.nodes.length === 0) {
      drawMinimap([], []);
      return;
    }

    const nodes: D3Node[] = visibleNodes.map((node) => ({ ...node, x: size.width / 2, y: size.height / 2 }));
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const links: D3Link[] = visibleEdges
      .filter((edge) => nodeById.has(edge.source) && nodeById.has(edge.target))
      .map((edge) => ({ ...edge, source: edge.source, target: edge.target }));
    const layoutHints = layoutCoordinates(nodes, links, layoutMode, selected?.id, size.width, size.height);

    const link = root.append("g").attr("class", "hf-d3-links").selectAll<SVGPathElement, D3Link>("path").data(links, (edge) => edge.id).join("path")
      .attr("class", (edge) => highlightedEdgeIds.has(edge.id) ? "path-highlight" : "")
      .attr("stroke", (edge) => highlightedEdgeIds.has(edge.id) ? "#ffffff" : (EDGE_COLOR[edge.type] ?? "#333"))
      .attr("stroke-width", (edge) => highlightedEdgeIds.has(edge.id) ? 3 : edge.type === "extends" ? 2 : edge.type === "depends_on" ? 1 : 1.5)
      .attr("stroke-opacity", (edge) => highlightedEdgeIds.size && !highlightedEdgeIds.has(edge.id) ? 0.12 : edge.type === "depends_on" ? 0.4 : 0.6)
      .attr("fill", "none")
      .attr("marker-end", "url(#arrow)");

    const edgeLabel = root.append("g").selectAll<SVGTextElement, D3Link>("text").data(links, (edge) => edge.id).join("text")
      .attr("class", "hf-d3-edge-label")
      .text((edge) => edge.type);

    const node = root.append("g").attr("class", "hf-d3-nodes").selectAll<SVGGElement, D3Node>("g").data(nodes, (item) => item.id).join("g")
      .attr("class", (item) => `hf-d3-node severity-${severityByNode.get(item.id) ?? "none"} ${selected?.id === item.id ? "selected" : ""} ${highlightedNodeIds.has(item.id) ? "path-highlight" : ""}`)
      .style("opacity", 0)
      .call(d3.drag<SVGGElement, D3Node>()
        .on("start", (event, item) => {
          if (!event.active) simulationRef.current?.alphaTarget(0.25).restart();
          item.fx = item.x;
          item.fy = item.y;
        })
        .on("drag", (event, item) => {
          item.fx = event.x;
          item.fy = event.y;
        })
        .on("end", (event, item) => {
          if (!event.active) simulationRef.current?.alphaTarget(0);
          item.fx = null;
          item.fy = null;
        }));

    node.each(function (item) {
      drawNode(d3.select(this), item, severityByNode.get(item.id), selected?.id === item.id || highlightedNodeIds.has(item.id));
    });

    node.transition().duration(360).style("opacity", 1);
    node.on("mouseover", (event, item) => hoverNode(item, event, node, link))
      .on("mouseout", () => resetHover(node, link))
      .on("click", (_event, item) => {
        centerNode(item);
      });

    const simulation = d3.forceSimulation<D3Node>(nodes)
      .force("link", d3.forceLink<D3Node, D3Link>(links).id((item) => item.id).distance(layoutMode === "call_tree" ? 120 : 80).strength(layoutMode === "cluster" ? 0.48 : 0.3))
      .force("charge", d3.forceManyBody<D3Node>().strength(layoutMode === "cluster" ? -260 : -400))
      .force("center", d3.forceCenter(size.width / 2, size.height / 2))
      .force("x", d3.forceX<D3Node>((item) => layoutHints.get(item.id)?.x ?? size.width / 2).strength(layoutMode === "force" ? 0.02 : 0.22))
      .force("y", d3.forceY<D3Node>((item) => layoutHints.get(item.id)?.y ?? size.height / 2).strength(layoutMode === "force" ? 0.02 : 0.18))
      .force("collision", d3.forceCollide<D3Node>(layoutMode === "cluster" ? 48 : 40))
      .alphaDecay(0.02)
      .alpha(0.8);
    simulationRef.current = simulation;

    simulation.on("tick", () => {
      for (const item of nodes) {
        item.x = Math.max(70, Math.min(size.width - 70, item.x ?? size.width / 2));
        item.y = Math.max(70, Math.min(size.height - 70, item.y ?? size.height / 2));
      }
      link.attr("d", (edge) => {
        const source = edge.source as D3Node;
        const target = edge.target as D3Node;
        return `M${source.x},${source.y} L${target.x},${target.y}`;
      });
      edgeLabel
        .attr("x", (edge) => ((((edge.source as D3Node).x ?? 0) + ((edge.target as D3Node).x ?? 0)) / 2))
        .attr("y", (edge) => ((((edge.source as D3Node).y ?? 0) + ((edge.target as D3Node).y ?? 0)) / 2));
      node.attr("transform", (item) => `translate(${item.x},${item.y})`);
      drawMinimap(nodes, links);
    });

    window.setTimeout(() => fitGraphToViewport(nodes), 360);
    window.setTimeout(() => fitGraphToViewport(nodes), 1100);
  }

  function hoverNode(item: D3Node, event: MouseEvent, nodes: d3.Selection<SVGGElement, D3Node, SVGGElement, unknown>, links: d3.Selection<SVGPathElement, D3Link, SVGGElement, unknown>) {
    const related = new Set<string>([item.id]);
    links.each((edge) => {
      const source = endpointId(edge.source);
      const target = endpointId(edge.target);
      if (source === item.id || target === item.id) {
        related.add(source);
        related.add(target);
      }
    });
    nodes.transition().duration(200).style("opacity", (node) => related.has(node.id) ? 1 : 0.1);
    links.transition().duration(200)
      .attr("stroke", (edge) => {
        const source = endpointId(edge.source);
        const target = endpointId(edge.target);
        return source === item.id || target === item.id ? "#ffffff" : (EDGE_COLOR[edge.type] ?? "#333");
      })
      .attr("stroke-width", (edge) => {
        const source = endpointId(edge.source);
        const target = endpointId(edge.target);
        return source === item.id || target === item.id ? 2.5 : 1.2;
      })
      .attr("stroke-opacity", (edge) => {
        const source = endpointId(edge.source);
        const target = endpointId(edge.target);
        return source === item.id || target === item.id ? 1 : 0.05;
      });
    setTooltip({ x: event.clientX, y: event.clientY, node: item });
  }

  function resetHover(nodes: d3.Selection<SVGGElement, D3Node, SVGGElement, unknown>, links: d3.Selection<SVGPathElement, D3Link, SVGGElement, unknown>) {
    nodes.transition().duration(200).style("opacity", 1);
    links.transition().duration(200)
      .attr("stroke", (edge) => EDGE_COLOR[edge.type] ?? "#333")
      .attr("stroke-width", (edge) => edge.type === "extends" ? 2 : edge.type === "depends_on" ? 1 : 1.5)
      .attr("stroke-opacity", (edge) => edge.type === "depends_on" ? 0.4 : 0.6);
    setTooltip(undefined);
  }

  function fitGraphToViewport(nodes: D3Node[]) {
    if (!svgRef.current || !zoomRef.current || !nodes.length) return;
    const xExtent = d3.extent(nodes, (node) => node.x ?? size.width / 2) as [number, number];
    const yExtent = d3.extent(nodes, (node) => node.y ?? size.height / 2) as [number, number];
    const graphWidth = Math.max(1, xExtent[1] - xExtent[0]);
    const graphHeight = Math.max(1, yExtent[1] - yExtent[0]);
    const padding = Math.min(120, Math.max(48, Math.min(size.width, size.height) * 0.14));
    const scale = Math.max(
      0.34,
      Math.min(
        1.45,
        0.92 / Math.max(graphWidth / Math.max(1, size.width - padding), graphHeight / Math.max(1, size.height - padding))
      )
    );
    const tx = size.width / 2 - scale * ((xExtent[0] + xExtent[1]) / 2);
    const ty = size.height / 2 - scale * ((yExtent[0] + yExtent[1]) / 2);
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function drawMinimap(nodes: D3Node[], links: D3Link[]) {
    const svg = d3.select(minimapRef.current);
    if (!minimapRef.current) return;
    svg.selectAll("*").remove();
    svg.append("rect").attr("width", 120).attr("height", 80).attr("fill", "#11131b").attr("stroke", "#343a46");
    if (!nodes.length) return;
    const xExtent = d3.extent(nodes, (node) => node.x ?? 0) as [number, number];
    const yExtent = d3.extent(nodes, (node) => node.y ?? 0) as [number, number];
    const x = d3.scaleLinear().domain(xExtent[0] === xExtent[1] ? [xExtent[0] - 1, xExtent[1] + 1] : xExtent).range([8, 112]);
    const y = d3.scaleLinear().domain(yExtent[0] === yExtent[1] ? [yExtent[0] - 1, yExtent[1] + 1] : yExtent).range([8, 72]);
    svg.selectAll("line").data(links).join("line")
      .attr("x1", (edge) => x((edge.source as D3Node).x ?? 0))
      .attr("y1", (edge) => y((edge.source as D3Node).y ?? 0))
      .attr("x2", (edge) => x((edge.target as D3Node).x ?? 0))
      .attr("y2", (edge) => y((edge.target as D3Node).y ?? 0))
      .attr("stroke", "#354052");
    svg.selectAll("circle").data(nodes).join("circle")
      .attr("cx", (node) => x(node.x ?? 0))
      .attr("cy", (node) => y(node.y ?? 0))
      .attr("r", 2)
      .attr("fill", (node) => styleFor(node).stroke);
    svg.append("rect").attr("x", 2).attr("y", 2).attr("width", 116).attr("height", 76).attr("fill", "none").attr("stroke", "#78a9ff").attr("opacity", 0.55);
  }

  function runRipple(severity: Map<string, Risk>) {
    const svg = d3.select(svgRef.current);
    svg.selectAll<SVGGElement, D3Node>(".hf-d3-node").classed("ripple-critical ripple-high ripple-medium", false);
    window.setTimeout(() => svg.selectAll<SVGGElement, D3Node>(".hf-d3-node").filter((node) => severity.get(node.id) === "critical").classed("ripple-critical", true), 300);
    window.setTimeout(() => svg.selectAll<SVGGElement, D3Node>(".hf-d3-node").filter((node) => severity.get(node.id) === "high").classed("ripple-high", true), 600);
    window.setTimeout(() => svg.selectAll<SVGGElement, D3Node>(".hf-d3-node").filter((node) => severity.get(node.id) === "medium").classed("ripple-medium", true), 900);
  }

  return (
    <section className={`hf-d3-page ${selected ? "has-selection" : ""}`}>
      <aside className="hf-d3-sidebar">
        <div className="hf-d3-sidebar-head">
          <div>
            <h2>Explore</h2>
            <span>{repoName}</span>
          </div>
          <span className={`hf-d3-mode ${mode}`}>{mode}</span>
        </div>
        <div className="hf-d3-section hf-d3-quick-search">
          <label htmlFor="twin-symbol-search">Search symbols</label>
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
              placeholder="auth, router, app.py..."
            />
          </div>
          <button type="button" disabled={!repository || !quickSearch.trim()} onClick={runQuickSearch}>Center result</button>
          {quickResults.length > 0 && (
            <div className="hf-d3-search-results">
              {quickResults.map((node) => (
                <button type="button" key={node.id} onClick={() => centerNode(node)}>
                  <span>{styleFor(node).icon}</span>
                  <strong>{node.name}</strong>
                  <small>{node.path ?? node.type}</small>
                </button>
              ))}
            </div>
          )}
          <small>Typing filters local known symbols. Backend re-query runs only when you center a result.</small>
        </div>
        <form className="hf-d3-section" onSubmit={askQuestion}>
          <label>Ask a question</label>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={"What do you want to understand?\nTry: 'What are the entry points?' or\n'What handles authentication?'"} />
          <button type="submit" disabled={!repository || loading}>Ask →</button>
          <div className="hf-d3-chips">
            {lastQuestions.map((item) => <button type="button" key={item} onClick={() => askQuestion(undefined, item)}>{item}</button>)}
          </div>
        </form>
        <section className="hf-d3-section">
          <label>Entry points</label>
          <small>Start exploring from here</small>
          <div className="hf-d3-entry-list">
            {entryPoints.length ? entryPoints.map((node) => <button type="button" key={node.id} onClick={() => centerNode(node)}>● {node.name}</button>) : <span>No entry points loaded yet.</span>}
          </div>
        </section>
        <section className="hf-d3-section">
          <label>Architecture overview</label>
          <button type="button" onClick={showOverview} disabled={!repository || loading}>Show full overview</button>
          <div className="hf-d3-god-list">
            {overviewNodes.slice(0, 5).map((node) => <button type="button" key={node.id} onClick={() => centerNode(node)}>{node.name}<span>{node.connectionCount}</span></button>)}
          </div>
        </section>
        <details className="hf-d3-section hf-d3-disclosure">
          <summary>Modes and filters</summary>
          <label>Graph modes</label>
          <div className="hf-d3-mode-grid">
            {[
              ["force", "Map"],
              ["call_tree", "Call tree"],
              ["dependency", "Dependencies"],
              ["cluster", "Modules"],
              ["impact", "Impact"]
            ].map(([value, label]) => (
              <button className={layoutMode === value ? "active" : ""} type="button" key={value} onClick={() => changeLayoutMode(value as GraphLayoutMode)}>
                {label}
              </button>
            ))}
          </div>
          <small>{layoutMode === "call_tree" ? "Calls only, ranked from the selected center." : layoutMode === "dependency" ? "Imports, extends, and dependencies only." : layoutMode === "cluster" ? "Clusters nodes by module path." : layoutMode === "impact" ? "Risk-marked nodes and impact edges." : "Balanced architecture map."}</small>
          <label>Relationships</label>
          <div className="hf-d3-filter-grid">
            <button className={relationshipTypes.length === 0 ? "active" : ""} type="button" onClick={() => setRelationshipTypes([])}>
              <span style={{ background: "#d8dee9" }} />
              all
            </button>
            {RELATIONSHIPS.map((relationship) => (
              <button
                className={relationshipTypes.length === 0 || relationshipTypes.includes(relationship) ? "active" : ""}
                key={relationship}
                type="button"
                onClick={() => toggleRelationship(relationship)}
              >
                <span style={{ background: EDGE_COLOR[relationship] ?? "#555" }} />
                {relationship.replace("_", " ")}
              </button>
            ))}
          </div>
          <small>{relationshipTypes.length === 0 ? "All relationships visible" : `${relationshipTypes.length} relationship filters active`}</small>
          <label>Visible nodes</label>
          <div className="hf-d3-filter-grid">
            <button className={nodeTypes.length === 0 ? "active" : ""} type="button" onClick={() => setNodeTypes([])}>
              <span style={{ background: "#d8dee9" }} />
              all types
            </button>
            {NODE_TYPES.map((type) => (
              <button
                className={nodeTypes.length === 0 || nodeTypes.includes(type) ? "active" : ""}
                key={type}
                type="button"
                onClick={() => toggleNodeType(type)}
              >
                <span style={{ background: NODE_STYLE[type].stroke }} />
                {type.replace("_", " ")}
              </button>
            ))}
            <button className={riskFilter === "risky" ? "active" : ""} type="button" onClick={() => setRiskFilter((value) => value === "risky" ? "all" : "risky")}>
              <span style={{ background: "#F39C12" }} />
              high risk only
            </button>
          </div>
          <small>{visibleNodes.length || 0} nodes visible</small>
        </details>
        <details className="hf-d3-section hf-d3-disclosure">
          <summary>Impact and saved views</summary>
          <label>Blast radius</label>
          <textarea value={impactText} onChange={(event) => setImpactText(event.target.value)} placeholder="What are you planning to change?" />
          <button type="button" onClick={showImpact} disabled={!repository || loading}>Show impact →</button>
          <label>Saved views</label>
          <button type="button" onClick={saveCurrentView} disabled={!graph}>Save current view</button>
          <div className="hf-d3-god-list">
            {savedViews.map((view) => <button type="button" key={view.id} onClick={() => restoreSavedView(view)}>{view.name}<span>{view.graph.nodes.length}</span></button>)}
          </div>
        </details>
      </aside>
      <div className="hf-d3-main">
        <div className="hf-d3-status">
          <span>{graph ? `Centered on ${centeredLabel} — ${graph.nodes.length} nodes, ${visibleEdges.length} edges at depth ${depth}` : "No graph loaded"}</span>
          <nav>
            <button type="button" onClick={clearGraph}>Home</button>
            {breadcrumbs.map((item) => (
              <button type="button" key={item.id} onClick={() => revisitBreadcrumb(item)}>› {item.name}</button>
            ))}
          </nav>
          <div>
            <button type="button" onClick={() => changeDepth(-1)}>−</button>
            <strong>{depth}</strong>
            <button type="button" onClick={() => changeDepth(1)}>+</button>
            <button type="button" onClick={clearGraph}><RotateCcw size={14} /> Reset</button>
          </div>
        </div>
        {graph && (
          <div className="hf-d3-insight-bar">
            <span><GitBranch size={14} /> {graphStats.entryPoints} entry points</span>
            <span>{graphStats.files} files</span>
            <span>{graphStats.functions} functions</span>
            <span>{graphStats.classes} classes</span>
            <span className={graphStats.risky > 0 ? "risk" : ""}>{graphStats.risky} risk-marked</span>
            <span>{layoutMode.replace("_", " ")} mode</span>
          </div>
        )}
        <div className="hf-d3-canvas">
          <svg ref={svgRef} width="100%" height="100%" role="img" aria-label="Repository architecture graph" />
          {!graph && <EmptyState onAsk={(text) => askQuestion(undefined, text)} onOverview={showOverview} />}
          {loading && <div className="hf-d3-loading">Loading graph…</div>}
          {error && <div className="hf-d3-error">{error}</div>}
          {tooltip && <div className="hf-d3-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>{tooltip.node.name}<span>{tooltip.node.type} · {tooltip.node.connectionCount} links</span></div>}
          {graph && (
            <div className="hf-d3-canvas-controls" aria-label="Graph viewport controls">
              <button type="button" onClick={() => zoomCanvas(1.18)}>+</button>
              <button type="button" onClick={() => zoomCanvas(0.84)}>−</button>
              <button type="button" onClick={fitCurrentGraph}>Fit</button>
            </div>
          )}
          {graph && (
            <div className="hf-d3-legend" aria-label="Graph legend">
              {[
                ["entry_point", "Entry"],
                ["file", "File"],
                ["function", "Function"],
                ["class", "Class"]
              ].map(([type, label]) => (
                <span key={type}><i style={{ background: NODE_STYLE[type].stroke }} />{label}</span>
              ))}
            </div>
          )}
          {graph && <svg ref={minimapRef} className="hf-d3-minimap" width="120" height="80" />}
        </div>
      </div>
      {selected && (
        <aside className="hf-d3-detail">
          <button className="hf-d3-close" type="button" onClick={() => setSelected(undefined)}><X size={16} /></button>
          <div className="hf-d3-detail-head">
            <div>
              <h2>{selected.name}</h2>
              <p>{selected.path ?? "Repository node"}</p>
            </div>
            <span className="hf-d3-type" style={{ borderColor: styleFor(selected).stroke }}>{selected.type}</span>
          </div>
          <div className="hf-d3-node-meta">
            {selected.startLine && <span>Line {selected.startLine}{selected.endLine ? `-${selected.endLine}` : ""}</span>}
            <span>{selected.lastModifiedBy ? `Modified by ${selected.lastModifiedBy}` : "Owner unknown"}</span>
            <span>{selected.connectionCount} links</span>
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
              {summaryLoading ? <div className="hf-d3-skeleton" /> : <p>{summary?.summary ?? "Select a node to load a summary."}</p>}
              <label className="hf-d3-annotation">
                Team note
                <textarea
                  value={annotations[selected.id] ?? ""}
                  onChange={(event) => updateAnnotation(selected.id, event.target.value)}
                  placeholder="Add onboarding notes, ownership context, or review observations for this node."
                />
              </label>
              <div className="hf-d3-action-grid">
                <button type="button" onClick={() => setImpactText(`Change ${selected.name}`)}><ShieldAlert size={14} /> Prepare pre-mortem</button>
                <button type="button" onClick={showImpact}><Network size={14} /> Show blast radius</button>
                <button type="button" onClick={() => selected.path && navigator.clipboard?.writeText(`${selected.path}:${selected.startLine ?? 1}`)}>Copy source ref</button>
              </div>
            </section>
          )}
          {detailTab === "relationships" && (
            <section>
              <h3>Callers, callees, imports</h3>
              {detailLoading && <div className="hf-d3-skeleton" />}
              {!detailLoading && nodeContext?.relationshipGroups.length === 0 && <small>No relationships found for this node.</small>}
              <div className="hf-d3-relationship-groups">
                {nodeContext?.relationshipGroups.map((group) => (
                  <div key={`${group.direction}-${group.relationship}`}>
                    <h4>{group.direction === "incoming" ? "Incoming" : "Outgoing"} {group.relationship.replace("_", " ")}</h4>
                    {group.nodes.map((node) => (
                      <div className="hf-d3-rel-row" key={`${group.direction}-${group.relationship}-${node.id}`}>
                        <button type="button" onClick={() => centerNode(node)}>{styleFor(node).icon} <span>{node.name}<small>{node.path ?? node.type}</small></span></button>
                        <button type="button" onClick={() => explainConnection(node)} disabled={pathLoading}>Why?</button>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>
          )}
          {detailTab === "code" && (
            <section>
              <h3>Source evidence</h3>
              {detailLoading && <div className="hf-d3-skeleton" />}
              {!detailLoading && nodeSource?.unavailableReason && <p>{nodeSource.unavailableReason}</p>}
              {!detailLoading && nodeSource?.snippet && <pre className="hf-d3-code"><code>{nodeSource.snippet}</code></pre>}
            </section>
          )}
          {detailTab === "evidence" && (
            <section>
              <h3>Why connected?</h3>
              {pathLoading && <div className="hf-d3-skeleton" />}
              {highlightPath ? (
                <div className="hf-d3-path-card">
                  <strong>{highlightPath.confidence} evidence path</strong>
                  <p>{highlightPath.explanation}</p>
                  <ol>
                    {highlightPath.edges.map((edge) => <li key={edge.id}>{edge.type.replace("_", " ")} {edge.evidencePath ? `in ${edge.evidencePath}${edge.evidenceLine ? `:${edge.evidenceLine}` : ""}` : "from twin edge evidence"}</li>)}
                  </ol>
                </div>
              ) : <small>Open Links and press “Why?” on a neighbor to highlight the exact path.</small>}
              <div className="hf-d3-evidence-list">
                {nodeContext?.evidenceEdges.slice(0, 12).map((edge) => (
                  <span key={edge.id}>{edge.type.replace("_", " ")} · {edge.evidencePath ?? "twin edge"}{edge.evidenceLine ? `:${edge.evidenceLine}` : ""}</span>
                ))}
              </div>
            </section>
          )}
          {detailTab === "risk" && (
            <section>
              <h3>Impact posture</h3>
              <div className={`hf-d3-risk-card risk-${severityByNode.get(selected.id) ?? selected.risk}`}>
                <strong>{(severityByNode.get(selected.id) ?? selected.risk).toUpperCase()}</strong>
                <p>Risk is derived from twin metadata and pre-mortem overlays. HIGH and CRITICAL findings require human approval before automation.</p>
                {impactStats && <small>{impactStats.direct} direct neighbors, {impactStats.transitive} transitive nodes, {impactStats.confidence}% confidence from exact twin edges.</small>}
              </div>
              <div className="hf-d3-action-grid">
                <button type="button" onClick={() => setImpactText(`Change ${selected.name}`)}><ShieldAlert size={14} /> Run pre-mortem</button>
                <button type="button" onClick={showImpact}><Network size={14} /> Calculate impact</button>
              </div>
            </section>
          )}
        </aside>
      )}
    </section>
  );
}

function drawNode(selection: d3.Selection<SVGGElement, D3Node, null, undefined>, node: D3Node, severity?: Risk, selected = false) {
  const style = styleFor(node, severity);
  selection.append("circle").attr("r", 28).attr("fill", style.stroke).attr("opacity", selected ? 0.4 : 0.15).attr("filter", "url(#node-blur)");
  if (node.type === "entry_point") {
    selection.append("path").attr("d", d3.symbol().type(d3.symbolStar).size(1050)() ?? "").attr("fill", style.fill).attr("stroke", selected ? "#ffffff" : style.stroke).attr("stroke-width", selected ? 3 : 2);
  } else if (node.type === "file") {
    selection.append("rect").attr("x", -34).attr("y", -18).attr("width", 68).attr("height", 36).attr("rx", 7).attr("fill", style.fill).attr("stroke", selected ? "#ffffff" : style.stroke).attr("stroke-width", selected ? 3 : 1.5);
  } else if (node.type === "class") {
    selection.append("rect").attr("x", -19).attr("y", -19).attr("width", 38).attr("height", 38).attr("transform", "rotate(45)").attr("fill", style.fill).attr("stroke", selected ? "#ffffff" : style.stroke).attr("stroke-width", selected ? 3 : 1.5);
  } else {
    selection.append("circle").attr("r", 22).attr("fill", style.fill).attr("stroke", selected ? "#ffffff" : style.stroke).attr("stroke-width", selected ? 3 : 1.5);
  }
  selection.append("text").attr("class", "hf-d3-label-main").attr("dy", -2).text(truncate(node.name, 18));
  selection.append("text").attr("class", "hf-d3-label-sub").attr("dy", 13).text(truncate(node.path ?? node.type, 24));
}

function EmptyState({ onAsk, onOverview }: { onAsk: (question: string) => void; onOverview: () => void }) {
  return (
    <div className="hf-d3-empty">
      <Network size={42} />
      <h2>Your codebase, understood</h2>
      <p>Ask a question or pick an entry point to begin</p>
      <div>{SUGGESTIONS.map((item) => <button key={item} type="button" onClick={() => item.includes("overview") ? onOverview() : onAsk(item)}>{item}</button>)}</div>
    </div>
  );
}

function connectedNodeList(nodeId: string, graph: GraphView | undefined, edges: GraphEdge[]): GraphNode[] {
  if (!graph) return [];
  const ids = new Set<string>();
  for (const edge of edges) {
    if (edge.source === nodeId) ids.add(edge.target);
    if (edge.target === nodeId) ids.add(edge.source);
  }
  return graph.nodes.filter((node) => ids.has(node.id));
}

function uniqueNodes(nodes: GraphNode[]): GraphNode[] {
  const seen = new Set<string>();
  const result: GraphNode[] = [];
  for (const node of nodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    result.push(node);
  }
  return result;
}

function searchNodes(query: string, nodes: GraphNode[], severityByNode: Map<string, Risk>): GraphNode[] {
  const term = query.trim().toLowerCase();
  if (term.length < 2) return [];
  const tokens = term.split(/\s+/).filter(Boolean);
  const filters = {
    type: tokenValue(tokens, "type"),
    path: tokenValue(tokens, "path"),
    risk: tokenValue(tokens, "risk")
  };
  const textTerms = tokens.filter((token) => !token.includes(":"));
  return nodes
    .map((node) => {
      const haystack = `${node.name} ${node.path ?? ""} ${node.type}`.toLowerCase();
      const textMatch = textTerms.length === 0 || textTerms.every((item) => haystack.includes(item));
      const typeMatch = !filters.type || node.type === filters.type || (filters.type === "entry" && node.type === "entry_point");
      const pathMatch = !filters.path || (node.path ?? "").toLowerCase().includes(filters.path);
      const risk = severityByNode.get(node.id) ?? node.risk;
      const riskMatch = !filters.risk || risk === filters.risk;
      const starts = textTerms.some((item) => node.name.toLowerCase().startsWith(item)) ? 0 : 1;
      const contains = textMatch && typeMatch && pathMatch && riskMatch ? 0 : 10;
      return { node, score: contains + starts + Math.min(9, node.type === "entry_point" ? 0 : node.type === "file" ? 1 : 2) };
    })
    .filter((item) => item.score < 10)
    .sort((a, b) => a.score - b.score || b.node.connectionCount - a.node.connectionCount)
    .slice(0, 6)
    .map((item) => item.node);
}

function tokenValue(tokens: string[], key: string): string | undefined {
  return tokens.find((token) => token.startsWith(`${key}:`))?.slice(key.length + 1);
}

function relationshipsForLayout(layoutMode: GraphLayoutMode): string[] {
  if (layoutMode === "call_tree") return ["calls"];
  if (layoutMode === "dependency") return ["imports", "extends", "depends_on"];
  return [];
}

function layoutCoordinates(nodes: D3Node[], links: D3Link[], mode: GraphLayoutMode, selectedId: string | undefined, width: number, height: number) {
  const hints = new Map<string, { x: number; y: number }>();
  if (mode === "force") return hints;
  const centerId = selectedId ?? nodes[0]?.id;
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node.id, new Set());
  for (const link of links) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    adjacency.get(source)?.add(target);
    adjacency.get(target)?.add(source);
  }
  const levels = new Map<string, number>();
  if (centerId) {
    levels.set(centerId, 0);
    const queue = [centerId];
    for (const id of queue) {
      const nextLevel = (levels.get(id) ?? 0) + 1;
      for (const next of adjacency.get(id) ?? []) {
        if (levels.has(next)) continue;
        levels.set(next, nextLevel);
        queue.push(next);
      }
    }
  }
  const moduleNames = [...new Set(nodes.map((node) => (node.path ?? node.type).split("/")[0] || node.type))];
  const moduleIndex = new Map(moduleNames.map((name, index) => [name, index]));
  for (const [index, node] of nodes.entries()) {
    const level = levels.get(node.id) ?? Math.min(4, index % 5);
    const moduleName = (node.path ?? node.type).split("/")[0] || node.type;
    const cluster = moduleIndex.get(moduleName) ?? 0;
    if (mode === "call_tree" || mode === "dependency" || mode === "impact") {
      hints.set(node.id, { x: 90 + level * Math.max(120, width / 5), y: 90 + (index % Math.max(1, Math.ceil(nodes.length / 4))) * 74 });
    } else {
      const angle = (cluster / Math.max(1, moduleNames.length)) * Math.PI * 2;
      hints.set(node.id, { x: width / 2 + Math.cos(angle) * width * 0.24, y: height / 2 + Math.sin(angle) * height * 0.24 });
    }
  }
  return hints;
}

function calculateImpact(nodeId: string, graph: GraphView | undefined, edges: GraphEdge[]) {
  if (!graph) return { direct: 0, transitive: 0, confidence: 0 };
  const direct = new Set<string>();
  const transitive = new Set<string>();
  const exactEdges = edges.filter((edge) => edge.confidence === "exact").length;
  for (const edge of edges) {
    if (edge.source === nodeId) direct.add(edge.target);
    if (edge.target === nodeId) direct.add(edge.source);
  }
  for (const edge of edges) {
    if (direct.has(edge.source) && edge.target !== nodeId) transitive.add(edge.target);
    if (direct.has(edge.target) && edge.source !== nodeId) transitive.add(edge.source);
  }
  direct.forEach((id) => transitive.delete(id));
  return { direct: direct.size, transitive: transitive.size, confidence: edges.length ? Math.round((exactEdges / edges.length) * 100) : 0 };
}

function mergePathIntoGraph(graph: GraphView, path: GraphPath): GraphView {
  const nodes = uniqueNodes([...graph.nodes, ...path.nodes]);
  const edgeIds = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const edge of [...graph.edges, ...path.edges]) {
    if (edgeIds.has(edge.id)) continue;
    edgeIds.add(edge.id);
    edges.push(edge);
  }
  return { ...graph, nodes, edges };
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

function summarizeNodes(nodes: GraphNode[]) {
  const stats = { entryPoints: 0, files: 0, functions: 0, classes: 0, risky: 0 };
  for (const node of nodes) {
    if (node.isEntryPoint || node.type === "entry_point") stats.entryPoints += 1;
    if (node.type === "file") stats.files += 1;
    if (node.type === "function") stats.functions += 1;
    if (node.type === "class") stats.classes += 1;
    if (node.risk && node.risk !== "none") stats.risky += 1;
  }
  return stats;
}

function endpointId(endpoint: string | number | D3Node | undefined): string {
  if (typeof endpoint === "object" && endpoint && "id" in endpoint) return endpoint.id;
  return String(endpoint ?? "");
}

function styleFor(node: Pick<GraphNode, "type">, severity?: Risk) {
  if (severity === "critical") return { fill: "#2d0a0a", stroke: "#E74C3C", icon: "!" };
  if (severity === "high") return { fill: "#2d1a0a", stroke: "#F39C12", icon: "!" };
  if (severity === "medium") return { fill: NODE_STYLE[node.type]?.fill ?? "#151922", stroke: "#F1C40F", icon: "!" };
  return NODE_STYLE[node.type] ?? NODE_STYLE.function;
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
