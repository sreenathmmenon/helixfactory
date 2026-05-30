from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=lambda s: "".join([s.split("_")[0], *[p.title() for p in s.split("_")[1:]]]), populate_by_name=True)


class RepositoryStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    partial = "partial"
    complete = "complete"
    failed = "failed"


Language = Literal["python", "typescript", "javascript"]
NodeType = Literal["repository", "entry_point", "file", "function", "class", "service", "data_field", "config", "infrastructure", "owner", "decision", "document", "ticket", "pull_request", "commit"]
EdgeType = Literal["calls", "imports", "emits_event", "consumes_event", "shares_schema", "uses_env", "runtime_injection", "data_flows_to", "owns", "changed_by", "documents", "decided_by", "depends_on"]
Confidence = Literal["exact", "inferred", "partial"]
Risk = Literal["none", "low", "medium", "high", "critical"]
ChangeType = Literal["add", "modify", "rename", "delete", "database", "interface", "infrastructure", "dependency"]
Result = Literal["success", "partial", "blocked", "failed"]


class Repository(CamelModel):
    id: str
    url: str | HttpUrl
    default_branch: str | None = None
    local_path: str | None = None
    ingestion_status: RepositoryStatus = RepositoryStatus.pending
    supported_languages: list[Language] = Field(default_factory=list)
    last_ingested_commit: str | None = None
    owner: str | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
    failure_reason: str | None = None
    node_count: int = 0
    edge_count: int = 0

    @model_validator(mode="after")
    def partial_and_failed_need_reason(self) -> "Repository":
        if self.ingestion_status in {RepositoryStatus.partial, RepositoryStatus.failed} and not self.failure_reason:
            raise ValueError("partial and failed repositories require failure_reason")
        return self


class TwinNode(CamelModel):
    id: str
    repository_id: str
    type: NodeType
    name: str
    path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    language: Language | None = None
    owner: str | None = None
    last_modified_by: str | None = None
    last_modified_at: datetime | None = None
    provenance: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    risk: Risk = "none"

    @model_validator(mode="after")
    def code_nodes_need_range(self) -> "TwinNode":
        if self.type in {"file", "function", "class"}:
            if not self.path or self.start_line is None or self.end_line is None:
                raise ValueError("code nodes require path and line range")
        return self


class TwinEdge(CamelModel):
    id: str
    source_node_id: str
    target_node_id: str
    type: EdgeType
    confidence: Confidence = "exact"
    evidence_path: str | None = None
    evidence_line: int | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ProposedChange(CamelModel):
    id: str
    source: Literal["manual", "ticket", "pipeline", "agent"] = "manual"
    repository_id: str
    summary: str
    change_type: ChangeType
    target_refs: list[str]
    risk_status: Literal["unknown", "evaluating", "low", "medium", "high", "critical"] = "unknown"
    approval_status: Literal["not_required", "required", "approved", "rejected", "blocked"] = "not_required"
    created_by: str = "user"
    created_at: datetime = Field(default_factory=utc_now)

    @field_validator("target_refs")
    @classmethod
    def require_targets(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("target_refs is required")
        return value


class PreMortemFinding(CamelModel):
    id: str
    proposed_change_id: str
    severity: Literal["critical", "high", "medium", "low"]
    title: str
    consequence: str
    file_path: str
    line: int
    dependency_chain: list[str]
    owner_context: str | None = None
    preventive_check: str
    status: Literal["open", "suppressed_insufficient_evidence", "accepted", "resolved", "false_positive"] = "open"

    @model_validator(mode="after")
    def require_evidence(self) -> "PreMortemFinding":
        if not self.file_path or not self.line or not self.dependency_chain or not self.consequence or not self.preventive_check:
            raise ValueError("surfaced findings require complete evidence")
        return self


class GraphCenter(CamelModel):
    type: Literal["query", "node", "proposed_change"]
    value: str


class GraphNode(CamelModel):
    id: str
    type: str
    name: str
    path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    owner: str | None = None
    last_modified_by: str | None = None
    last_modified_at: datetime | None = None
    connection_count: int = 0
    is_entry_point: bool = False
    risk: Risk = "none"


class GraphEdge(CamelModel):
    id: str
    source: str
    target: str
    type: str
    confidence: Confidence = "exact"
    evidence_path: str | None = None
    evidence_line: int | None = None


class NodeSource(CamelModel):
    node_id: str
    path: str | None = None
    start_line: int | None = None
    end_line: int | None = None
    language: Language | None = None
    snippet: str = ""
    unavailable_reason: str | None = None


class NodeRelationshipGroup(CamelModel):
    relationship: str
    direction: Literal["incoming", "outgoing"]
    nodes: list[GraphNode] = Field(default_factory=list)
    edges: list[GraphEdge] = Field(default_factory=list)


class NodeContext(CamelModel):
    node: GraphNode
    relationship_groups: list[NodeRelationshipGroup] = Field(default_factory=list)
    evidence_edges: list[GraphEdge] = Field(default_factory=list)


class GraphPath(CamelModel):
    source: GraphNode
    target: GraphNode
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    explanation: str
    confidence: Confidence = "exact"


class BlastRadiusView(CamelModel):
    id: str
    center_type: Literal["query", "node", "proposed_change"]
    center_ref: str
    depth: int = Field(ge=1, le=4)
    relationship_filters: list[str] = Field(default_factory=list)
    nodes: list[str]
    edges: list[str]
    risk_summary: dict[str, int] = Field(default_factory=dict)
    generated_at: datetime = Field(default_factory=utc_now)


class GraphView(CamelModel):
    center: GraphCenter
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    depth: int
    risk_summary: dict[str, int] = Field(default_factory=dict)


class SafetyReviewDecision(CamelModel):
    status: Literal["allow", "block"]
    reason: str


class SafetyReview(CamelModel):
    id: str
    repository_id: str
    change_id: str
    scenario_id: str | None = None
    summary: str
    change_type: ChangeType
    target_refs: list[str]
    premortem: dict[str, Any]
    blast_radius: GraphView
    decision: SafetyReviewDecision
    evidence_refs: list[str] = Field(default_factory=list)
    suggested_checks: list[str] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"]
    evidence_completeness: Literal["complete", "partial", "insufficient"]
    approval_status: Literal["not_required", "required", "approved", "rejected", "blocked"]
    audit_record_id: str
    created_at: datetime = Field(default_factory=utc_now)


class SafetyReviewDecisionResult(CamelModel):
    review_id: str
    approval_status: Literal["approved", "rejected"]
    reviewer: str
    reason: str
    audit_record_id: str
    decided_at: datetime = Field(default_factory=utc_now)


class AuditRecord(CamelModel):
    id: str
    action_type: Literal["ingestion", "premortem", "blast_radius", "agent_execution", "security_scan", "review", "approval", "merge", "qa", "skill_refinement"]
    actor: str
    subject_ref: str
    input_refs: list[str] = Field(default_factory=list)
    output_refs: list[str] = Field(default_factory=list)
    summary: str = ""
    result: Result
    details: dict[str, Any] | None = None
    timestamp: datetime = Field(default_factory=utc_now)
    git_commit: str = "pending"

    @model_validator(mode="after")
    def non_success_requires_details(self) -> "AuditRecord":
        if self.result in {"partial", "blocked", "failed"} and not self.details:
            raise ValueError("partial, blocked, and failed audit records require details")
        return self


class SecurityFinding(CamelModel):
    id: str
    severity: Literal["critical", "high", "medium", "low"]
    category: str
    affected_services: list[str]
    dependency_paths: list[list[str]]
    remediation_order: list[str]
    status: Literal["open", "accepted", "resolved", "suppressed"] = "open"


class ArchitectureSnapshot(CamelModel):
    id: str
    repository_id: str
    revision: str
    captured_at: datetime = Field(default_factory=utc_now)
    node_refs: list[str]
    edge_refs: list[str]
    known_gaps: list[str] = Field(default_factory=list)


class KnowledgeSource(CamelModel):
    id: str
    source_type: Literal["repository", "pull_request", "ticket", "discussion", "document", "commit", "decision_record"]
    external_ref: str
    title: str
    status: Literal["available", "unavailable", "stale", "partial"] = "available"
    ingested_at: datetime = Field(default_factory=utc_now)
    provenance: str


class SkillRefinement(CamelModel):
    id: str
    agent_execution_id: str
    pattern_summary: str
    evidence_refs: list[str]
    proposal_text: str
    status: Literal["proposed", "approved", "rejected", "merged"] = "proposed"
    reviewer: str | None = None

    @model_validator(mode="after")
    def reject_generic(self) -> "SkillRefinement":
        generic_terms = {"best practice", "always write tests", "clean code"}
        if any(term in self.pattern_summary.lower() for term in generic_terms):
            raise ValueError("generic refinements are invalid")
        if self.status in {"approved", "merged"} and not self.reviewer:
            raise ValueError("approved refinements require human review")
        return self


class ApprovalGate(CamelModel):
    id: str
    gate_type: Literal["risk", "security", "compliance", "review", "human_approval"]
    subject_ref: str
    required: bool
    status: Literal["pending", "passed", "blocked", "approved", "rejected"]
    reason: str
    approved_by: str | None = None
    decided_at: datetime | None = None


class AgentExecution(CamelModel):
    id: str
    trigger: Literal["ticket", "manual", "pipeline"]
    proposed_change_id: str
    status: Literal["queued", "collecting_context", "risk_checking", "executing", "reviewing", "blocked", "completed", "failed"] = "queued"
    context_refs: list[str] = Field(default_factory=list)
    test_evidence: str | None = None
    pull_request_ref: str | None = None
    failure_reason: str | None = None
