from helixfactory.ingestion.language_filter import detect_language
from helixfactory.ingestion.parsers.javascript_parser import parse_javascript
from helixfactory.ingestion.parsers.python_parser import parse_python
from helixfactory.ingestion.parsers.typescript_parser import parse_typescript
from helixfactory.services.errors import ParserDependencyError


def test_parsers_cover_supported_languages_and_partial_parse(tmp_path):
    py = tmp_path / "app.py"
    py.write_text("import lib\n\ndef handler():\n    return 1\n", encoding="utf-8")
    ts = tmp_path / "app.ts"
    ts.write_text("import {x} from './x';\nexport function run() {}\nclass Worker {}\n", encoding="utf-8")
    js = tmp_path / "app.js"
    js.write_text("import './side';\nconst run = () => 1;\n", encoding="utf-8")
    broken = tmp_path / "broken.py"
    broken.write_text("def broken(:\n", encoding="utf-8")
    try:
        assert parse_python(py, tmp_path).symbols[0].name == "handler"
        assert {s.kind for s in parse_typescript(ts, tmp_path).symbols} == {"function", "class"}
        assert parse_javascript(js, tmp_path).language == "javascript"
        assert parse_python(broken, tmp_path).symbols == []
    except ParserDependencyError as exc:
        assert exc.code == "parser_dependency_missing"
    assert detect_language(tmp_path / "README.md") is None
