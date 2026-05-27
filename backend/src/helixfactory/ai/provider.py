from __future__ import annotations

from dataclasses import dataclass
import json
import logging
from typing import Any, Protocol

import httpx

from helixfactory.services.config import Settings

logger = logging.getLogger("helixfactory.ai")


@dataclass(frozen=True)
class AIResult:
    text: str
    model: str | None
    provider: str
    confidence: str = "medium"
    uncertainty: tuple[str, ...] = ()


class AIProvider(Protocol):
    @property
    def enabled(self) -> bool:
        ...

    @property
    def provider_name(self) -> str:
        ...

    @property
    def model_name(self) -> str | None:
        ...

    def status(self) -> dict[str, Any]:
        ...

    def generate_text(self, *, system: str, prompt: str, max_tokens: int = 700, deep: bool = False) -> AIResult | None:
        ...

    def generate_json(self, *, system: str, prompt: str, max_tokens: int = 1000, deep: bool = False) -> dict[str, Any] | None:
        ...


class DisabledAIProvider:
    provider_name = "none"
    model_name = None
    enabled = False

    def status(self) -> dict[str, Any]:
        return {"enabled": False, "provider": "none", "model": None, "reason": "No backend AI provider is configured"}

    def generate_text(self, *, system: str, prompt: str, max_tokens: int = 700, deep: bool = False) -> AIResult | None:
        return None

    def generate_json(self, *, system: str, prompt: str, max_tokens: int = 1000, deep: bool = False) -> dict[str, Any] | None:
        return None


class AnthropicProvider:
    provider_name = "anthropic"

    def __init__(self, settings: Settings) -> None:
        self.api_key = settings.anthropic_api_key
        self.model = settings.anthropic_model
        self.deep_model = settings.anthropic_deep_model
        self.timeout = settings.anthropic_timeout_seconds
        self.last_error: str | None = None

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    @property
    def model_name(self) -> str:
        return self.model

    def status(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "provider": self.provider_name,
            "model": self.model,
            "deepModel": self.deep_model,
            "reason": None if self.enabled else "ANTHROPIC_API_KEY is not configured in the backend environment",
            "lastError": self.last_error,
        }

    def generate_text(self, *, system: str, prompt: str, max_tokens: int = 700, deep: bool = False) -> AIResult | None:
        if not self.enabled:
            return None
        model = self.deep_model if deep else self.model
        try:
            text = self._messages(model=model, system=system, prompt=prompt, max_tokens=max_tokens)
            self.last_error = None
            return AIResult(text=text, model=model, provider=self.provider_name)
        except Exception as exc:
            self.last_error = f"{exc.__class__.__name__}: {exc}"
            logger.warning("Anthropic text generation failed: %s", exc.__class__.__name__, extra={"model": model})
            return None

    def generate_json(self, *, system: str, prompt: str, max_tokens: int = 1000, deep: bool = False) -> dict[str, Any] | None:
        result = self.generate_text(
            system=f"{system}\nReturn only valid JSON. Do not include markdown fences.",
            prompt=prompt,
            max_tokens=max_tokens,
            deep=deep,
        )
        if not result:
            return None
        try:
            return json.loads(_extract_json(result.text))
        except json.JSONDecodeError:
            logger.warning("Anthropic returned non-JSON output", extra={"model": result.model})
            return None

    def _messages(self, *, model: str, system: str, prompt: str, max_tokens: int) -> str:
        response = httpx.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": self.api_key or "",
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": max_tokens,
                "temperature": 0.1,
                "system": system,
                "messages": [{"role": "user", "content": prompt}],
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        payload = response.json()
        parts = [part.get("text", "") for part in payload.get("content", []) if part.get("type") == "text"]
        return "\n".join(part for part in parts if part).strip()


def build_ai_provider(settings: Settings) -> AIProvider:
    if settings.ai_provider == "anthropic":
        return AnthropicProvider(settings)
    return DisabledAIProvider()


def _extract_json(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped
    start = stripped.find("{")
    end = stripped.rfind("}")
    if start >= 0 and end > start:
        return stripped[start : end + 1]
    return stripped
