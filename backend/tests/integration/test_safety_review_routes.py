from fastapi.testclient import TestClient

from helixfactory.api.app import create_app
from helixfactory.api.routes import safety_reviews
from helixfactory.services.safety_review import SafetyReviewService


def test_safety_review_routes_create_and_approve(seeded_state):
    safety_reviews.service = SafetyReviewService(seeded_state)
    client = TestClient(create_app())

    create_response = client.post(
        "/safety-reviews",
        json={
            "repositoryId": "repo1",
            "summary": "delete handler",
            "targetRefs": ["handler"],
            "changeType": "delete",
        },
    )
    assert create_response.status_code == 200
    review = create_response.json()
    assert review["premortem"]["findings"]
    assert review["blastRadius"]["nodes"]
    assert review["decision"]["status"] == "block"
    assert review["approvalStatus"] == "required"
    assert review["auditRecordId"].startswith("audit-review-")

    approval_response = client.post(
        f"/safety-reviews/{review['id']}/approve",
        json={"reviewer": "ada", "reason": "Reviewed evidence and accepted the risk."},
    )
    assert approval_response.status_code == 200
    approval = approval_response.json()
    assert approval["approvalStatus"] == "approved"
    assert approval["auditRecordId"].startswith(f"audit-{review['id']}-approved")


def test_safety_review_route_rejects_empty_targets(seeded_state):
    safety_reviews.service = SafetyReviewService(seeded_state)
    client = TestClient(create_app())

    response = client.post(
        "/safety-reviews",
        json={
            "repositoryId": "repo1",
            "summary": "modify handler",
            "targetRefs": [],
        },
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
