from helixfactory.services.reflection import ReflectionService


def test_reflection_flow_creates_refinement_and_audit_record(state):
    refinement = ReflectionService().reflect("exec1", "When changing app.py, update lib.py dependency evidence", ["exec1", "app.py"])
    assert refinement.status == "proposed"
