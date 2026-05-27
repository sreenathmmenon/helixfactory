import yaml
from pathlib import Path


def test_openapi_contract_parses_and_exposes_week_one_endpoints():
    contract = yaml.safe_load(Path("../specs/001-helixfactory-platform/contracts/api.openapi.yaml").resolve().read_text())
    paths = set(contract["paths"])
    assert {
        "/repositories/ingest",
        "/repositories/{repositoryId}",
        "/graph/query",
        "/graph/path",
        "/changes/premortem",
        "/changes/blast-radius",
        "/qa/architecture",
        "/qa/node-context",
        "/qa/node-source",
        "/audit/evidence-package",
    }.issubset(paths)
