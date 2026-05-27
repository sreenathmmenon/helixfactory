from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_USER_ENV = Path("/Users/sreenath/.helix/.env")


@dataclass(frozen=True)
class Settings:
    storage_path: Path
    audit_repository_path: Path
    clone_workspace: Path
    ai_provider: str = "none"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-20250514"
    anthropic_deep_model: str = "claude-opus-4-1-20250805"
    anthropic_timeout_seconds: float = 30.0
    allowed_languages: tuple[str, ...] = ("python", "typescript", "javascript")
    cors_allowed_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )
    cors_allowed_origin_regex: str = r"^http://(localhost|127\.0\.0\.1):\d+$"


def load_settings() -> Settings:
    _load_env_file(Path(os.environ.get("HELIXFACTORY_ENV_FILE", DEFAULT_USER_ENV)))
    root = Path(os.environ.get("HELIXFACTORY_DATA", ".helixfactory")).resolve()
    settings = Settings(
        storage_path=Path(os.environ.get("HELIXFACTORY_STORAGE", root / "storage")),
        audit_repository_path=Path(os.environ.get("HELIXFACTORY_AUDIT_REPO", root / "audit")),
        clone_workspace=Path(os.environ.get("HELIXFACTORY_CLONES", root / "clones")),
        ai_provider=os.environ.get("HELIXFACTORY_AI_PROVIDER", "anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "none").strip().lower(),
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY"),
        anthropic_model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
        anthropic_deep_model=os.environ.get("ANTHROPIC_DEEP_MODEL", "claude-opus-4-1-20250805"),
        anthropic_timeout_seconds=float(os.environ.get("ANTHROPIC_TIMEOUT_SECONDS", "30")),
        cors_allowed_origins=tuple(
            origin.strip()
            for origin in os.environ.get(
                "HELIXFACTORY_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ),
        cors_allowed_origin_regex=os.environ.get("HELIXFACTORY_CORS_ORIGIN_REGEX", r"^http://(localhost|127\.0\.0\.1):\d+$"),
    )
    for path in (settings.storage_path, settings.audit_repository_path, settings.clone_workspace):
        path.mkdir(parents=True, exist_ok=True)
    return settings


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value
