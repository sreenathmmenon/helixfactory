from __future__ import annotations

from helixfactory.api.schemas.models import ApprovalGate, PreMortemFinding


def gate_for_findings(subject_ref: str, findings: list[PreMortemFinding]) -> ApprovalGate:
    risky = [finding for finding in findings if finding.severity in {"high", "critical"}]
    if risky:
        return ApprovalGate(
            id=f"gate-{subject_ref}",
            gate_type="human_approval",
            subject_ref=subject_ref,
            required=True,
            status="blocked",
            reason="HIGH or CRITICAL findings require human approval",
        )
    return ApprovalGate(id=f"gate-{subject_ref}", gate_type="risk", subject_ref=subject_ref, required=False, status="passed", reason="No high-risk findings")
