from __future__ import annotations

from helixfactory.api.schemas.models import ApprovalGate


def regulated_data_gate(subject_ref: str, summary: str) -> ApprovalGate | None:
    if any(term in summary.lower() for term in ("regulated", "pii", "payment", "patient", "gdpr")):
        return ApprovalGate(
            id=f"compliance-{subject_ref}",
            gate_type="compliance",
            subject_ref=subject_ref,
            required=True,
            status="blocked",
            reason="Regulated-data changes require pre-mortem, security scan, and human approval evidence",
        )
    return None
