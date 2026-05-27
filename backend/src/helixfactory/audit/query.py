from __future__ import annotations

from helixfactory.api.schemas.models import AuditRecord
from helixfactory.audit.records import read_records
from helixfactory.services.runtime import RuntimeState, runtime


class AuditQueryService:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state

    def filter(self, repository_id: str | None = None, risk_levels: list[str] | None = None, **_: str | None) -> list[AuditRecord]:
        by_id = {record.id: record for record in read_records(self.state.settings.audit_repository_path)}
        by_id.update({record.id: record for record in self.state.audit_records})
        records = list(by_id.values())
        if repository_id:
            records = [r for r in records if repository_id in {r.subject_ref, *r.input_refs, *r.output_refs}]
        if risk_levels:
            records = [r for r in records if not r.details or r.details.get("risk") in risk_levels]
        return sorted(records, key=lambda record: record.timestamp)
