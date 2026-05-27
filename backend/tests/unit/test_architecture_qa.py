from helixfactory.api.schemas.requests import ArchitectureQuestionRequest
from helixfactory.qa.service import ArchitectureQAService


def test_architecture_qa_answers_what_would_break(seeded_state):
    answer = ArchitectureQAService(seeded_state).answer(ArchitectureQuestionRequest(repositoryId="repo1", question="What would break if handler changed?"))
    assert answer.citations
    assert "Changing it may affect" in answer.answer
