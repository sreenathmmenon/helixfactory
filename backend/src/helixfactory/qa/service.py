from __future__ import annotations

import logging
import json

from helixfactory.api.schemas.models import AuditRecord
from helixfactory.api.schemas.requests import ArchitectureAnswer, ArchitectureQuestionRequest, Citation
from helixfactory.services.runtime import RuntimeState, runtime

logger = logging.getLogger("helixfactory.qa")


class ArchitectureQAService:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state

    def answer(self, request: ArchitectureQuestionRequest) -> ArchitectureAnswer:
        graph = self.state.graph_store.load(request.repository_id)
        center = request.context_node_id or _best_evidence_node(graph, request.question)
        uncertainty: list[str] = []
        citations: list[Citation] = []
        answer = "The current twin does not contain enough evidence to answer this architecture question."
        if center and center in graph:
            data = graph.nodes[center]
            if data.get("path"):
                citations.append(Citation(source_type="repository", source_ref=center, path=data.get("path"), line=data.get("start_line")))
            else:
                uncertainty.append(f"{data.get('name', center)} matched the twin but has no file/line citation.")
            neighbors = list(graph.successors(center))[:3] + list(graph.predecessors(center))[:3]
            if citations:
                answer = f"{data.get('name', center)} is represented as a {data.get('type', 'node')} in the repository twin."
                if "break" in request.question.lower() and neighbors:
                    answer += " Changing it may affect " + ", ".join(str(graph.nodes[n].get("name", n)) for n in neighbors[:3]) + "."
                if not neighbors:
                    uncertainty.append("No connected dependency evidence was found for this node.")
            else:
                answer = "The current twin matched a node, but it does not contain enough cited evidence for a confident answer."
        else:
            uncertainty.append("No matching node or citation was found in the current twin")
        if citations:
            ai_answer = self._ai_answer(request.question, graph, center, citations)
            if ai_answer:
                answer = ai_answer.get("answer") or answer
                uncertainty.extend(str(item) for item in ai_answer.get("uncertainty", []) if item)
            elif self.state.ai_provider.enabled:
                uncertainty.append("AI provider was unavailable; returned deterministic twin answer.")
        elif self.state.ai_provider.enabled:
            uncertainty.append("AI was not used because no cited twin evidence was available.")
        audit = self.state.record_audit(
            AuditRecord(
                id=f"audit-qa-{request.repository_id}",
                action_type="qa",
                actor="system",
                subject_ref=request.repository_id,
                input_refs=[request.question],
                output_refs=[c.source_ref for c in citations],
                summary="Architecture Q&A",
                result="success" if citations else "partial",
                details=None if citations else {"reason": "; ".join(uncertainty)},
            )
        )
        if audit.id and not citations:
            uncertainty.append(f"Audit record created: {audit.id}")
        return ArchitectureAnswer(answer=answer, citations=citations, uncertainty=uncertainty)

    def _ai_answer(self, question: str, graph, center: str | None, citations: list[Citation]) -> dict | None:
        if not center or center not in graph:
            return None
        evidence = _evidence_packet(graph, center, citations)
        prompt = {
            "question": question,
            "instruction": "Answer only from the supplied twin evidence. If the evidence is incomplete, say so explicitly. Do not invent files, lines, dependencies, owners, behavior, or confidence.",
            "required_json_shape": {"answer": "1-3 sentence answer", "uncertainty": ["missing evidence or caveats"]},
            "evidence": evidence,
        }
        return self.state.ai_provider.generate_json(
            system="You are HelixFactory's enterprise architecture Q&A engine. You must be evidence-constrained and concise.",
            prompt=json.dumps(prompt, indent=2),
            max_tokens=700,
        )


def _best_evidence_node(graph, question: str) -> str | None:
    words = [word.strip(".,?!:;()[]{}").lower() for word in question.split()]
    raw_meaningful = [word for word in words if len(word) >= 3 and word not in {"what", "does", "this", "would", "break", "changed", "change", "why", "the", "handle", "handles"}]
    meaningful = _expand_terms(raw_meaningful)
    if not meaningful:
        return None
    candidates: list[tuple[int, int, int, str]] = []
    for node_id, data in graph.nodes(data=True):
        if not data.get("path") or not data.get("start_line"):
            continue
        if _is_noise_path(str(data.get("path") or "")):
            continue
        name = str(data.get("name", "")).lower()
        path = str(data.get("path", "")).lower()
        basename = path.rsplit("/", 1)[-1].split(".", 1)[0]
        node_type = str(data.get("type", ""))
        score = sum(6 for word in meaningful if word == name or word == basename)
        score += sum(2 for word in meaningful if word in path or word in name)
        module_bonus = 3 if node_type in {"file", "entry_point"} and any(word == basename or word in path for word in meaningful) else 0
        symbol_bonus = 2 if node_type in {"function", "class"} and any(word == name for word in meaningful) else 0
        domain_bonus = 8 if "/security/" in path and any(word in {"auth", "security", "oauth", "jwt", "token", "credential", "login", "permission"} for word in meaningful) else 0
        if score:
            candidates.append((score + module_bonus + symbol_bonus + domain_bonus, module_bonus + domain_bonus, graph.degree(node_id), node_id))
    if candidates:
        return sorted(candidates, reverse=True)[0][3]
    return None


def _is_noise_path(path: str) -> bool:
    parts = set(path.split("/"))
    name = path.rsplit("/", 1)[-1]
    return bool(parts.intersection({"tests", "test", "vendor", "node_modules", "docs", "docs_src", "doc", "examples", "fixtures", "migrations"})) or name.startswith("test_") or name.endswith("_test.py") or name.endswith(".test.ts") or name.endswith(".spec.ts") or name == "conftest.py"


def _expand_terms(terms: list[str]) -> list[str]:
    aliases = {
        "auth": ["auth", "security", "oauth", "jwt", "token", "credential", "login", "permission"],
        "authentication": ["auth", "security", "oauth", "jwt", "token", "credential", "login", "permission"],
        "authorization": ["auth", "security", "scope", "permission", "token"],
        "routing": ["routing", "route", "router", "endpoint"],
    }
    expanded: list[str] = []
    for term in terms:
        expanded.extend(aliases.get(term, [term]))
    return list(dict.fromkeys(expanded))


def _evidence_packet(graph, center: str, citations: list[Citation]) -> dict:
    data = graph.nodes[center]
    neighbors = []
    for source, target, edge_data in list(graph.in_edges(center, data=True))[:5] + list(graph.out_edges(center, data=True))[:5]:
        other = source if target == center else target
        other_data = graph.nodes[other]
        neighbors.append(
            {
                "relationship": edge_data.get("type", "depends_on"),
                "edgeEvidencePath": edge_data.get("evidence_path"),
                "edgeEvidenceLine": edge_data.get("evidence_line"),
                "node": {
                    "id": other,
                    "name": other_data.get("name"),
                    "type": other_data.get("type"),
                    "path": other_data.get("path"),
                    "line": other_data.get("start_line"),
                },
            }
        )
    return {
        "center": {
            "id": center,
            "name": data.get("name"),
            "type": data.get("type"),
            "path": data.get("path"),
            "line": data.get("start_line"),
            "owner": data.get("owner") or data.get("last_modified_by"),
        },
        "citations": [citation.model_dump(by_alias=True) for citation in citations],
        "connectedEvidence": neighbors,
    }
