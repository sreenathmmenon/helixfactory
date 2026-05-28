from helixfactory.services.execution_orchestrator import ExecutionOrchestrator


def test_low_risk_and_blocked_execution_flows(seeded_state):
    orchestrator = ExecutionOrchestrator(seeded_state)
    assert orchestrator.submit("repo1", "low-risk update").status == "blocked"
    assert orchestrator.submit("repo1", "modify handler", "pytest backend/tests").status == "completed"
    assert orchestrator.submit("repo1", "critical regulated payment update").status == "blocked"
