from helixfactory.graph.traversal import centered_subgraph


def test_centered_traversal_depth_and_filters(seeded_state):
    graph = seeded_state.graph_store.load("repo1")
    center = next(node for node, data in graph.nodes(data=True) if data.get("name") == "app.py")
    view = centered_subgraph(graph, center, depth=1, relationship_types=["imports"])
    assert view.number_of_edges() == 1
    assert view.number_of_nodes() < graph.number_of_nodes()
