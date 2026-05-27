import pytest

from helixfactory.services.execution_state import ExecutionStateMachine


def test_agent_execution_state_machine_transitions():
    machine = ExecutionStateMachine("exec1")
    for state in ["collecting_context", "risk_checking", "executing", "reviewing", "completed"]:
        machine.transition(state)
    assert machine.status == "completed"
    with pytest.raises(ValueError):
        machine.transition("executing")
