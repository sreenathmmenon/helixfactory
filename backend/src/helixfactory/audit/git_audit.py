from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from git import Repo

from helixfactory.api.schemas.models import AuditRecord
from helixfactory.audit.records import JsonAuditRecordWriter
from helixfactory.services.errors import AuditFailureError


class GitAuditService(JsonAuditRecordWriter):
    def __init__(self, root: Path) -> None:
        super().__init__(root)
        self.repo = Repo.init(root)
        with self.repo.config_writer() as config:
            if not self.repo.config_reader().has_option("user", "name"):
                config.set_value("user", "name", "HelixFactory Audit")
            if not self.repo.config_reader().has_option("user", "email"):
                config.set_value("user", "email", "audit@helixfactory.local")

    def write(self, record: AuditRecord) -> AuditRecord:
        try:
            pending = record.model_copy(update={"git_commit": f"pending-{uuid4().hex[:12]}"})
            saved = super().write(pending)
            self.repo.git.add(A=True)
            self.repo.index.commit(f"audit: {saved.action_type} {saved.subject_ref}")
            commit = self.repo.head.commit.hexsha
            finalized = saved.model_copy(update={"git_commit": commit})
            super().write(finalized)
            self.repo.git.add(A=True)
            self.repo.index.commit(f"audit: finalize {finalized.id}")
            return finalized
        except Exception as exc:
            raise AuditFailureError("Audit record could not be committed to git.", {"recordId": record.id, "reason": str(exc)}) from exc
