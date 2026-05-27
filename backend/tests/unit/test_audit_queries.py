from helixfactory.api.schemas.models import AuditRecord
from helixfactory.audit.query import AuditQueryService


def test_audit_query_filters_repository(state):
    state.record_audit(AuditRecord(id="a1", actionType="qa", actor="system", subjectRef="repo1", result="success", gitCommit="local"))
    state.record_audit(AuditRecord(id="a2", actionType="qa", actor="system", subjectRef="repo2", result="success", gitCommit="local"))
    records = AuditQueryService(state).filter(repository_id="repo1")
    assert [record.id for record in records] == ["a1"]
