from __future__ import annotations

import networkx as nx

DEPTH_NODE_LIMITS = {1: 12, 2: 25, 3: 40, 4: 40}
DEPTH_EDGE_LIMITS = {1: 24, 2: 60, 3: 100, 4: 100}


def centered_subgraph(
    graph: nx.MultiDiGraph,
    center: str,
    depth: int = 2,
    relationship_types: list[str] | None = None,
    max_nodes: int | None = None,
    max_edges: int | None = None,
) -> nx.MultiDiGraph:
    if center not in graph:
        return nx.MultiDiGraph()
    filters = set(relationship_types or [])
    max_nodes = max_nodes or DEPTH_NODE_LIMITS.get(depth, 40)
    max_edges = max_edges or DEPTH_EDGE_LIMITS.get(depth, 100)
    seen = {center}
    frontier = {center}
    edges: set[tuple[str, str, str]] = set()
    for _ in range(depth):
        next_frontier: set[str] = set()
        for node in frontier:
            incident_edges: list[tuple[str, str, str, dict]] = []
            for source, target, key, data in graph.out_edges(node, keys=True, data=True):
                if filters and data.get("type") not in filters:
                    continue
                incident_edges.append((source, target, key, data))
            for source, target, key, data in graph.in_edges(node, keys=True, data=True):
                if filters and data.get("type") not in filters:
                    continue
                incident_edges.append((source, target, key, data))
            incident_edges.sort(key=lambda item: _edge_priority(graph, center, item))
            for source, target, key, _data in incident_edges:
                if len(seen) >= max_nodes or len(edges) >= max_edges:
                    break
                target_node = target if source == node else source
                if target_node not in seen and len(seen) >= max_nodes:
                    continue
                if _is_noise_node(graph.nodes[target]) or _is_noise_node(graph.nodes[source]):
                    continue
                seen.add(target)
                seen.add(source)
                next_frontier.add(target_node)
                edges.add((source, target, key))
            if len(seen) >= max_nodes or len(edges) >= max_edges:
                break
        frontier = next_frontier - frontier
        if not frontier or len(seen) >= max_nodes or len(edges) >= max_edges:
            break
    sub = nx.MultiDiGraph()
    for node in seen:
        sub.add_node(node, **graph.nodes[node])
    for source, target, key in edges:
        if source in seen and target in seen:
            sub.add_edge(source, target, key=key, **graph.edges[source, target, key])
    return sub


def _edge_priority(graph: nx.MultiDiGraph, center: str, edge: tuple[str, str, str, dict]) -> tuple[int, str]:
    source, target, _key, data = edge
    relationship = data.get("type", "")
    other = target if source == center else source
    node_type = graph.nodes[other].get("type", "")
    relationship_rank = {"extends": 0, "calls": 1, "imports": 2, "depends_on": 3}.get(relationship, 4)
    node_rank = {"class": 0, "function": 1, "file": 2, "repository": 3}.get(node_type, 4)
    return (relationship_rank + node_rank, str(graph.nodes[other].get("name", other)))


def first_matching_node(graph: nx.MultiDiGraph, query: str) -> str | None:
    needle = query.lower()
    for node_id, data in graph.nodes(data=True):
        if _is_noise_node(data):
            continue
        if needle in str(data.get("name", "")).lower() or needle in str(data.get("path", "")).lower():
            return node_id
    return next((node_id for node_id, data in graph.nodes(data=True) if not _is_noise_node(data)), None)


def _is_noise_node(data: dict) -> bool:
    path = str(data.get("path") or "")
    parts = set(path.split("/"))
    if parts.intersection({"tests", "test", "vendor", "node_modules", "docs", "doc", "examples", "fixtures", "migrations"}):
        return True
    name = path.rsplit("/", 1)[-1]
    return name.startswith("test_") or name.endswith("_test.py") or name.endswith(".test.ts") or name.endswith(".spec.ts") or name == "conftest.py"
