from __future__ import annotations

from pathlib import Path

from helixfactory.ingestion.parsers.common import ParsedFile, ParsedSymbol, safe_lines, tree_sitter_unavailable


def parse_javascript(path: Path, root: Path) -> ParsedFile:
    rel = path.relative_to(root).as_posix()
    parsed = ParsedFile(path=rel, language="javascript")
    try:
        from tree_sitter import Language, Parser
        import tree_sitter_javascript
    except Exception as exc:
        raise tree_sitter_unavailable("javascript") from exc

    parser = Parser()
    parser.language = Language(tree_sitter_javascript.language())
    source = path.read_bytes()
    tree = parser.parse(source)
    lines = safe_lines(path)
    parsed.metadata["source_lines"] = lines

    def text(node) -> str:
        return source[node.start_byte:node.end_byte].decode("utf-8", errors="ignore")

    def child_text(node, field: str) -> str | None:
        child = node.child_by_field_name(field)
        return text(child) if child is not None else None

    def import_ref(line: str) -> str | None:
        quote = "'" if "'" in line else '"' if '"' in line else None
        if not quote:
            return None
        parts = line.split(quote)
        return parts[-2] if len(parts) >= 3 else None

    def walk(node) -> None:
        if node.type == "import_statement":
            ref = import_ref(lines[node.start_point[0]] if node.start_point[0] < len(lines) else "")
            if ref:
                parsed.imports.append((ref, node.start_point[0] + 1))
        elif node.type == "class_declaration":
            name = child_text(node, "name")
            if name:
                parsed.symbols.append(ParsedSymbol("class", name, rel, node.start_point[0] + 1, node.end_point[0] + 1))
        elif node.type == "function_declaration":
            name = child_text(node, "name")
            if name:
                parsed.symbols.append(ParsedSymbol("function", name, rel, node.start_point[0] + 1, node.end_point[0] + 1))
        elif node.type == "lexical_declaration":
            for child in node.children:
                if child.type == "variable_declarator":
                    name = child_text(child, "name")
                    value = child.child_by_field_name("value")
                    if name and value and value.type in {"arrow_function", "function"}:
                        parsed.symbols.append(ParsedSymbol("function", name, rel, child.start_point[0] + 1, child.end_point[0] + 1))
        for child in node.children:
            walk(child)

    walk(tree.root_node)
    return parsed
