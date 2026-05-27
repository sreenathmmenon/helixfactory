from __future__ import annotations

from helixfactory.ai.provider import build_ai_provider
from helixfactory.services.config import Settings, load_settings


def test_load_settings_reads_backend_user_env_file(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "ANTHROPIC_API_KEY=test-key",
                "HELIXFACTORY_AI_PROVIDER=anthropic",
                "ANTHROPIC_MODEL=claude-sonnet-4-20250514",
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("HELIXFACTORY_AI_PROVIDER", raising=False)
    monkeypatch.setenv("HELIXFACTORY_ENV_FILE", str(env_file))
    monkeypatch.setenv("HELIXFACTORY_DATA", str(tmp_path / "data"))

    settings = load_settings()

    assert settings.ai_provider == "anthropic"
    assert settings.anthropic_api_key == "test-key"
    assert settings.anthropic_model == "claude-sonnet-4-20250514"


def test_ai_provider_status_never_exposes_key(tmp_path):
    settings = Settings(
        storage_path=tmp_path / "storage",
        audit_repository_path=tmp_path / "audit",
        clone_workspace=tmp_path / "clones",
        ai_provider="anthropic",
        anthropic_api_key="secret-key",
    )

    status = build_ai_provider(settings).status()

    assert status["enabled"] is True
    assert status["provider"] == "anthropic"
    assert "secret-key" not in str(status)
