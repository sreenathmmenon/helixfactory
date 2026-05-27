from __future__ import annotations

from pathlib import Path
import fnmatch


EXTENSION_LANGUAGE = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
}

EXCLUDED_DIRS = {
    "tests",
    "test",
    "__pycache__",
    ".git",
    "docs",
    "doc",
    "examples",
    "migrations",
    "fixtures",
    "vendor",
    "node_modules",
    ".pytest_cache",
    "dist",
    "build",
    "coverage",
    ".venv",
    "venv",
}

EXCLUDED_PATTERNS = {
    "test_*.py",
    "*_test.py",
    "*.spec.ts",
    "*.test.ts",
    "*.min.js",
    "*.min.css",
    "conftest.py",
}


def detect_language(path: Path) -> str | None:
    return EXTENSION_LANGUAGE.get(path.suffix.lower())


def supported_source_files(root: Path) -> tuple[list[Path], list[Path]]:
    supported: list[Path] = []
    unsupported: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file() or is_excluded_path(path, root):
            continue
        language = detect_language(path)
        if language:
            supported.append(path)
        elif path.suffix:
            unsupported.append(path)
    return supported, unsupported


def is_excluded_path(path: Path, root: Path) -> bool:
    try:
        rel = path.relative_to(root)
    except ValueError:
        rel = path
    if any(part in EXCLUDED_DIRS for part in rel.parts):
        return True
    name = path.name
    return any(fnmatch.fnmatch(name, pattern) for pattern in EXCLUDED_PATTERNS)
