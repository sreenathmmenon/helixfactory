from __future__ import annotations

from uuid import uuid4
import logging
import json

from helixfactory.api.schemas.models import AuditRecord, PreMortemFinding, ProposedChange
from helixfactory.api.schemas.requests import PreMortemRequest, PreMortemResult
from helixfactory.premortem.change_resolver import resolve_targets
from helixfactory.services.runtime import RuntimeState, runtime

logger = logging.getLogger("helixfactory.premortem")


class PreMortemEngine:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state

    def run(self, request: PreMortemRequest) -> PreMortemResult:
        graph = self.state.graph_store.load(request.repository_id)
        change = ProposedChange(
            id=f"change-{uuid4().hex[:10]}",
            repository_id=request.repository_id,
            summary=request.summary,
            change_type=request.change_type,
            target_refs=request.target_refs,
        )
        targets = resolve_targets(graph, request.target_refs)
        findings: list[PreMortemFinding] = []
        gaps: list[str] = []
        for target in targets:
            try:
                evidence_target = _evidence_target(graph, target)
                data = graph.nodes[evidence_target]
                chain = _dependency_chain(graph, evidence_target)
                if data.get("path") and data.get("start_line") and chain:
                    risk_weight = max(len(chain), graph.degree(target), graph.degree(evidence_target))
                    severity = _severity_for_change(request.change_type, risk_weight)
                    findings.append(
                        PreMortemFinding(
                            id=f"finding-{uuid4().hex[:10]}",
                            proposed_change_id=change.id,
                            severity=severity,  # type: ignore[arg-type]
                            title=f"{request.change_type.title()} may affect {data.get('name')}",
                            consequence="Connected files or symbols may fail because the target participates in the twin dependency chain.",
                            file_path=data["path"],
                            line=int(data.get("start_line")),
                            dependency_chain=chain[:6],
                            owner_context=data.get("owner") or data.get("last_modified_by") or "unknown-owner",
                            preventive_check=_preventive_check(request.change_type, data.get("path")),
                        )
                    )
                else:
                    gaps.append(f"Suppressed finding for {target}: missing file, line, or dependency-chain evidence")
            except Exception as exc:
                logger.exception("Pre-mortem failed while evaluating target %s", target)
                gaps.append(f"Suppressed finding for {target}: {exc}")
        if not targets:
            gaps.append("No target refs resolved in the current twin")
        if findings:
            ai_gap = _apply_ai_explanations(self.state, request.summary, findings)
            if ai_gap:
                gaps.append(ai_gap)
        risk = _max_risk([f.severity for f in findings]) if findings else "blocked_insufficient_evidence"
        audit = self.state.record_audit(
            AuditRecord(
                id=f"audit-{change.id}-premortem",
                action_type="premortem",
                actor="system",
                subject_ref=change.id,
                input_refs=[request.repository_id, *request.target_refs],
                output_refs=[f.id for f in findings],
                summary=request.summary,
                result="success" if findings else "partial",
                details=None if findings else {"reason": "; ".join(gaps)},
            )
        )
        if risk in {"high", "critical"}:
            self.state.record_audit(
                AuditRecord(
                    id=f"audit-{change.id}-approval-block",
                    action_type="approval",
                    actor="system",
                    subject_ref=change.id,
                    input_refs=[audit.id, *[f.id for f in findings]],
                    summary="Auto-approval blocked by high-risk pre-mortem findings",
                    result="blocked",
                    details={"risk": risk, "reason": "HIGH and CRITICAL findings require human approval"},
                )
            )
        return PreMortemResult(
            change_id=change.id,
            risk_status=risk,
            findings=[f.model_dump(by_alias=True, mode="json") for f in findings],
            evidence_gaps=gaps,
            requires_human_approval=risk in {"high", "critical", "blocked_insufficient_evidence"},
            audit_record_id=audit.id,
        )


def _max_risk(severities: list[str]) -> str:
    order = ["low", "medium", "high", "critical"]
    return max(severities, key=order.index)


def _dependency_chain(graph, target: str) -> list[str]:
    """Return human-readable node names forming the dependency chain, not edge IDs."""
    names: list[str] = []
    seen: set[str] = {target}
    # Outgoing edges first (what this node depends on)
    for _, neighbor, _ in graph.out_edges(target, data=True):
        if neighbor not in seen:
            name = graph.nodes[neighbor].get("name") or graph.nodes[neighbor].get("path") or neighbor
            names.append(name)
            seen.add(neighbor)
    # Incoming edges (what depends on this node)
    for neighbor, _, _ in graph.in_edges(target, data=True):
        if neighbor not in seen:
            name = graph.nodes[neighbor].get("name") or graph.nodes[neighbor].get("path") or neighbor
            names.append(name)
            seen.add(neighbor)
    # Put the target node name first
    target_name = graph.nodes[target].get("name") or graph.nodes[target].get("path") or target
    return [target_name] + names[:7]


def _evidence_target(graph, target: str) -> str:
    """Prefer symbol-level evidence when a user targets a whole file."""
    data = graph.nodes[target]
    if data.get("type") not in {"file", "entry_point"}:
        return target
    symbol_neighbors: list[str] = []
    for _source, neighbor, edge_data in graph.out_edges(target, data=True):
        neighbor_data = graph.nodes[neighbor]
        if edge_data.get("type") == "depends_on" and neighbor_data.get("type") in {"function", "class", "entry_point"}:
            symbol_neighbors.append(neighbor)
    if not symbol_neighbors:
        return target
    return sorted(
        symbol_neighbors,
        key=lambda node_id: (
            graph.degree(node_id),
            -int(graph.nodes[node_id].get("start_line") or 0),
        ),
        reverse=True,
    )[0]


def _severity_for_change(change_type: str, chain_length: int) -> str:
    if change_type in {"delete", "database", "infrastructure"} and chain_length >= 3:
        return "critical"
    if change_type in {"delete", "database", "interface", "infrastructure", "dependency"}:
        return "high"
    if chain_length >= 3:
        return "high"
    return "medium"


def _preventive_check(change_type: str, path: str | None) -> str:
    scope = f" for {path}" if path else ""
    if change_type in {"database", "interface"}:
        return f"Run contract and migration compatibility checks{scope}; require owner review."
    if change_type in {"delete", "rename"}:
        return f"Run dependency-chain tests and verify all callers are updated{scope}."
    return f"Run focused unit and integration tests covering the cited dependency chain{scope}."


def _apply_ai_explanations(state: RuntimeState, summary: str, findings: list[PreMortemFinding]) -> str | None:
    if not state.ai_provider.enabled:
        return None
    payload = {
        "changeSummary": summary,
        "instruction": "Improve the title, consequence, and preventive check for each finding using only the provided evidence. Do not change severity, file path, line, dependency chain, or owner context. Do not add new findings.",
        "findings": [
            {
                "id": finding.id,
                "severity": finding.severity,
                "title": finding.title,
                "consequence": finding.consequence,
                "filePath": finding.file_path,
                "line": finding.line,
                "dependencyChain": finding.dependency_chain,
                "ownerContext": finding.owner_context,
                "preventiveCheck": finding.preventive_check,
            }
            for finding in findings
        ],
        "requiredJsonShape": {
            "findings": [
                {
                    "id": "existing finding id",
                    "title": "specific prediction",
                    "consequence": "specific consequence grounded in dependency-chain evidence",
                    "preventiveCheck": "specific check the team should run before merge",
                }
            ]
        },
    }
    result = state.ai_provider.generate_json(
        system="You are HelixFactory's pre-mortem engine. You are evidence-constrained. You may improve wording only; never invent evidence.",
        prompt=json.dumps(payload, indent=2),
        max_tokens=1200,
        deep=True,
    )
    if not result:
        return "AI provider was unavailable; pre-mortem returned deterministic evidence-backed findings."
    updates = {str(item.get("id")): item for item in result.get("findings", []) if isinstance(item, dict)}
    for finding in findings:
        update = updates.get(finding.id)
        if not update:
            continue
        finding.title = str(update.get("title") or finding.title)[:240]
        finding.consequence = str(update.get("consequence") or finding.consequence)[:600]
        finding.preventive_check = str(update.get("preventiveCheck") or finding.preventive_check)[:600]
    return None
