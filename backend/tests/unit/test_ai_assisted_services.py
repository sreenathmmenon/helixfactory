from __future__ import annotations

from helixfactory.api.schemas.requests import ArchitectureQuestionRequest, NodeSummaryRequest, PreMortemRequest
from helixfactory.graph.query_service import GraphQueryService
from helixfactory.premortem.engine import PreMortemEngine
from helixfactory.qa.service import ArchitectureQAService


class FakeAIProvider:
    enabled = True
    provider_name = "fake"
    model_name = "fake-model"

    def status(self):
        return {"enabled": True, "provider": "fake", "model": "fake-model"}

    def generate_text(self, *, system: str, prompt: str, max_tokens: int = 700, deep: bool = False):
        return None

    def generate_json(self, *, system: str, prompt: str, max_tokens: int = 1000, deep: bool = False):
        if "pre-mortem" in system.lower():
            return {
                "findings": [
                    {
                        "id": "replace-me",
                        "title": "unused",
                        "consequence": "unused",
                        "preventiveCheck": "unused",
                    }
                ]
            }
        if "summarize" in system.lower():
            return {"summary": "AI summary grounded in the supplied twin evidence."}
        return {"answer": "AI answer grounded in the cited twin node.", "uncertainty": ["Only repository evidence was available."]}


def test_qa_uses_ai_when_cited_evidence_exists(seeded_state):
    seeded_state.ai_provider = FakeAIProvider()

    result = ArchitectureQAService(seeded_state).answer(ArchitectureQuestionRequest(repositoryId="repo1", question="What does handler do?"))

    assert result.answer == "AI answer grounded in the cited twin node."
    assert result.citations
    assert result.uncertainty == ["Only repository evidence was available."]


def test_node_summary_uses_ai_when_evidence_exists(seeded_state):
    seeded_state.ai_provider = FakeAIProvider()
    node_id = next(node_id for node_id, data in seeded_state.graph_store.load("repo1").nodes(data=True) if data.get("name") == "handler")

    result = GraphQueryService(seeded_state).node_summary(NodeSummaryRequest(repositoryId="repo1", nodeId=node_id))

    assert result.summary == "AI summary grounded in the supplied twin evidence."


def test_premortem_keeps_deterministic_evidence_when_ai_update_does_not_match(seeded_state):
    seeded_state.ai_provider = FakeAIProvider()

    result = PreMortemEngine(seeded_state).run(PreMortemRequest(repositoryId="repo1", summary="modify handler", changeType="modify", targetRefs=["handler"]))

    assert result.findings
    assert result.findings[0]["filePath"] == "app.py"
    assert result.findings[0]["line"] == 3
    assert result.findings[0]["dependencyChain"]
