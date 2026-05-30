from __future__ import annotations

from uuid import uuid4

from helixfactory.api.schemas.models import AuditRecord, SafetyReview, SafetyReviewDecision, SafetyReviewDecisionResult
from helixfactory.api.schemas.requests import BlastRadiusRequest, PreMortemRequest, SafetyReviewDecisionRequest, SafetyReviewRequest
from helixfactory.graph.blast_radius import BlastRadiusService
from helixfactory.premortem.engine import PreMortemEngine
from helixfactory.services.errors import NotFoundError
from helixfactory.services.runtime import RuntimeState, runtime


class SafetyReviewService:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state
        self.premortem = PreMortemEngine(state)
        self.blast_radius = BlastRadiusService(state)
        self.reviews: dict[str, SafetyReview] = {}

    def create(self, request: SafetyReviewRequest) -> SafetyReview:
        premortem = self.premortem.run(
            PreMortemRequest(
                repository_id=request.repository_id,
                summary=request.summary,
                change_type=request.change_type,
                target_refs=request.target_refs,
            )
        )
        blast_radius = self.blast_radius.calculate(
            BlastRadiusRequest(
                repository_id=request.repository_id,
                summary=request.summary,
                change_type=request.change_type,
                target_refs=request.target_refs,
                depth=request.depth,
                relationship_types=request.relationship_types,
            )
        )

        review_id = f"review-{uuid4().hex[:10]}"
        finding_refs = [str(finding.get("id")) for finding in premortem.findings if finding.get("id")]
        graph_refs = [node.id for node in blast_radius.nodes]
        evidence_refs = [*finding_refs, *graph_refs[:20]]
        suggested_checks = _suggested_checks(premortem.findings)
        evidence_completeness = _evidence_completeness(
            has_findings=bool(premortem.findings),
            has_graph=bool(blast_radius.nodes),
            evidence_gaps=premortem.evidence_gaps,
        )
        confidence = _confidence(evidence_completeness, premortem.risk_status)
        decision = _decision(premortem.risk_status, premortem.requires_human_approval, bool(blast_radius.nodes))
        approval_status = "required" if decision.status == "block" else "not_required"

        audit = self.state.record_audit(
            AuditRecord(
                id=f"audit-{review_id}",
                action_type="review",
                actor="system",
                subject_ref=review_id,
                input_refs=[request.repository_id, premortem.audit_record_id, *request.target_refs],
                output_refs=evidence_refs,
                summary=request.summary,
                result="blocked" if decision.status == "block" else "success",
                details=None
                if decision.status == "allow"
                else {
                    "reason": decision.reason,
                    "riskStatus": premortem.risk_status,
                    "evidenceCompleteness": evidence_completeness,
                    "requiresHumanApproval": premortem.requires_human_approval,
                },
            )
        )
        review = SafetyReview(
            id=review_id,
            repository_id=request.repository_id,
            change_id=premortem.change_id,
            scenario_id=request.scenario_id,
            summary=request.summary,
            change_type=request.change_type,
            target_refs=request.target_refs,
            premortem=premortem.model_dump(by_alias=True, mode="json"),
            blast_radius=blast_radius,
            decision=decision,
            evidence_refs=evidence_refs,
            suggested_checks=suggested_checks,
            confidence=confidence,
            evidence_completeness=evidence_completeness,
            approval_status=approval_status,  # type: ignore[arg-type]
            audit_record_id=audit.id,
        )
        self.reviews[review.id] = review
        return review

    def approve(self, review_id: str, request: SafetyReviewDecisionRequest) -> SafetyReviewDecisionResult:
        return self._decide(review_id, "approved", request)

    def reject(self, review_id: str, request: SafetyReviewDecisionRequest) -> SafetyReviewDecisionResult:
        return self._decide(review_id, "rejected", request)

    def _decide(self, review_id: str, status: str, request: SafetyReviewDecisionRequest) -> SafetyReviewDecisionResult:
        review = self.reviews.get(review_id)
        if review is None:
            raise NotFoundError("Safety review was not found.", {"reviewId": review_id})
        audit = self.state.record_audit(
            AuditRecord(
                id=f"audit-{review_id}-{status}-{uuid4().hex[:8]}",
                action_type="approval",
                actor=request.reviewer,
                subject_ref=review_id,
                input_refs=[review.audit_record_id],
                output_refs=[],
                summary=f"Safety review {status}",
                result="success" if status == "approved" else "blocked",
                details={"reason": request.reason},
            )
        )
        updated = review.model_copy(update={"approval_status": status})
        self.reviews[review_id] = updated
        return SafetyReviewDecisionResult(
            review_id=review_id,
            approval_status=status,  # type: ignore[arg-type]
            reviewer=request.reviewer,
            reason=request.reason,
            audit_record_id=audit.id,
        )


def _decision(risk_status: str, requires_human_approval: bool, has_graph: bool) -> SafetyReviewDecision:
    if not has_graph:
        return SafetyReviewDecision(status="block", reason="Blast radius did not resolve any twin nodes.")
    if risk_status in {"high", "critical"}:
        return SafetyReviewDecision(status="block", reason="HIGH or CRITICAL pre-mortem findings require human approval.")
    if requires_human_approval or risk_status == "blocked_insufficient_evidence":
        return SafetyReviewDecision(status="block", reason="The review has insufficient evidence for automatic approval.")
    return SafetyReviewDecision(status="allow", reason="Evidence-backed pre-mortem and blast radius did not require a human gate.")


def _evidence_completeness(has_findings: bool, has_graph: bool, evidence_gaps: list[str]) -> str:
    if not has_findings or not has_graph:
        return "insufficient"
    if evidence_gaps:
        return "partial"
    return "complete"


def _confidence(evidence_completeness: str, risk_status: str) -> str:
    if evidence_completeness == "complete" and risk_status not in {"blocked_insufficient_evidence"}:
        return "high"
    if evidence_completeness == "partial":
        return "medium"
    return "low"


def _suggested_checks(findings: list[dict]) -> list[str]:
    checks: list[str] = []
    for finding in findings:
        check = finding.get("preventiveCheck")
        if isinstance(check, str) and check and check not in checks:
            checks.append(check)
    if not checks:
        checks.append("Resolve target refs in the twin and rerun the safety review before approval.")
    return checks


safety_review_service = SafetyReviewService()
