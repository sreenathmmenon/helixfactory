from __future__ import annotations

import json
from pathlib import Path
import re

import networkx as nx

from helixfactory.api.schemas.models import GraphCenter, GraphEdge, GraphNode, GraphPath, GraphView, NodeContext, NodeRelationshipGroup, NodeSource
from helixfactory.api.schemas.requests import GraphAskRequest, GraphPathRequest, GraphQueryRequest, NodeContextRequest, NodeSourceRequest, NodeSummaryRequest, NodeSummaryResponse
from helixfactory.graph.traversal import centered_subgraph, first_matching_node
from helixfactory.services.errors import NotFoundError
from helixfactory.services.runtime import RuntimeState, runtime


class GraphQueryService:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state
        self._summary_cache: dict[tuple[str, str], str] = {}

    def query(self, request: GraphQueryRequest) -> GraphView:
        graph = self.state.graph_store.load(request.repository_id)
        center_id = request.center.value if request.center.type == "node" else first_matching_node(graph, request.center.value)
        if not center_id:
            return GraphView(center=request.center, nodes=[], edges=[], depth=request.depth, risk_summary={})
        sub = centered_subgraph(graph, center_id, request.depth, request.relationship_types)
        center = GraphCenter(type="node", value=center_id)
        nodes = [
            self._graph_node(node_id, data, graph)
            for node_id, data in sub.nodes(data=True)
            if not self._is_noise(data) and (data.get("type") != "repository" or node_id == center_id)
        ]
        node_ids = {node.id for node in nodes}
        edges = self._graph_edges(sub, node_ids)
        risks: dict[str, int] = {}
        for node in nodes:
            risks[node.risk] = risks.get(node.risk, 0) + 1
        return GraphView(center=center, nodes=nodes, edges=edges, depth=request.depth, risk_summary=risks)

    def overview(self, repository_id: str) -> GraphView:
        graph = self.state.graph_store.load(repository_id)
        ranked = self._ranked_nodes(graph)
        nodes = ranked[:15]
        node_ids = {node.id for node in nodes}
        edges = self._graph_edges(graph, node_ids)[:40]
        center = GraphCenter(type="node", value=nodes[0].id if nodes else repository_id)
        return GraphView(center=center, nodes=nodes, edges=edges, depth=1, risk_summary={})

    def ask(self, request: GraphAskRequest) -> GraphView:
        graph = self.state.graph_store.load(request.repository_id)
        question = request.question.lower()
        terms = _expanded_question_terms(question)
        if "entry point" in question or "start" in question:
            candidates = [node_id for node_id, data in graph.nodes(data=True) if self._is_entry(data)]
        elif "critical" in question or "most connected" in question or "overview" in question:
            return self.overview(request.repository_id)
        elif match := re.search(r"connects? to ([\\w./_-]+)", question):
            center_id = first_matching_node(graph, match.group(1))
            return self.query(GraphQueryRequest(repository_id=request.repository_id, center=GraphCenter(type="node", value=center_id or match.group(1)), depth=1))
        else:
            scored = [
                (node_id, _question_match_score(graph, node_id, data, terms, question))
                for node_id, data in graph.nodes(data=True)
                if not self._is_noise(data)
            ]
            candidates = [node_id for node_id, score in scored if score > 0]
        if not candidates:
            return GraphView(center=GraphCenter(type="query", value=request.question), nodes=[], edges=[], depth=1, risk_summary={"insufficient_evidence": 1})
        center_id = sorted(
            candidates,
            key=lambda node_id: (
                _question_match_score(graph, node_id, graph.nodes[node_id], terms, question),
                graph.degree(node_id),
            ),
            reverse=True,
        )[0]
        return self._limit_view(
            self.query(GraphQueryRequest(repository_id=request.repository_id, center=GraphCenter(type="node", value=center_id), depth=2)),
            max_nodes=20,
        )

    def node_summary(self, request: NodeSummaryRequest) -> NodeSummaryResponse:
        cache_key = (request.repository_id, request.node_id)
        if cache_key in self._summary_cache:
            return NodeSummaryResponse(node_id=request.node_id, summary=self._summary_cache[cache_key])
        graph = self.state.graph_store.load(request.repository_id)
        if request.node_id not in graph:
            summary = "This node is not available in the current repository twin."
        else:
            data = graph.nodes[request.node_id]
            connection_count = graph.degree(request.node_id)
            incoming_files = {
                graph.nodes[source].get("path")
                for source, _target in graph.in_edges(request.node_id)
                if graph.nodes[source].get("path")
            }
            node_type = "entry point" if self._is_entry(data) else data.get("type", "node")
            path = data.get("path") or "the repository"
            summary = (
                f"This {node_type} represents {data.get('name', request.node_id)} in {path}. "
                f"It connects to {connection_count} nodes across {max(1, len(incoming_files))} files in the twin."
            )
            ai_summary = self._ai_node_summary(graph, request.node_id, summary)
            if ai_summary:
                summary = ai_summary
        self._summary_cache[cache_key] = summary
        return NodeSummaryResponse(node_id=request.node_id, summary=summary)

    def node_context(self, request: NodeContextRequest) -> NodeContext:
        graph = self.state.graph_store.load(request.repository_id)
        if request.node_id not in graph:
            raise NotFoundError("Node was not found in the repository twin.", {"repositoryId": request.repository_id, "nodeId": request.node_id})
        node_ids = {node_id for node_id, data in graph.nodes(data=True) if not self._is_noise(data)}
        if request.node_id not in node_ids:
            raise NotFoundError("Node is filtered from the production twin view.", {"repositoryId": request.repository_id, "nodeId": request.node_id})
        groups: list[NodeRelationshipGroup] = []
        evidence_edges: list[GraphEdge] = []
        for direction in ("incoming", "outgoing"):
            buckets: dict[str, tuple[list[GraphNode], list[GraphEdge]]] = {}
            raw_edges = graph.in_edges(request.node_id, keys=True, data=True) if direction == "incoming" else graph.out_edges(request.node_id, keys=True, data=True)
            for source, target, key, data in raw_edges:
                other_id = source if direction == "incoming" else target
                if other_id not in node_ids:
                    continue
                edge = self._graph_edge(source, target, key, data)
                relationship = edge.type
                nodes, edges = buckets.setdefault(relationship, ([], []))
                nodes.append(self._graph_node(other_id, graph.nodes[other_id], graph))
                edges.append(edge)
                evidence_edges.append(edge)
            for relationship, (nodes, edges) in sorted(buckets.items()):
                groups.append(
                    NodeRelationshipGroup(
                        relationship=relationship,
                        direction=direction,  # type: ignore[arg-type]
                        nodes=sorted(nodes, key=lambda item: (-item.connection_count, item.name.lower()))[:16],
                        edges=edges[:24],
                    )
                )
        return NodeContext(
            node=self._graph_node(request.node_id, graph.nodes[request.node_id], graph),
            relationship_groups=groups,
            evidence_edges=evidence_edges[:48],
        )

    def node_source(self, request: NodeSourceRequest) -> NodeSource:
        graph = self.state.graph_store.load(request.repository_id)
        if request.node_id not in graph:
            raise NotFoundError("Node was not found in the repository twin.", {"repositoryId": request.repository_id, "nodeId": request.node_id})
        data = graph.nodes[request.node_id]
        path = data.get("path")
        start_line = data.get("start_line")
        end_line = data.get("end_line")
        repository = self.state.repositories.get(request.repository_id)
        if not path or not repository or not repository.local_path:
            return NodeSource(
                node_id=request.node_id,
                path=path,
                start_line=start_line,
                end_line=end_line,
                language=data.get("language"),
                unavailable_reason="Source is unavailable because this node has no resolved repository file path.",
            )
        root = Path(repository.local_path).resolve()
        file_path = (root / path).resolve()
        try:
            file_path.relative_to(root)
        except ValueError:
            return NodeSource(
                node_id=request.node_id,
                path=path,
                start_line=start_line,
                end_line=end_line,
                language=data.get("language"),
                unavailable_reason="Source path is outside the repository checkout and was blocked.",
            )
        if not file_path.exists() or not file_path.is_file():
            return NodeSource(
                node_id=request.node_id,
                path=path,
                start_line=start_line,
                end_line=end_line,
                language=data.get("language"),
                unavailable_reason="Source file is not present in the local repository checkout.",
            )
        lines = file_path.read_text(encoding="utf-8", errors="replace").splitlines()
        first = max(1, int(start_line or 1) - 3)
        last = min(len(lines), int(end_line or start_line or min(len(lines), 80)) + 3)
        if last - first > 120:
            last = first + 120
        numbered = [f"{line_no:>4}  {lines[line_no - 1]}" for line_no in range(first, last + 1)]
        return NodeSource(
            node_id=request.node_id,
            path=path,
            start_line=start_line,
            end_line=end_line,
            language=data.get("language"),
            snippet="\n".join(numbered),
        )

    def path_between(self, request: GraphPathRequest) -> GraphPath:
        graph = self.state.graph_store.load(request.repository_id)
        if request.source_node_id not in graph or request.target_node_id not in graph:
            raise NotFoundError(
                "One or both nodes were not found in the repository twin.",
                {"repositoryId": request.repository_id, "sourceNodeId": request.source_node_id, "targetNodeId": request.target_node_id},
            )
        allowed_relationships = set(request.relationship_types)
        simple = nx.Graph()
        for node_id, data in graph.nodes(data=True):
            if not self._is_noise(data):
                simple.add_node(node_id)
        edge_lookup: dict[tuple[str, str], GraphEdge] = {}
        for source, target, key, data in graph.edges(keys=True, data=True):
            if source not in simple or target not in simple:
                continue
            if allowed_relationships and data.get("type") not in allowed_relationships:
                continue
            simple.add_edge(source, target)
            edge = self._graph_edge(source, target, key, data)
            edge_lookup[(source, target)] = edge
            edge_lookup[(target, source)] = edge
        try:
            path_ids = nx.shortest_path(simple, request.source_node_id, request.target_node_id)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            raise NotFoundError(
                "No evidence path connects these nodes inside the current twin filters.",
                {"repositoryId": request.repository_id, "sourceNodeId": request.source_node_id, "targetNodeId": request.target_node_id},
            ) from None
        if len(path_ids) - 1 > request.max_depth:
            raise NotFoundError(
                "The closest evidence path exceeds the requested path depth.",
                {"repositoryId": request.repository_id, "depth": len(path_ids) - 1, "maxDepth": request.max_depth},
            )
        edges = [edge_lookup[(source, target)] for source, target in zip(path_ids, path_ids[1:])]
        nodes = [self._graph_node(node_id, graph.nodes[node_id], graph) for node_id in path_ids]
        confidence = "exact" if all(edge.confidence == "exact" for edge in edges) else "partial"
        readable_path = " -> ".join(node.name for node in nodes)
        relationships = ", ".join(edge.type.replace("_", " ") for edge in edges)
        return GraphPath(
            source=nodes[0],
            target=nodes[-1],
            nodes=nodes,
            edges=edges,
            explanation=f"{nodes[0].name} connects to {nodes[-1].name} through {len(edges)} evidence-backed relationship(s): {readable_path}. Relationship chain: {relationships}.",
            confidence=confidence,  # type: ignore[arg-type]
        )

    def _ai_node_summary(self, graph, node_id: str, fallback: str) -> str | None:
        data = graph.nodes[node_id]
        if not data.get("path") or not data.get("start_line"):
            return None
        connected = []
        for source, target, edge_data in list(graph.in_edges(node_id, data=True))[:5] + list(graph.out_edges(node_id, data=True))[:5]:
            other = source if target == node_id else target
            other_data = graph.nodes[other]
            connected.append(
                {
                    "relationship": edge_data.get("type", "depends_on"),
                    "name": other_data.get("name"),
                    "type": other_data.get("type"),
                    "path": other_data.get("path"),
                    "line": other_data.get("start_line"),
                }
            )
        payload = {
            "instruction": "Write a 1-2 sentence plain-English summary only from this twin evidence. Do not invent behavior. If evidence is sparse, mention that.",
            "fallbackSummary": fallback,
            "node": {
                "name": data.get("name"),
                "type": data.get("type"),
                "path": data.get("path"),
                "line": data.get("start_line"),
                "owner": data.get("owner") or data.get("last_modified_by"),
                "connectionCount": graph.degree(node_id),
            },
            "connectedEvidence": connected,
        }
        result = self.state.ai_provider.generate_json(
            system="You summarize code twin nodes for engineers. Stay evidence-constrained.",
            prompt=json.dumps(payload, indent=2),
            max_tokens=400,
        )
        if not result:
            return None
        summary = result.get("summary")
        return str(summary).strip() if summary else None

    def _ranked_nodes(self, graph) -> list[GraphNode]:
        nodes = [
            self._graph_node(node_id, data, graph)
            for node_id, data in graph.nodes(data=True)
            if not self._is_noise(data) and data.get("type") != "repository"
        ]
        return sorted(nodes, key=lambda node: node.connection_count, reverse=True)

    @staticmethod
    def _limit_view(view: GraphView, max_nodes: int) -> GraphView:
        nodes = sorted(
            view.nodes,
            key=lambda node: (node.id != view.center.value, -node.connection_count, node.name.lower()),
        )[:max_nodes]
        node_ids = {node.id for node in nodes}
        return GraphView(
            center=view.center,
            nodes=nodes,
            edges=[edge for edge in view.edges if edge.source in node_ids and edge.target in node_ids],
            depth=view.depth,
            risk_summary=view.risk_summary,
        )

    def _graph_node(self, node_id: str, data: dict, graph) -> GraphNode:
        return GraphNode(
            id=node_id,
            type="entry_point" if self._is_entry(data) else data.get("type", "unknown"),
            name=data.get("name", node_id),
            path=data.get("path"),
            start_line=data.get("start_line"),
            end_line=data.get("end_line"),
            owner=data.get("owner"),
            last_modified_by=data.get("last_modified_by"),
            last_modified_at=data.get("last_modified_at"),
            connection_count=graph.degree(node_id),
            is_entry_point=self._is_entry(data),
            risk=data.get("risk", "none"),
        )

    def _graph_edges(self, graph, node_ids: set[str]) -> list[GraphEdge]:
        return [
            self._graph_edge(source, target, key, data)
            for source, target, key, data in graph.edges(keys=True, data=True)
            if source in node_ids and target in node_ids
        ]

    @staticmethod
    def _graph_edge(source: str, target: str, key: str, data: dict) -> GraphEdge:
        return GraphEdge(
            id=data.get("id", key),
            source=source,
            target=target,
            type=data.get("type", "depends_on"),
            confidence=data.get("confidence", "exact"),
            evidence_path=data.get("evidence_path"),
            evidence_line=data.get("evidence_line"),
        )

    @staticmethod
    def _is_entry(data: dict) -> bool:
        return data.get("type") == "entry_point" or bool(data.get("metadata", {}).get("is_entry_point"))

    @staticmethod
    def _is_noise(data: dict) -> bool:
        path = str(data.get("path") or "")
        parts = set(path.split("/"))
        name = path.rsplit("/", 1)[-1]
        return bool(parts.intersection({"tests", "test", "vendor", "node_modules", "docs", "docs_src", "doc", "examples", "fixtures", "migrations"})) or name.startswith("test_") or name.endswith("_test.py") or name.endswith(".test.ts") or name.endswith(".spec.ts") or name == "conftest.py"


def _expanded_question_terms(question: str) -> list[str]:
    stop = {"what", "how", "does", "handle", "handles", "work", "feature", "are", "the", "and", "for", "with", "that", "this"}
    terms = [term for term in re.findall(r"[a-zA-Z_][\w_]+", question.lower()) if len(term) > 2 and term not in stop]
    aliases = {
        "auth": ["auth", "security", "oauth", "jwt", "token", "credential", "login", "permission"],
        "authentication": ["auth", "security", "oauth", "jwt", "token", "credential", "login", "permission"],
        "authorization": ["auth", "security", "scope", "permission", "token"],
        "route": ["route", "routes", "router", "routing", "endpoint", "dispatch", "request", "url_rule", "url_map", "blueprint"],
        "router": ["route", "routes", "router", "routing", "endpoint", "dispatch", "request", "url_rule", "url_map", "blueprint"],
        "routing": ["route", "routes", "router", "routing", "endpoint", "dispatch", "request", "url_rule", "url_map", "blueprint"],
        "startup": ["startup", "lifespan", "app", "main", "asgi"],
        "database": ["database", "db", "sql", "session", "migration", "model"],
    }
    expanded: list[str] = []
    for term in terms:
        expanded.extend(aliases.get(term, [term]))
    return list(dict.fromkeys(expanded))


def _question_match_score(graph, node_id: str, data: dict, terms: list[str], question: str) -> float:
    name = str(data.get("name") or "").lower()
    path = str(data.get("path") or "").lower()
    node_type = str(data.get("type") or "")
    haystack = f"{name} {path}"
    score = 0.0
    for term in terms:
        normalized = term.lower()
        if name == normalized:
            score += 40
        elif name.startswith(normalized):
            score += 26
        elif normalized in name:
            score += 18
        elif normalized in path:
            score += 8
    if data.get("metadata", {}).get("is_entry_point") or data.get("type") == "entry_point":
        score += 6
    if node_type in {"function", "class"}:
        score += 4
    if node_type == "file":
        score += 2
    if "routing" in question or "route" in question or "router" in question:
        if any(token in haystack for token in ("dispatch", "url_rule", "url_map", "endpoint", "blueprint")):
            score += 22
        if path.endswith("app.py") or "app.py" in path:
            score += 34
        if "blueprint" in haystack:
            score += 18
        if name in {"flask", "app", "wsgi_app", "full_dispatch_request", "dispatch_request"}:
            score += 34
        if "cli" in path and "routes_command" in name:
            score -= 70
    if "auth" in question or "authentication" in question or "authorization" in question:
        if any(token in haystack for token in ("auth", "login", "token", "credential", "permission", "security")):
            score += 18
    return score + min(12, graph.degree(node_id) * 0.35)
