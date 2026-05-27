from __future__ import annotations

from helixfactory.services.skill_refinements import SkillRefinementService


class ReflectionService:
    def __init__(self, refinements: SkillRefinementService | None = None) -> None:
        self.refinements = refinements or SkillRefinementService()

    def reflect(self, execution_id: str, recurring_issue: str, evidence_refs: list[str]):
        if not evidence_refs:
            raise ValueError("reflection requires evidence refs")
        return self.refinements.propose(execution_id, recurring_issue, evidence_refs)
