from __future__ import annotations

import re

from helixfactory.graph.traversal import first_matching_node
from helixfactory.services.runtime import RuntimeState, runtime


class ContextCollector:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state

    def collect(self, repository_id: str, summary: str) -> list[str]:
        graph = self.state.graph_store.load(repository_id)
        first = first_matching_node(graph, summary)
        if not first:
            for term in _candidate_terms(summary):
                first = first_matching_node(graph, term)
                if first:
                    break
        if not first:
            return []
        refs = [first]
        refs.extend(list(graph.successors(first))[:5])
        refs.extend(list(graph.predecessors(first))[:5])
        return list(dict.fromkeys(refs))


def _candidate_terms(summary: str) -> list[str]:
    stop = {"modify", "change", "update", "delete", "rename", "add", "low", "risk", "high", "critical", "the", "and", "for"}
    return [term for term in re.findall(r"[a-zA-Z_][\w_]+", summary.lower()) if len(term) > 2 and term not in stop]
