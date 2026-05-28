from helixfactory.api.schemas.requests import PreMortemRequest
from helixfactory.premortem.engine import PreMortemEngine


def test_premortem_returns_evidence_backed_findings(seeded_state):
    result = PreMortemEngine(seeded_state).run(PreMortemRequest(repositoryId="repo1", summary="modify handler", changeType="modify", targetRefs=["handler"]))
    assert result.findings
    finding = result.findings[0]
    assert finding["filePath"] == "app.py"
    assert finding["line"] == 3
    assert finding["dependencyChain"]


def test_premortem_suppresses_insufficient_evidence(seeded_state):
    result = PreMortemEngine(seeded_state).run(PreMortemRequest(repositoryId="repo1", summary="modify missing", changeType="modify", targetRefs=["missing"]))
    assert not result.findings
    assert result.evidence_gaps
    assert result.risk_status == "blocked_insufficient_evidence"
    assert result.requires_human_approval
