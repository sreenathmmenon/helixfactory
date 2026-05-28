from __future__ import annotations

from uuid import uuid4
import logging

from helixfactory.api.schemas.models import AgentExecution, AuditRecord
from helixfactory.services.compliance import regulated_data_gate
from helixfactory.services.context_collector import ContextCollector
from helixfactory.services.runtime import RuntimeState, runtime

logger = logging.getLogger("helixfactory.execution")


class ExecutionOrchestrator:
    def __init__(self, state: RuntimeState = runtime) -> None:
        self.state = state
        self.collector = ContextCollector(state)

    def submit(self, repository_id: str, summary: str, test_evidence: str | None = None) -> AgentExecution:
        execution_id = f"exec-{uuid4().hex[:10]}"
        context_refs = self.collector.collect(repository_id, summary)
        compliance_gate = regulated_data_gate(execution_id, summary)
        if not context_refs:
            status = "blocked"
            failure = "No cited twin context matched this execution request. Refine the summary or select a node before execution."
        elif compliance_gate:
            status = "blocked"
            failure = compliance_gate.reason
        elif "high risk" in summary.lower() or "critical" in summary.lower():
            status = "blocked"
            failure = "High-risk execution requires human approval"
        elif not test_evidence:
            status = "blocked"
            failure = "Execution requires explicit test evidence before completion."
        else:
            status = "completed"
            failure = None
        execution = AgentExecution(
            id=execution_id,
            trigger="manual",
            proposed_change_id=f"change-{execution_id}",
            status=status,  # type: ignore[arg-type]
            context_refs=context_refs,
            test_evidence=test_evidence if status == "completed" else None,
            pull_request_ref=f"pr-ready-{execution_id}" if status == "completed" else None,
            failure_reason=failure,
        )
        self.state.record_audit(
            AuditRecord(
                id=f"audit-{execution_id}",
                action_type="agent_execution",
                actor="system",
                subject_ref=execution_id,
                input_refs=[repository_id, summary],
                output_refs=[execution.pull_request_ref] if execution.pull_request_ref else [],
                summary="Governed execution boundary",
                result="success" if status == "completed" else "blocked",
                details=None if status == "completed" else {"reason": failure},
            )
        )
        if status == "blocked":
            self.state.record_audit(
                AuditRecord(
                    id=f"audit-{execution_id}-approval",
                    action_type="approval",
                    actor="system",
                    subject_ref=execution_id,
                    input_refs=[repository_id],
                    summary="Execution blocked pending human approval",
                    result="blocked",
                    details={"reason": failure},
                )
            )
        return execution
