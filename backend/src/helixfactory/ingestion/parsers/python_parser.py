from __future__ import annotations

from pathlib import Path

from helixfactory.ingestion.parsers.common import ParsedFile, ParsedSymbol, safe_lines, tree_sitter_unavailable


def parse_python(path: Path, root: Path) -> ParsedFile:
    rel = path.relative_to(root).as_posix()
    parsed = ParsedFile(path=rel, language="python")
    try:
        from tree_sitter import Language, Parser
        import tree_sitter_python
    except Exception as exc:
        raise tree_sitter_unavailable("python") from exc

    parser = Parser()
    parser.language = Language(tree_sitter_python.language())
    source = path.read_bytes()
    tree = parser.parse(source)
    lines = safe_lines(path)
    parsed.metadata["source_lines"] = lines

    def text(node) -> str:
        return source[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")

    def child_text(node, field: str) -> str | None:
        child = node.child_by_field_name(field)
        return text(child) if child is not None else None

    def walk(node) -> None:
        if node.type in {"import_statement", "import_from_statement"}:
            line = lines[node.start_point[0]] if node.start_point[0] < len(lines) else ""
            parts = line.replace("import", " ").replace("from", " ").split()
            if parts:
                parsed.imports.append((parts[0].strip(","), node.start_point[0] + 1))
        elif node.type in {"function_definition", "class_definition"}:
            name = child_text(node, "name")
            if name:
                kind = "class" if node.type == "class_definition" else "function"
                parsed.symbols.append(ParsedSymbol(kind, name, rel, node.start_point[0] + 1, node.end_point[0] + 1))
        for child in node.children:
            walk(child)

    if tree.root_node.has_error:
        return parsed
    walk(tree.root_node)
    return parsed
