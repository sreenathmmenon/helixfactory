from __future__ import annotations

from pydantic import Field, HttpUrl

from helixfactory.api.schemas.models import CamelModel, ChangeType, GraphCenter


class IngestRepositoryRequest(CamelModel):
    url: HttpUrl
    branch: str | None = None
    label: str | None = None


class GraphQueryRequest(CamelModel):
    repository_id: str
    center: GraphCenter
    depth: int = Field(default=2, ge=1, le=4)
    relationship_types: list[str] = Field(default_factory=list)


class PreMortemRequest(CamelModel):
    repository_id: str
    summary: str
    change_type: ChangeType
    target_refs: list[str]


class BlastRadiusRequest(PreMortemRequest):
    depth: int = Field(default=2, ge=1, le=4)
    relationship_types: list[str] = Field(default_factory=list)


class ArchitectureQuestionRequest(CamelModel):
    repository_id: str
    question: str
    context_node_id: str | None = None


class GraphAskRequest(CamelModel):
    repository_id: str
    question: str


class NodeSummaryRequest(CamelModel):
    repository_id: str
    node_id: str


class NodeContextRequest(CamelModel):
    repository_id: str
    node_id: str


class NodeSourceRequest(CamelModel):
    repository_id: str
    node_id: str


class GraphPathRequest(CamelModel):
    repository_id: str
    source_node_id: str
    target_node_id: str
    relationship_types: list[str] = Field(default_factory=list)
    max_depth: int = Field(default=4, ge=1, le=6)


class NodeSummaryResponse(CamelModel):
    node_id: str
    summary: str


class Citation(CamelModel):
    source_type: str
    source_ref: str
    path: str | None = None
    line: int | None = None


class ArchitectureAnswer(CamelModel):
    answer: str
    citations: list[Citation]
    uncertainty: list[str]


class EvidencePackageRequest(CamelModel):
    repository_id: str | None = None
    date_from: str | None = None
    date_to: str | None = None
    risk_levels: list[str] = Field(default_factory=list)
    data_sensitivity: str | None = None


class EvidencePackage(CamelModel):
    records: list[dict]


class PreMortemResult(CamelModel):
    change_id: str
    risk_status: str
    findings: list[dict]
    evidence_gaps: list[str]
    requires_human_approval: bool = False
    audit_record_id: str
