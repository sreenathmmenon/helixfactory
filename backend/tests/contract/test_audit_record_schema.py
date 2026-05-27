import json
from pathlib import Path

from jsonschema import Draft202012Validator


def test_audit_record_schema_required_fields_and_failure_details():
    schema = json.loads(Path("../specs/001-helixfactory-platform/contracts/audit-record.schema.json").resolve().read_text())
    validator = Draft202012Validator(schema)
    good = {
        "id": "audit-1",
        "action_type": "ingestion",
        "actor": "system",
        "subject_ref": "repo1",
        "result": "failed",
        "details": {"reason": "clone failed"},
        "timestamp": "2026-05-26T00:00:00Z",
        "git_commit": "abc123"
    }
    validator.validate(good)
    bad = dict(good)
    bad.pop("details")
    errors = list(validator.iter_errors(bad))
    assert errors
