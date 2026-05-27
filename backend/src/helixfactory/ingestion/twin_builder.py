from __future__ import annotations

from pathlib import Path
from uuid import uuid5, NAMESPACE_URL

from helixfactory.api.schemas.models import TwinEdge, TwinNode
from helixfactory.ingestion.parsers.common import ParsedFile, ParsedSymbol


def stable_id(*parts: str) -> str:
    return uuid5(NAMESPACE_URL, "::".join(parts)).hex


def build_twin(repository_id: str, parsed_files: list[ParsedFile], ownership: dict[str, tuple[str, str | None]] | None = None) -> tuple[list[TwinNode], list[TwinEdge]]:
    nodes: list[TwinNode] = [
        TwinNode(id=repository_id, repository_id=repository_id, type="repository", name=repository_id, provenance="ingestion")
    ]
    edges: list[TwinEdge] = []
    file_nodes: dict[str, str] = {}
    for parsed in parsed_files:
        owner, modified_at = (ownership or {}).get(parsed.path, ("unknown-owner", None))
        file_id = stable_id(repository_id, "file", parsed.path)
        file_nodes[parsed.path] = file_id
        file_is_entry = _is_entry_file(parsed)
        nodes.append(
            TwinNode(
                id=file_id,
                repository_id=repository_id,
                type="entry_point" if file_is_entry else "file",
                name=parsed.path.split("/")[-1],
                path=parsed.path,
                start_line=1,
                end_line=max(1, max([s.end_line for s in parsed.symbols], default=1)),
                language=parsed.language,  # type: ignore[arg-type]
                owner=owner,
                last_modified_by=owner,
                last_modified_at=modified_at,
                provenance=parsed.path,
                metadata={"is_entry_point": file_is_entry},
            )
        )
        edges.append(
            TwinEdge(
                id=stable_id(repository_id, "contains", parsed.path),
                source_node_id=repository_id,
                target_node_id=file_id,
                type="depends_on",
                confidence="exact",
                evidence_path=parsed.path,
                evidence_line=1,
            )
        )
        for symbol in parsed.symbols:
            node_id = stable_id(repository_id, symbol.kind, parsed.path, symbol.name, str(symbol.start_line))
            symbol_is_entry = _is_entry_symbol(parsed, symbol)
            nodes.append(
                TwinNode(
                    id=node_id,
                    repository_id=repository_id,
                    type="entry_point" if symbol_is_entry else symbol.kind,  # type: ignore[arg-type]
                    name=symbol.name,
                    path=symbol.path,
                    start_line=symbol.start_line,
                    end_line=symbol.end_line,
                    language=parsed.language,  # type: ignore[arg-type]
                    owner=owner,
                    last_modified_by=owner,
                    last_modified_at=modified_at,
                    provenance=f"{symbol.path}:{symbol.start_line}",
                    metadata={"is_entry_point": symbol_is_entry, "symbol_kind": symbol.kind},
                )
            )
            edges.append(
                TwinEdge(
                    id=stable_id(repository_id, "defines", parsed.path, symbol.name, str(symbol.start_line)),
                    source_node_id=file_id,
                    target_node_id=node_id,
                    type="depends_on",
                    confidence="exact",
                    evidence_path=parsed.path,
                    evidence_line=symbol.start_line,
                )
            )
    for parsed in parsed_files:
        source = file_nodes[parsed.path]
        for import_name, line in parsed.imports:
            target = _resolve_import(import_name, file_nodes)
            if target:
                edges.append(
                    TwinEdge(
                        id=stable_id(repository_id, "imports", parsed.path, import_name, str(line)),
                        source_node_id=source,
                        target_node_id=target,
                        type="imports",
                        confidence="exact",
                        evidence_path=parsed.path,
                        evidence_line=line,
                    )
                )
    return nodes, edges


def _is_entry_file(parsed: ParsedFile) -> bool:
    name = Path(parsed.path).name.lower()
    if parsed.language == "python":
        return name in {"main.py", "app.py", "wsgi.py", "asgi.py"}
    if parsed.language in {"typescript", "javascript"}:
        return name in {"index.ts", "index.js", "server.ts", "server.js", "app.ts", "app.js"}
    return False


def _is_entry_symbol(parsed: ParsedFile, symbol: ParsedSymbol) -> bool:
    if symbol.name.lower() == "main":
        return True
    if parsed.language == "python":
        return _symbol_source_contains(parsed, symbol, ("@app.route", "@router.get", "@router.post", "@router.put", "@router.delete", "@router.patch"))
    if parsed.language in {"typescript", "javascript"}:
        return symbol.name == "default" or _symbol_source_contains(parsed, symbol, ("export default",))
    return False


def _symbol_source_contains(parsed: ParsedFile, symbol: ParsedSymbol, needles: tuple[str, ...]) -> bool:
    source = parsed.metadata.get("source_lines")
    if not isinstance(source, list):
        return False
    window = "\n".join(str(line) for line in source[max(0, symbol.start_line - 4):symbol.start_line + 1])
    return any(needle in window for needle in needles)


def _resolve_import(import_name: str, file_nodes: dict[str, str]) -> str | None:
    normalized = import_name.replace(".", "/").removeprefix("./").removeprefix("../")
    for path, node_id in file_nodes.items():
        stem = path.rsplit(".", 1)[0]
        if stem.endswith(normalized) or path.endswith(f"{normalized}.py") or path.endswith(f"{normalized}.ts") or path.endswith(f"{normalized}.js"):
            return node_id
    return None
