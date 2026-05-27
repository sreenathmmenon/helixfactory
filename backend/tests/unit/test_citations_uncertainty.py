from helixfactory.api.schemas.requests import ArchitectureQuestionRequest
from helixfactory.qa.service import ArchitectureQAService


def test_architecture_qa_reports_uncertainty_for_unavailable_sources(state):
    answer = ArchitectureQAService(state).answer(ArchitectureQuestionRequest(repositoryId="missing", question="Why dependency?"))
    assert answer.uncertainty
    assert not answer.citations
