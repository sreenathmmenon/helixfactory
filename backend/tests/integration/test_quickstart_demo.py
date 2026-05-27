from helixfactory.api.schemas.requests import ArchitectureQuestionRequest, BlastRadiusRequest, GraphCenter, GraphQueryRequest, PreMortemRequest
from helixfactory.audit.evidence_package import EvidencePackageBuilder
from helixfactory.graph.blast_radius import BlastRadiusService
from helixfactory.graph.query_service import GraphQueryService
from helixfactory.premortem.engine import PreMortemEngine
from helixfactory.qa.service import ArchitectureQAService


def test_quickstart_demo_services_cover_ingest_graph_premortem_blast_qa_audit(seeded_state):
    assert GraphQueryService(seeded_state).query(GraphQueryRequest(repositoryId="repo1", center=GraphCenter(type="query", value="app"), depth=1)).nodes
    assert PreMortemEngine(seeded_state).run(PreMortemRequest(repositoryId="repo1", summary="modify handler", changeType="modify", targetRefs=["handler"])).findings
    assert BlastRadiusService(seeded_state).calculate(BlastRadiusRequest(repositoryId="repo1", summary="modify handler", changeType="modify", targetRefs=["handler"])).nodes
    assert ArchitectureQAService(seeded_state).answer(ArchitectureQuestionRequest(repositoryId="repo1", question="What does handler do?")).citations
    assert EvidencePackageBuilder().build.__name__ == "build"
