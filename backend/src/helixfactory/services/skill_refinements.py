from __future__ import annotations

from uuid import uuid4
import logging

from helixfactory.api.schemas.models import AuditRecord, SkillRefinement
from helixfactory.services.errors import BlockedOperationError, NotFoundError
from helixfactory.services.runtime import RuntimeState, runtime


class SkillRefinementService:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state
        self.refinements: dict[str, SkillRefinement] = {}
        self.logger = logging.getLogger("helixfactory.skill_refinements")

    def propose(self, execution_id: str, pattern_summary: str, evidence_refs: list[str]) -> SkillRefinement:
        if not evidence_refs:
            raise BlockedOperationError("Skill refinements require at least one evidence reference.", {"executionId": execution_id})
        try:
            refinement = SkillRefinement(
                id=f"skill-{uuid4().hex[:10]}",
                agent_execution_id=execution_id,
                pattern_summary=pattern_summary,
                evidence_refs=evidence_refs,
                proposal_text=f"Use this codebase-specific pattern when working in this repository: {pattern_summary}",
            )
        except ValueError as exc:
            self.logger.warning("Rejected generic skill refinement", exc_info=True)
            raise BlockedOperationError("Generic skill refinements are rejected. Provide a codebase-specific pattern with evidence.", {"reason": str(exc)}) from exc
        self.refinements[refinement.id] = refinement
        self._audit(refinement, "proposed")
        return refinement

    def decide(self, refinement_id: str, status: str, reviewer: str) -> SkillRefinement:
        if refinement_id not in self.refinements:
            raise NotFoundError("Skill refinement was not found.", {"refinementId": refinement_id})
        refinement = self.refinements[refinement_id].model_copy(update={"status": status, "reviewer": reviewer})
        self.refinements[refinement.id] = refinement
        self._audit(refinement, status)
        return refinement

    def _audit(self, refinement: SkillRefinement, status: str) -> None:
        self.state.record_audit(
            AuditRecord(
                id=f"audit-{refinement.id}-{status}",
                action_type="skill_refinement",
                actor="system",
                subject_ref=refinement.id,
                input_refs=refinement.evidence_refs,
                output_refs=[refinement.id],
                summary=status,
                result="success",
            )
        )
