from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid5, NAMESPACE_URL

from git import Repo
from git.exc import GitCommandError


def repository_id_for(url: str) -> str:
    return uuid5(NAMESPACE_URL, url).hex[:12]


class RepositoryLoader:
    def __init__(self, workspace: Path) -> None:
        self.workspace = workspace
        self.workspace.mkdir(parents=True, exist_ok=True)

    def load(self, url: str, branch: str | None = None) -> Path:
        repo_id = repository_id_for(url)
        destination = self.workspace / repo_id
        refresh_destination = self.workspace / f"{repo_id}.refresh"
        if refresh_destination.exists():
            shutil.rmtree(refresh_destination)
        clone_args = {"depth": 1}
        if branch:
            clone_args["branch"] = branch
        try:
            Repo.clone_from(url, refresh_destination, **clone_args)
        except GitCommandError:
            if destination.exists() and (destination / ".git").exists():
                return destination
            raise
        if destination.exists():
            shutil.rmtree(destination)
        refresh_destination.replace(destination)
        return destination

    def cleanup(self, url: str) -> None:
        destination = self.workspace / repository_id_for(url)
        if destination.exists():
            shutil.rmtree(destination)
