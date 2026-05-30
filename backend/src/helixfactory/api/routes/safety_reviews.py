from fastapi import APIRouter

from helixfactory.api.schemas.models import SafetyReview, SafetyReviewDecisionResult
from helixfactory.api.schemas.requests import SafetyReviewDecisionRequest, SafetyReviewRequest
from helixfactory.services.safety_review import safety_review_service

router = APIRouter()
service = safety_review_service


@router.post("/safety-reviews", response_model=SafetyReview)
def create_safety_review(request: SafetyReviewRequest) -> SafetyReview:
    return service.create(request)


@router.post("/safety-reviews/{review_id}/approve", response_model=SafetyReviewDecisionResult)
def approve_safety_review(review_id: str, request: SafetyReviewDecisionRequest) -> SafetyReviewDecisionResult:
    return service.approve(review_id, request)


@router.post("/safety-reviews/{review_id}/reject", response_model=SafetyReviewDecisionResult)
def reject_safety_review(review_id: str, request: SafetyReviewDecisionRequest) -> SafetyReviewDecisionResult:
    return service.reject(review_id, request)
