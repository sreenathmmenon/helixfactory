from helixfactory.api.schemas.requests import ArchitectureQuestionRequest
from helixfactory.qa.service import ArchitectureQAService


def test_architecture_qa_flow_returns_citation_and_uncertainty_output(seeded_state):
    answer = ArchitectureQAService(seeded_state).answer(ArchitectureQuestionRequest(repositoryId="repo1", question="What does app do?"))
    assert answer.citations
    assert isinstance(answer.uncertainty, list)
