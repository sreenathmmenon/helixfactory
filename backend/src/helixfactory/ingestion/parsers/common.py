from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from helixfactory.services.errors import ParserDependencyError


@dataclass
class ParsedSymbol:
    kind: str
    name: str
    path: str
    start_line: int
    end_line: int


@dataclass
class ParsedFile:
    path: str
    language: str
    symbols: list[ParsedSymbol] = field(default_factory=list)
    imports: list[tuple[str, int]] = field(default_factory=list)
    metadata: dict[str, object] = field(default_factory=dict)


def safe_lines(path: Path) -> list[str]:
    try:
        return path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        return path.read_text(errors="ignore").splitlines()


def tree_sitter_unavailable(language: str) -> ParserDependencyError:
    return ParserDependencyError(
        f"{language} parser dependencies are not installed. Install tree-sitter grammar packages before production ingestion.",
        {"language": language, "requiredPackagePrefix": "tree-sitter"},
    )
