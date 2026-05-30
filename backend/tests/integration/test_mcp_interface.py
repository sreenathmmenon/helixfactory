from fastapi.testclient import TestClient

from helixfactory.api.app import create_app


def rpc(client: TestClient, method: str, params: dict | None = None, request_id: int = 1) -> dict:
    response = client.post("/mcp", json={"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or {}})
    assert response.status_code == 200
    return response.json()


def test_mcp_lists_change_safety_tools():
    client = TestClient(create_app())
    result = rpc(client, "tools/list")["result"]
    tool_names = {tool["name"] for tool in result["tools"]}
    assert {
        "helix_ask_twin",
        "helix_get_node_context",
        "helix_get_node_source",
        "helix_assess_change",
        "helix_blast_radius",
        "helix_should_agent_continue",
        "helix_create_audit_package",
    }.issubset(tool_names)


def test_mcp_should_agent_continue_requires_arguments():
    client = TestClient(create_app())
    response = rpc(
        client,
        "tools/call",
        {
            "name": "helix_should_agent_continue",
            "arguments": {"repositoryId": "repo1", "summary": "modify handler"},
        },
    )
    assert response["error"]["data"]["code"] == "not_found"
    assert response["error"]["data"]["details"]["argument"] == "targetRefs"


def test_mcp_prompt_guides_agent_to_run_safety_gate():
    client = TestClient(create_app())
    result = rpc(
        client,
        "prompts/get",
        {
            "name": "pre_mortem_before_edit",
            "arguments": {"repositoryId": "repo1", "summary": "modify request dispatch"},
        },
    )["result"]
    text = result["messages"][0]["content"]["text"]
    assert "helix_assess_change" in text
    assert "requiresHumanApproval" in text
