from __future__ import annotations

import networkx as nx


def resolve_targets(graph: nx.MultiDiGraph, target_refs: list[str]) -> list[str]:
    resolved: list[str] = []
    for ref in target_refs:
        if ref in graph:
            resolved.append(ref)
            continue
        needle = ref.lower()
        matches = [
            node_id
            for node_id, data in graph.nodes(data=True)
            if needle in str(data.get("name", "")).lower() or needle in str(data.get("path", "")).lower()
        ]
        if matches:
            resolved.append(
                sorted(
                    matches,
                    key=lambda node_id: (
                        _match_quality(graph.nodes[node_id], needle),
                        graph.degree(node_id),
                    ),
                    reverse=True,
                )[0]
            )
    return resolved


def _match_quality(data: dict, needle: str) -> int:
    name = str(data.get("name") or "").lower()
    path = str(data.get("path") or "").lower()
    node_type = str(data.get("type") or "")
    file_name = path.rsplit("/", 1)[-1]
    if name == needle or file_name == needle:
        return 100
    if path.endswith(f"/{needle}") or path == needle:
        return 90
    if name.startswith(needle):
        return 70
    if needle in name:
        return 55
    if needle in path and node_type in {"function", "class"}:
        return 45
    if needle in path:
        return 35
    return 0
