from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import pytest

from helixfactory.ingestion.parsers.common import ParsedFile, ParsedSymbol
from helixfactory.ingestion.twin_builder import build_twin
from helixfactory.services.runtime import RuntimeState


@pytest.fixture
def state(tmp_path):
    from helixfactory.services.config import Settings

    settings = Settings(storage_path=tmp_path / "storage", audit_repository_path=tmp_path / "audit", clone_workspace=tmp_path / "clones")
    return RuntimeState(settings=settings)


@pytest.fixture
def parsed_files():
    return [
        ParsedFile(
            path="app.py",
            language="python",
            symbols=[ParsedSymbol("function", "handler", "app.py", 3, 5)],
            imports=[("lib", 1)],
        ),
        ParsedFile(
            path="lib.py",
            language="python",
            symbols=[ParsedSymbol("function", "helper", "lib.py", 2, 4)],
        ),
    ]


@pytest.fixture
def seeded_state(state, parsed_files):
    nodes, edges = build_twin("repo1", parsed_files)
    state.graph_store.save("repo1", nodes, edges)
    return state
