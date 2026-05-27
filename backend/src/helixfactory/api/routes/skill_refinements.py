from fastapi import APIRouter
from pydantic import BaseModel, Field

from helixfactory.api.schemas.models import SkillRefinement
from helixfactory.services.skill_refinements import SkillRefinementService

router = APIRouter()
service = SkillRefinementService()


class SkillProposalRequest(BaseModel):
    executionId: str
    patternSummary: str
    evidenceRefs: list[str] = Field(default_factory=list)


class SkillDecisionRequest(BaseModel):
    reviewer: str


@router.post("/skill-refinements", response_model=SkillRefinement)
def propose_refinement(request: SkillProposalRequest) -> SkillRefinement:
    return service.propose(request.executionId, request.patternSummary, request.evidenceRefs)


@router.post("/skill-refinements/{refinement_id}/approve", response_model=SkillRefinement)
def approve_refinement(refinement_id: str, request: SkillDecisionRequest) -> SkillRefinement:
    return service.decide(refinement_id, "approved", request.reviewer)


@router.post("/skill-refinements/{refinement_id}/reject", response_model=SkillRefinement)
def reject_refinement(refinement_id: str, request: SkillDecisionRequest) -> SkillRefinement:
    return service.decide(refinement_id, "rejected", request.reviewer)


@router.post("/skill-refinements/{refinement_id}/merged", response_model=SkillRefinement)
def merge_refinement(refinement_id: str, request: SkillDecisionRequest) -> SkillRefinement:
    return service.decide(refinement_id, "merged", request.reviewer)
