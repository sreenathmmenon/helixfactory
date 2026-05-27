from __future__ import annotations

import networkx as nx


def resolve_targets(graph: nx.MultiDiGraph, target_refs: list[str]) -> list[str]:
    resolved: list[str] = []
    for ref in target_refs:
        if ref in graph:
            resolved.append(ref)
            continue
        needle = ref.lower()
        for node_id, data in graph.nodes(data=True):
            if needle in str(data.get("name", "")).lower() or needle in str(data.get("path", "")).lower():
                resolved.append(node_id)
                break
    return resolved
