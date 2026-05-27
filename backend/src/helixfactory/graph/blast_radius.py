from __future__ import annotations
import logging

from helixfactory.api.schemas.models import AuditRecord, GraphCenter, GraphView
from helixfactory.api.schemas.requests import BlastRadiusRequest, GraphQueryRequest
from helixfactory.graph.query_service import GraphQueryService
from helixfactory.premortem.change_resolver import resolve_targets
from helixfactory.services.runtime import RuntimeState, runtime

logger = logging.getLogger("helixfactory.blast_radius")


class BlastRadiusService:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state
        self.query_service = GraphQueryService(state)

    def calculate(self, request: BlastRadiusRequest) -> GraphView:
        graph = self.state.graph_store.load(request.repository_id)
        targets = resolve_targets(graph, request.target_refs)
        center_ref = targets[0] if targets else request.target_refs[0]
        if not targets:
            logger.warning("Blast radius target unresolved", extra={"repository_id": request.repository_id, "target_refs": request.target_refs})
        view = self.query_service.query(
            GraphQueryRequest(
                repository_id=request.repository_id,
                center=GraphCenter(type="node", value=center_ref),
                depth=request.depth,
                relationship_types=request.relationship_types,
            )
        )
        for node in view.nodes:
            if node.id == center_ref:
                node.risk = "high" if request.change_type in {"delete", "database", "interface", "infrastructure"} else "medium"
            elif node.risk == "none":
                node.risk = "low"
        view.risk_summary = {}
        for node in view.nodes:
            view.risk_summary[node.risk] = view.risk_summary.get(node.risk, 0) + 1
        self.state.record_audit(
            AuditRecord(
                id=f"audit-blast-{center_ref[:12]}",
                action_type="blast_radius",
                actor="system",
                subject_ref=center_ref,
                input_refs=request.target_refs,
                output_refs=[node.id for node in view.nodes],
                summary=request.summary,
                result="success" if view.nodes else "partial",
                details=None if view.nodes else {"reason": "No nodes resolved for blast radius"},
            )
        )
        return view
