from __future__ import annotations

from datetime import datetime, timezone
import logging
from pathlib import Path

from git import Repo
from git.exc import GitCommandError

from helixfactory.api.schemas.models import AuditRecord, Repository, RepositoryStatus
from helixfactory.ingestion.language_filter import detect_language, supported_source_files
from helixfactory.ingestion.parsers.javascript_parser import parse_javascript
from helixfactory.ingestion.parsers.python_parser import parse_python
from helixfactory.ingestion.parsers.typescript_parser import parse_typescript
from helixfactory.ingestion.repository_loader import RepositoryLoader, repository_id_for
from helixfactory.ingestion.twin_builder import build_twin
from helixfactory.ingestion.ownership import ownership_for_file
from helixfactory.services.runtime import RuntimeState, runtime

logger = logging.getLogger("helixfactory.ingestion")


def _parse(path: Path, root: Path):
    language = detect_language(path)
    if language == "python":
        return parse_python(path, root)
    if language == "typescript":
        return parse_typescript(path, root)
    if language == "javascript":
        return parse_javascript(path, root)
    return None


class IngestionService:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state
        self.loader = RepositoryLoader(state.settings.clone_workspace)

    def ingest(self, url: str, branch: str | None = None, label: str | None = None) -> Repository:
        repo_id = repository_id_for(url)
        repo = Repository(id=repo_id, url=url, default_branch=branch or "default", ingestion_status=RepositoryStatus.in_progress, supported_languages=[])
        self.state.repositories[repo_id] = repo
        result = "success"
        details = None
        try:
            local_path = self.loader.load(url, branch)
            parsed = []
            parse_failures: list[str] = []
            files, unsupported = supported_source_files(local_path)
            for path in files:
                try:
                    parsed_file = _parse(path, local_path)
                    if parsed_file:
                        parsed.append(parsed_file)
                except Exception as exc:
                    rel = path.relative_to(local_path).as_posix()
                    logger.warning("Parser failed for %s", rel, exc_info=True)
                    parse_failures.append(f"{rel}: {exc}")
            languages = sorted({p.language for p in parsed})
            ownership = {p.path: ownership_for_file(local_path, p.path) for p in parsed}
            nodes, edges = build_twin(repo_id, parsed, ownership)
            self.state.graph_store.save(repo_id, nodes, edges)
            commit = None
            try:
                commit = Repo(local_path).head.commit.hexsha
            except Exception:
                pass
            status = RepositoryStatus.complete if parsed and not parse_failures else RepositoryStatus.partial if parsed else RepositoryStatus.failed
            failure_reason = None
            if status != RepositoryStatus.complete:
                failure_reason = "; ".join(parse_failures[:5]) or "No supported Python, TypeScript, or JavaScript files were parsed"
                result = "partial" if parsed else "failed"
                details = {"reason": failure_reason, "parseFailures": parse_failures, "unsupportedFileCount": len(unsupported)}
            repo = repo.model_copy(
                update={
                    "local_path": str(local_path),
                    "ingestion_status": status,
                    "supported_languages": languages,
                    "last_ingested_commit": commit,
                    "updated_at": datetime.now(timezone.utc),
                    "failure_reason": failure_reason,
                    "node_count": len(nodes),
                    "edge_count": len(edges),
                }
            )
        except Exception as exc:
            logger.exception("Repository ingestion failed for %s", url)
            result = "failed"
            failure_reason = _ingestion_failure_message(exc)
            details = {"reason": failure_reason, "technicalError": exc.__class__.__name__}
            repo = repo.model_copy(update={"ingestion_status": RepositoryStatus.failed, "failure_reason": failure_reason})
        self.state.repositories[repo_id] = repo
        record = AuditRecord(
            id=f"audit-{repo_id}-ingestion",
            action_type="ingestion",
            actor="system",
            subject_ref=repo_id,
            summary=f"Ingested {label or url}",
            result=result,  # type: ignore[arg-type]
            details=details,
            output_refs=[repo_id],
        )
        self.state.record_audit(record)
        return repo

    def get(self, repository_id: str) -> Repository | None:
        return self.state.repositories.get(repository_id)


def _ingestion_failure_message(exc: Exception) -> str:
    text = str(exc)
    if isinstance(exc, GitCommandError):
        lowered = text.lower()
        if "could not resolve host" in lowered:
            return "HelixFactory could not reach GitHub. Check network/DNS access and retry ingestion."
        if "repository not found" in lowered or "not found" in lowered:
            return "The repository could not be found or is not publicly accessible."
        if "authentication failed" in lowered:
            return "The repository requires authentication. Use a public repository for this ingestion flow."
        return "Git clone failed. Verify the repository URL and retry ingestion."
    return "Repository ingestion failed before a twin could be built. Check the repository URL and retry."
