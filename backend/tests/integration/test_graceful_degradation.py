from helixfactory.api.schemas.requests import ArchitectureQuestionRequest, GraphCenter, GraphQueryRequest, PreMortemRequest
from helixfactory.graph.query_service import GraphQueryService
from helixfactory.premortem.engine import PreMortemEngine
from helixfactory.qa.service import ArchitectureQAService


def test_graceful_degradation_for_empty_graph_and_evidence_gap(state):
    assert GraphQueryService(state).query(GraphQueryRequest(repositoryId="missing", center=GraphCenter(type="query", value="missing"), depth=1)).nodes == []
    assert PreMortemEngine(state).run(PreMortemRequest(repositoryId="missing", summary="modify missing", changeType="modify", targetRefs=["missing"])).evidence_gaps
    assert ArchitectureQAService(state).answer(ArchitectureQuestionRequest(repositoryId="missing", question="why?")).uncertainty
