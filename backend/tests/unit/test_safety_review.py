from helixfactory.api.schemas.requests import SafetyReviewDecisionRequest, SafetyReviewRequest
from helixfactory.services.errors import NotFoundError
from helixfactory.services.safety_review import SafetyReviewService


def test_safety_review_combines_premortem_blast_radius_and_audit(seeded_state):
    service = SafetyReviewService(seeded_state)

    review = service.create(
        SafetyReviewRequest(
            repositoryId="repo1",
            summary="delete handler",
            targetRefs=["handler"],
            changeType="delete",
            scenarioId="scenario-1",
        )
    )

    assert review.id.startswith("review-")
    assert review.scenario_id == "scenario-1"
    assert review.premortem["findings"]
    assert review.blast_radius.nodes
    assert review.decision.status == "block"
    assert review.approval_status == "required"
    assert review.evidence_refs
    assert review.suggested_checks
    assert review.confidence in {"high", "medium", "low"}
    assert review.evidence_completeness in {"complete", "partial", "insufficient"}
    assert review.audit_record_id.startswith("audit-review-")
    assert seeded_state.audit_records[-1].action_type == "review"


def test_safety_review_blocks_insufficient_evidence_without_fake_success(seeded_state):
    service = SafetyReviewService(seeded_state)

    review = service.create(
        SafetyReviewRequest(
            repositoryId="repo1",
            summary="modify missing target",
            targetRefs=["missing-target"],
        )
    )

    assert review.premortem["riskStatus"] == "blocked_insufficient_evidence"
    assert review.decision.status == "block"
    assert review.evidence_completeness == "insufficient"
    assert review.confidence == "low"
    assert seeded_state.audit_records[-1].result == "blocked"


def test_safety_review_approve_and_reject_record_audit(seeded_state):
    service = SafetyReviewService(seeded_state)
    review = service.create(SafetyReviewRequest(repositoryId="repo1", summary="modify handler", targetRefs=["handler"]))

    approval = service.approve(review.id, SafetyReviewDecisionRequest(reviewer="ada", reason="Reviewed evidence."))
    assert approval.approval_status == "approved"
    assert approval.audit_record_id.startswith(f"audit-{review.id}-approved")
    assert service.reviews[review.id].approval_status == "approved"

    rejection = service.reject(review.id, SafetyReviewDecisionRequest(reviewer="grace", reason="Need more tests."))
    assert rejection.approval_status == "rejected"
    assert rejection.audit_record_id.startswith(f"audit-{review.id}-rejected")
    assert service.reviews[review.id].approval_status == "rejected"
    assert seeded_state.audit_records[-1].details == {"reason": "Need more tests."}


def test_safety_review_decision_requires_known_review(seeded_state):
    service = SafetyReviewService(seeded_state)

    try:
        service.approve("review-missing", SafetyReviewDecisionRequest(reviewer="ada", reason="No review."))
    except NotFoundError as exc:
        assert exc.details == {"reviewId": "review-missing"}
    else:
        raise AssertionError("Expected missing safety review to raise NotFoundError")
