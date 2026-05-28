from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from helixfactory.api.schemas.models import Repository, RepositoryStatus


class RepositoryRegistry:
    def __init__(self, storage_path: Path, clone_workspace: Path) -> None:
        self.storage_path = storage_path
        self.clone_workspace = clone_workspace
        self.path = storage_path / "repositories.json"
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def load_all(self) -> dict[str, Repository]:
        repositories: dict[str, Repository] = {}
        if self.path.exists():
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            for item in payload.get("repositories", []):
                repository = Repository.model_validate(item)
                repositories[repository.id] = repository
        for graph_path in self.storage_path.glob("*.graph.json"):
            repo_id = graph_path.name.removesuffix(".graph.json")
            if repo_id not in repositories:
                repositories[repo_id] = self._recover_from_graph(repo_id, graph_path)
        if repositories:
            self.save_all(repositories)
        return repositories

    def save(self, repository: Repository, repositories: dict[str, Repository]) -> None:
        repositories[repository.id] = repository
        self.save_all(repositories)

    def save_all(self, repositories: dict[str, Repository]) -> None:
        payload = {
            "repositories": [
                repository.model_dump(mode="json", by_alias=True)
                for repository in sorted(repositories.values(), key=lambda item: item.updated_at, reverse=True)
            ]
        }
        self.path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _recover_from_graph(self, repo_id: str, graph_path: Path) -> Repository:
        payload = json.loads(graph_path.read_text(encoding="utf-8"))
        nodes = payload.get("nodes", [])
        edges = payload.get("edges", [])
        languages = sorted({node.get("language") for node in nodes if node.get("language")})
        clone_path = self.clone_workspace / repo_id
        local_path = str(clone_path) if clone_path.exists() and (clone_path / ".git").exists() else None
        now = datetime.now(timezone.utc)
        return Repository(
            id=repo_id,
            url=repo_id,
            default_branch="unknown",
            local_path=local_path,
            ingestion_status=RepositoryStatus.complete if nodes else RepositoryStatus.failed,
            supported_languages=languages,
            created_at=now,
            updated_at=now,
            failure_reason=None if nodes else "Recovered repository has no graph nodes.",
            node_count=len(nodes),
            edge_count=len(edges),
        )
