from __future__ import annotations

from pathlib import Path

from git import Repo


def ownership_for_file(repo_root: Path, rel_path: str) -> tuple[str, str | None]:
    try:
        repo = Repo(repo_root)
        commits = list(repo.iter_commits(paths=rel_path, max_count=1))
        if commits:
            commit = commits[0]
            return commit.author.name or "unknown-owner", commit.committed_datetime.isoformat()
    except Exception:
        pass
    return "unknown-owner", None
