from __future__ import annotations

import json
from pathlib import Path

import networkx as nx

from helixfactory.api.schemas.models import TwinEdge, TwinNode


class JsonGraphStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self._cache: dict[str, tuple[int, nx.MultiDiGraph]] = {}

    def graph_path(self, repository_id: str) -> Path:
        return self.root / f"{repository_id}.graph.json"

    def save(self, repository_id: str, nodes: list[TwinNode], edges: list[TwinEdge]) -> None:
        payload = {
            "nodes": [n.model_dump(mode="json", by_alias=False) for n in nodes],
            "edges": [e.model_dump(mode="json", by_alias=False) for e in edges],
        }
        path = self.graph_path(repository_id)
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        self._cache.pop(repository_id, None)

    def load(self, repository_id: str) -> nx.MultiDiGraph:
        path = self.graph_path(repository_id)
        if not path.exists():
            self._cache.pop(repository_id, None)
            return nx.MultiDiGraph()
        mtime_ns = path.stat().st_mtime_ns
        cached = self._cache.get(repository_id)
        if cached and cached[0] == mtime_ns:
            return cached[1]
        graph = nx.MultiDiGraph()
        payload = json.loads(path.read_text(encoding="utf-8"))
        for node in payload.get("nodes", []):
            graph.add_node(node["id"], **node)
        for edge in payload.get("edges", []):
            graph.add_edge(edge["source_node_id"], edge["target_node_id"], key=edge["id"], **edge)
        self._cache[repository_id] = (mtime_ns, graph)
        return graph

    def counts(self, repository_id: str) -> tuple[int, int]:
        graph = self.load(repository_id)
        return graph.number_of_nodes(), graph.number_of_edges()
