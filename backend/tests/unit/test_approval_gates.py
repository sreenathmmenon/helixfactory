from helixfactory.api.schemas.models import PreMortemFinding
from helixfactory.services.approval_gates import gate_for_findings


def test_high_and_critical_findings_block_auto_merge():
    finding = PreMortemFinding(id="f1", proposedChangeId="c1", severity="high", title="risk", consequence="breakage", filePath="app.py", line=1, dependencyChain=["e1"], preventiveCheck="review")
    gate = gate_for_findings("c1", [finding])
    assert gate.required is True
    assert gate.status == "blocked"
