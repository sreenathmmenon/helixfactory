from __future__ import annotations

from dataclasses import dataclass, field

VALID_TRANSITIONS = {
    "queued": {"collecting_context", "blocked", "failed"},
    "collecting_context": {"risk_checking", "blocked", "failed"},
    "risk_checking": {"executing", "blocked", "failed"},
    "executing": {"reviewing", "blocked", "failed"},
    "reviewing": {"completed", "blocked", "failed"},
}


@dataclass
class ExecutionStateMachine:
    id: str
    status: str = "queued"
    history: list[str] = field(default_factory=lambda: ["queued"])

    def transition(self, target: str) -> None:
        if target not in VALID_TRANSITIONS.get(self.status, set()):
            raise ValueError(f"invalid transition {self.status} -> {target}")
        self.status = target
        self.history.append(target)
