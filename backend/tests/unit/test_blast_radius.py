from helixfactory.api.schemas.requests import BlastRadiusRequest
from helixfactory.graph.blast_radius import BlastRadiusService


def test_blast_radius_marks_direct_and_transitive_risk(seeded_state):
    view = BlastRadiusService(seeded_state).calculate(BlastRadiusRequest(repositoryId="repo1", summary="delete handler", changeType="delete", targetRefs=["handler"], depth=2))
    assert view.nodes
    assert view.risk_summary["high"] >= 1
