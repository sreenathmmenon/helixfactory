from helixfactory.api.schemas.models import Repository
from helixfactory.api.schemas.requests import BlastRadiusRequest, GraphCenter, GraphPathRequest, GraphQueryRequest, NodeContextRequest, NodeSourceRequest
from helixfactory.graph.blast_radius import BlastRadiusService
from helixfactory.graph.query_service import GraphQueryService


def test_graph_query_and_blast_radius_flow(seeded_state):
    view = GraphQueryService(seeded_state).query(GraphQueryRequest(repositoryId="repo1", center=GraphCenter(type="query", value="app"), depth=1))
    assert view.nodes
    blast = BlastRadiusService(seeded_state).calculate(BlastRadiusRequest(repositoryId="repo1", summary="modify app", changeType="modify", targetRefs=["app"], depth=1))
    assert blast.risk_summary


def test_node_context_source_and_path_are_evidence_backed(seeded_state, tmp_path):
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    (repo_root / "app.py").write_text("import lib\n\n\ndef handler():\n    return 'ok'\n", encoding="utf-8")
    seeded_state.repositories["repo1"] = Repository(id="repo1", url="https://example.com/repo1", localPath=str(repo_root))

    service = GraphQueryService(seeded_state)
    graph = seeded_state.graph_store.load("repo1")
    app_id = next(node_id for node_id, data in graph.nodes(data=True) if data.get("path") == "app.py" and data.get("type") == "entry_point")
    handler_id = next(node_id for node_id, data in graph.nodes(data=True) if data.get("name") == "handler")

    context = service.node_context(NodeContextRequest(repositoryId="repo1", nodeId=app_id))
    source = service.node_source(NodeSourceRequest(repositoryId="repo1", nodeId=handler_id))
    path = service.path_between(GraphPathRequest(repositoryId="repo1", sourceNodeId=app_id, targetNodeId=handler_id))

    assert context.relationship_groups
    assert "handler" in source.snippet
    assert path.edges
    assert "handler" in path.explanation
