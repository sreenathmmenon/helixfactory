from __future__ import annotations

from pathlib import Path

from helixfactory.ingestion.parsers.common import ParsedFile, ParsedSymbol, safe_lines, tree_sitter_unavailable


def parse_typescript(path: Path, root: Path) -> ParsedFile:
    return _parse_with_tree_sitter(path, root, "typescript")


def _parse_with_tree_sitter(path: Path, root: Path, language_name: str) -> ParsedFile:
    rel = path.relative_to(root).as_posix()
    parsed = ParsedFile(path=rel, language=language_name)
    try:
        from tree_sitter import Language, Parser
        import tree_sitter_typescript
    except Exception as exc:
        raise tree_sitter_unavailable(language_name) from exc

    language_fn = tree_sitter_typescript.language_typescript if language_name == "typescript" else tree_sitter_typescript.language_tsx
    parser = Parser()
    parser.language = Language(language_fn())
    source = path.read_bytes()
    tree = parser.parse(source)
    lines = safe_lines(path)
    parsed.metadata["source_lines"] = lines

    def text(node) -> str:
        return source[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")

    def walk(node) -> None:
        node_type = node.type
        if node_type == "import_statement":
            import_ref = _import_ref_from_line(lines[node.start_point[0]] if node.start_point[0] < len(lines) else "")
            if import_ref:
                parsed.imports.append((import_ref, node.start_point[0] + 1))
        elif node_type == "class_declaration":
            name = _child_text(node, "name", text)
            if name:
                parsed.symbols.append(ParsedSymbol("class", name, rel, node.start_point[0] + 1, node.end_point[0] + 1))
        elif node_type == "function_declaration":
            name = _child_text(node, "name", text)
            if name:
                parsed.symbols.append(ParsedSymbol("function", name, rel, node.start_point[0] + 1, node.end_point[0] + 1))
        elif node_type == "lexical_declaration":
            for child in node.children:
                if child.type == "variable_declarator":
                    name = _child_text(child, "name", text)
                    value = child.child_by_field_name("value")
                    if name and value and value.type in {"arrow_function", "function"}:
                        parsed.symbols.append(ParsedSymbol("function", name, rel, child.start_point[0] + 1, child.end_point[0] + 1))
        for child in node.children:
            walk(child)

    walk(tree.root_node)
    return parsed


def _child_text(node, field: str, text) -> str | None:
    child = node.child_by_field_name(field)
    return text(child) if child is not None else None


def _import_ref_from_line(line: str) -> str | None:
    quote = "'" if "'" in line else '"' if '"' in line else None
    if not quote:
        return None
    parts = line.split(quote)
    return parts[-2] if len(parts) >= 3 else None
