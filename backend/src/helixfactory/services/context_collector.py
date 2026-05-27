from __future__ import annotations

from helixfactory.graph.traversal import first_matching_node
from helixfactory.services.runtime import RuntimeState, runtime


class ContextCollector:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state

    def collect(self, repository_id: str, summary: str) -> list[str]:
        graph = self.state.graph_store.load(repository_id)
        first = first_matching_node(graph, summary)
        if not first:
            return []
        refs = [first]
        refs.extend(list(graph.successors(first))[:5])
        refs.extend(list(graph.predecessors(first))[:5])
        return list(dict.fromkeys(refs))
