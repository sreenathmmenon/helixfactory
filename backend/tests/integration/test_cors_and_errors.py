from fastapi.testclient import TestClient

from helixfactory.api.app import create_app


def test_local_dev_cors_preflight_is_allowed():
    client = TestClient(create_app())
    response = client.options(
        "/repositories/ingest",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_structured_error_response_for_missing_repository():
    client = TestClient(create_app())
    response = client.get("/repositories/missing", headers={"Origin": "http://127.0.0.1:5173"})
    assert response.status_code == 404
    payload = response.json()
    assert payload["error"]["code"] == "not_found"
    assert payload["error"]["message"] == "Repository was not found."
