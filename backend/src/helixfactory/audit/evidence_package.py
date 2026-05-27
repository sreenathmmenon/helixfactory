from __future__ import annotations

from helixfactory.api.schemas.requests import EvidencePackage, EvidencePackageRequest
from helixfactory.audit.query import AuditQueryService
from helixfactory.audit.records import to_contract_record


class EvidencePackageBuilder:
    def __init__(self, query: AuditQueryService | None = None) -> None:
        self.query = query or AuditQueryService()

    def build(self, request: EvidencePackageRequest) -> EvidencePackage:
        records = self.query.filter(repository_id=request.repository_id, risk_levels=request.risk_levels)
        return EvidencePackage(records=[to_contract_record(record) for record in records])
