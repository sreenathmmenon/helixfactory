from __future__ import annotations

from dataclasses import dataclass, field
import logging

from helixfactory.api.schemas.models import AuditRecord, Repository
from helixfactory.audit.git_audit import GitAuditService
from helixfactory.ai import build_ai_provider
from helixfactory.graph.store import JsonGraphStore
from helixfactory.services.config import Settings, load_settings
from helixfactory.services.repository_registry import RepositoryRegistry


@dataclass
class RuntimeState:
    settings: Settings = field(default_factory=load_settings)
    repositories: dict[str, Repository] = field(default_factory=dict)
    audit_records: list[AuditRecord] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.graph_store = JsonGraphStore(self.settings.storage_path)
        self.repository_registry = RepositoryRegistry(self.settings.storage_path, self.settings.clone_workspace)
        self.repositories.update(self.repository_registry.load_all())
        self.audit_writer = GitAuditService(self.settings.audit_repository_path)
        self.ai_provider = build_ai_provider(self.settings)
        self.logger = logging.getLogger("helixfactory.runtime")

    def save_repository(self, repository: Repository) -> Repository:
        self.repository_registry.save(repository, self.repositories)
        return repository

    def record_audit(self, record: AuditRecord) -> AuditRecord:
        saved = self.audit_writer.write(record)
        self.audit_records.append(saved)
        self.logger.info("Audit committed", extra={"audit_id": saved.id, "commit": saved.git_commit})
        return saved


runtime = RuntimeState()
