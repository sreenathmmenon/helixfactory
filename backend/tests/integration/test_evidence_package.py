from helixfactory.api.schemas.models import AuditRecord
from helixfactory.api.schemas.requests import EvidencePackageRequest
from helixfactory.audit.evidence_package import EvidencePackageBuilder
from helixfactory.audit.query import AuditQueryService


def test_evidence_package_complete_and_partial_records(state):
    state.record_audit(AuditRecord(id="a1", actionType="ingestion", actor="system", subjectRef="repo1", result="success", gitCommit="local"))
    state.record_audit(AuditRecord(id="a2", actionType="premortem", actor="system", subjectRef="repo1", result="partial", details={"reason": "gap"}, gitCommit="local"))
    package = EvidencePackageBuilder(AuditQueryService(state)).build(EvidencePackageRequest(repositoryId="repo1"))
    assert len(package.records) >= 2
    assert package.completeness_status == "incomplete"
    assert "blast_radius" in package.missing_actions
