from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

from pydantic import TypeAdapter

from helixfactory.api.schemas.models import AuditRecord


class AuditRecordWriter:
    def write(self, record: AuditRecord) -> AuditRecord:
        raise NotImplementedError


class JsonAuditRecordWriter(AuditRecordWriter):
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def write(self, record: AuditRecord) -> AuditRecord:
        if record.git_commit == "pending":
            record = record.model_copy(update={"git_commit": f"local-{uuid4().hex[:12]}"})
        path = self.root / f"{record.timestamp.strftime('%Y%m%dT%H%M%S')}-{record.id}.json"
        path.write_text(record.model_dump_json(by_alias=False, indent=2), encoding="utf-8")
        return record


def audit_record_from_json(payload: str) -> AuditRecord:
    return TypeAdapter(AuditRecord).validate_json(payload)


def read_records(root: Path) -> list[AuditRecord]:
    if not root.exists():
        return []
    records: list[AuditRecord] = []
    for path in sorted(root.glob("*.json")):
        records.append(audit_record_from_json(path.read_text(encoding="utf-8")))
    return records


def to_contract_record(record: AuditRecord) -> dict:
    data = json.loads(record.model_dump_json(by_alias=False))
    return {
        "id": data["id"],
        "actionType": data["action_type"],
        "actor": data["actor"],
        "subjectRef": data["subject_ref"],
        "inputRefs": data.get("input_refs", []),
        "outputRefs": data.get("output_refs", []),
        "summary": data.get("summary", ""),
        "result": data["result"],
        "details": data.get("details") or {},
        "timestamp": data["timestamp"],
        "gitCommit": data["git_commit"],
    }
