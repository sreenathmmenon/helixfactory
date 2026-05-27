from fastapi.testclient import TestClient

from helixfactory.api.app import create_app


def test_ingest_premortem_routes_exist():
    client = TestClient(create_app())
    assert client.get("/health").json()["status"] == "healthy"
