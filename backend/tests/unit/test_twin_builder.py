from helixfactory.ingestion.twin_builder import build_twin


def test_twin_builder_creates_repository_nodes_edges_and_line_provenance(parsed_files):
    nodes, edges = build_twin("repo1", parsed_files)
    assert any(node.type == "repository" for node in nodes)
    assert any(node.type == "function" and node.path == "app.py" and node.start_line == 3 for node in nodes)
    assert any(edge.type == "imports" and edge.evidence_path == "app.py" for edge in edges)
