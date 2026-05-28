from __future__ import annotations

from helixfactory.api.schemas.requests import EvidencePackage, EvidencePackageRequest
from helixfactory.audit.query import AuditQueryService
from helixfactory.audit.records import to_contract_record


class EvidencePackageBuilder:
    def __init__(self, query: AuditQueryService | None = None) -> None:
        self.query = query or AuditQueryService()

    def build(self, request: EvidencePackageRequest) -> EvidencePackage:
        records = self.query.filter(repository_id=request.repository_id, risk_levels=request.risk_levels)
        contract_records = [to_contract_record(record) for record in records]
        actions = [record["actionType"] for record in contract_records]
        required = ["ingestion", "premortem", "blast_radius", "agent_execution"]
        if any(record["result"] == "blocked" for record in contract_records):
            required.append("approval")
        missing = [action for action in required if action not in actions]
        blocked_or_failed = [record for record in contract_records if record["result"] in {"blocked", "failed", "partial"}]
        if missing:
            status = "incomplete"
        elif blocked_or_failed:
            status = "requires_attention"
        else:
            status = "complete"
        return EvidencePackage(
            records=contract_records,
            completeness_status=status,
            missing_actions=missing,
            chronological_chain=actions,
        )
