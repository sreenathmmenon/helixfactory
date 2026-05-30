from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from helixfactory.api.schemas.requests import (
    BlastRadiusRequest,
    EvidencePackageRequest,
    GraphAskRequest,
    NodeContextRequest,
    NodeSourceRequest,
    NodeSummaryRequest,
    PreMortemRequest,
    SafetyReviewDecisionRequest,
    SafetyReviewRequest,
)
from helixfactory.audit.evidence_package import EvidencePackageBuilder
from helixfactory.graph.blast_radius import BlastRadiusService
from helixfactory.graph.query_service import GraphQueryService
from helixfactory.premortem.engine import PreMortemEngine
from helixfactory.services.errors import HelixFactoryError, NotFoundError
from helixfactory.services.runtime import runtime
from helixfactory.services.safety_review import safety_review_service

logger = logging.getLogger("helixfactory.mcp")

router = APIRouter()
graph_service = GraphQueryService()
premortem_service = PreMortemEngine()
blast_radius_service = BlastRadiusService()
evidence_builder = EvidencePackageBuilder()


class MCPRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: str | int | None = None
    method: str
    params: dict[str, Any] = Field(default_factory=dict)


TOOLS: list[dict[str, Any]] = [
    {
        "name": "helix_ask_twin",
        "description": "Ask the repository twin a plain-English architecture question and return only evidence-backed graph context.",
        "inputSchema": {
            "type": "object",
            "required": ["repositoryId", "question"],
            "properties": {
                "repositoryId": {"type": "string"},
                "question": {"type": "string"},
            },
        },
    },
    {
        "name": "helix_get_node_context",
        "description": "Return a selected twin node, relationship groups, and evidence edges for precise agent context.",
        "inputSchema": {
            "type": "object",
            "required": ["repositoryId", "nodeId"],
            "properties": {
                "repositoryId": {"type": "string"},
                "nodeId": {"type": "string"},
            },
        },
    },
    {
        "name": "helix_get_node_source",
        "description": "Return a bounded source snippet for a twin node with path and line range.",
        "inputSchema": {
            "type": "object",
            "required": ["repositoryId", "nodeId"],
            "properties": {
                "repositoryId": {"type": "string"},
                "nodeId": {"type": "string"},
            },
        },
    },
    {
        "name": "helix_assess_change",
        "description": "Run the evidence-backed pre-mortem safety gate for a planned code change. Prefer helix_create_safety_review for pre-edit safety review workflows.",
        "inputSchema": {
            "type": "object",
            "required": ["repositoryId", "summary", "targetRefs"],
            "properties": {
                "repositoryId": {"type": "string"},
                "summary": {"type": "string"},
                "targetRefs": {"type": "array", "items": {"type": "string"}},
                "changeType": {"type": "string", "default": "modify"},
            },
        },
    },
    {
        "name": "helix_create_safety_review",
        "description": "Preferred pre-edit tool: create an evidence-backed safety review with risk findings, human-gate status, and blast-radius context before code changes.",
        "inputSchema": {
            "type": "object",
            "required": ["repositoryId", "summary", "targetRefs"],
            "properties": {
                "repositoryId": {"type": "string"},
                "summary": {"type": "string"},
                "targetRefs": {"type": "array", "items": {"type": "string"}},
                "changeType": {"type": "string", "default": "modify"},
                "depth": {"type": "integer", "minimum": 1, "maximum": 4, "default": 2},
                "relationshipTypes": {"type": "array", "items": {"type": "string"}},
            },
        },
    },
    {
        "name": "helix_record_human_decision",
        "description": "Record a human approval, rejection, or needs-changes decision for a HelixFactory safety review as audit evidence.",
        "inputSchema": {
            "type": "object",
            "required": ["safetyReviewId", "decision", "reviewer", "reason"],
            "properties": {
                "safetyReviewId": {"type": "string"},
                "decision": {"type": "string", "enum": ["approved", "rejected", "needs_changes"]},
                "reviewer": {"type": "string"},
                "reason": {"type": "string"},
                "rationale": {"type": "string"},
                "repositoryId": {"type": "string"},
                "auditRecordId": {"type": "string"},
            },
        },
    },
    {
        "name": "helix_blast_radius",
        "description": "Return a capped impact graph for a planned change, suitable for agent review before editing.",
        "inputSchema": {
            "type": "object",
            "required": ["repositoryId", "summary", "targetRefs"],
            "properties": {
                "repositoryId": {"type": "string"},
                "summary": {"type": "string"},
                "targetRefs": {"type": "array", "items": {"type": "string"}},
                "changeType": {"type": "string", "default": "modify"},
                "depth": {"type": "integer", "minimum": 1, "maximum": 4, "default": 2},
                "relationshipTypes": {"type": "array", "items": {"type": "string"}},
            },
        },
    },
    {
        "name": "helix_should_agent_continue",
        "description": "Return a simple allow/block decision for an AI agent based on pre-mortem risk and evidence completeness.",
        "inputSchema": {
            "type": "object",
            "required": ["repositoryId", "summary", "targetRefs"],
            "properties": {
                "repositoryId": {"type": "string"},
                "summary": {"type": "string"},
                "targetRefs": {"type": "array", "items": {"type": "string"}},
                "changeType": {"type": "string", "default": "modify"},
            },
        },
    },
    {
        "name": "helix_create_audit_package",
        "description": "Return the chronological audit evidence package for a repository or change review.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "repositoryId": {"type": "string"},
            },
        },
    },
]


PROMPTS: list[dict[str, Any]] = [
    {
        "name": "pre_mortem_before_edit",
        "description": "Guide an AI coding agent to assess change safety before editing code.",
        "arguments": [
            {"name": "repositoryId", "description": "HelixFactory repository id", "required": True},
            {"name": "summary", "description": "Planned change summary", "required": True},
        ],
    },
    {
        "name": "safe_code_change_review",
        "description": "Prepare a reviewer-facing safety summary with twin evidence, impact, and audit requirements.",
        "arguments": [
            {"name": "repositoryId", "description": "HelixFactory repository id", "required": True},
            {"name": "summary", "description": "Planned change summary", "required": True},
        ],
    },
]


@router.get("/mcp")
def mcp_capabilities() -> dict[str, Any]:
    return {
        "name": "helixfactory",
        "description": "MCP-compatible AI change safety interface over the HelixFactory code twin.",
        "transport": "http-json-rpc",
        "endpoint": "/mcp",
        "tools": [tool["name"] for tool in TOOLS],
        "resources": ["helix://repositories/{repositoryId}/overview", "helix://nodes/{repositoryId}/{nodeId}/context", "helix://nodes/{repositoryId}/{nodeId}/source"],
        "prompts": [prompt["name"] for prompt in PROMPTS],
    }


@router.post("/mcp")
def mcp_rpc(request: MCPRequest) -> dict[str, Any] | None:
    try:
        result = _dispatch(request.method, request.params)
        if request.id is None:
            return None
        return {"jsonrpc": "2.0", "id": request.id, "result": result}
    except HelixFactoryError as exc:
        logger.warning("MCP domain error for %s: %s", request.method, exc, exc_info=True)
        if request.id is None:
            return None
        return _error(request.id, -32000, str(exc), {"code": exc.code, "details": exc.details})
    except Exception as exc:
        logger.exception("MCP internal error for %s", request.method)
        if request.id is None:
            return None
        return _error(request.id, -32603, "HelixFactory MCP hit an unexpected error.", {"type": exc.__class__.__name__})


def _dispatch(method: str, params: dict[str, Any]) -> dict[str, Any]:
    if method == "initialize":
        return {
            "protocolVersion": "2025-06-18",
            "serverInfo": {"name": "helixfactory", "version": "0.1.0"},
            "capabilities": {"tools": {}, "resources": {}, "prompts": {}},
        }
    if method == "tools/list":
        return {"tools": TOOLS}
    if method == "tools/call":
        name = _require(params, "name")
        arguments = params.get("arguments") or {}
        return _call_tool(str(name), arguments)
    if method == "resources/list":
        return {
            "resources": [
                {
                    "uri": f"helix://repositories/{repo_id}/overview",
                    "name": f"{repo.url} overview",
                    "description": "Architecture overview from the current code twin.",
                    "mimeType": "application/json",
                }
                for repo_id, repo in runtime.repositories.items()
            ]
        }
    if method == "resources/read":
        return _read_resource(str(_require(params, "uri")))
    if method == "prompts/list":
        return {"prompts": PROMPTS}
    if method == "prompts/get":
        return _get_prompt(str(_require(params, "name")), params.get("arguments") or {})
    raise NotFoundError("MCP method is not supported.", {"method": method})


def _call_tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    if name == "helix_ask_twin":
        result = graph_service.ask(GraphAskRequest(repositoryId=_require(arguments, "repositoryId"), question=_require(arguments, "question")))
    elif name == "helix_get_node_context":
        result = graph_service.node_context(NodeContextRequest(repositoryId=_require(arguments, "repositoryId"), nodeId=_require(arguments, "nodeId")))
    elif name == "helix_get_node_source":
        result = graph_service.node_source(NodeSourceRequest(repositoryId=_require(arguments, "repositoryId"), nodeId=_require(arguments, "nodeId")))
    elif name == "helix_assess_change":
        result = premortem_service.run(_premortem_request(arguments))
    elif name == "helix_create_safety_review":
        result = _create_safety_review(arguments)
    elif name == "helix_record_human_decision":
        result = _record_human_decision(arguments)
    elif name == "helix_blast_radius":
        result = blast_radius_service.calculate(_blast_request(arguments))
    elif name == "helix_should_agent_continue":
        assessment = premortem_service.run(_premortem_request(arguments))
        blocked = bool(assessment.requires_human_approval or assessment.risk_status in {"critical", "high", "blocked_insufficient_evidence"})
        result = {
            "decision": "block" if blocked else "allow",
            "reason": _agent_decision_reason(assessment),
            "riskStatus": assessment.risk_status,
            "requiresHumanApproval": assessment.requires_human_approval,
            "auditRecordId": assessment.audit_record_id,
            "findings": assessment.findings,
            "evidenceGaps": assessment.evidence_gaps,
        }
    elif name == "helix_create_audit_package":
        result = evidence_builder.build(EvidencePackageRequest(repositoryId=arguments.get("repositoryId")))
    else:
        raise NotFoundError("MCP tool is not supported.", {"tool": name})
    return _tool_result(_dump(result))


def _read_resource(uri: str) -> dict[str, Any]:
    parts = uri.removeprefix("helix://").split("/")
    if len(parts) == 3 and parts[0] == "repositories" and parts[2] == "overview":
        payload = graph_service.overview(parts[1])
    elif len(parts) == 4 and parts[0] == "nodes" and parts[3] == "context":
        payload = graph_service.node_context(NodeContextRequest(repositoryId=parts[1], nodeId=parts[2]))
    elif len(parts) == 4 and parts[0] == "nodes" and parts[3] == "source":
        payload = graph_service.node_source(NodeSourceRequest(repositoryId=parts[1], nodeId=parts[2]))
    else:
        raise NotFoundError("MCP resource is not supported.", {"uri": uri})
    return {"contents": [{"uri": uri, "mimeType": "application/json", "text": _json_text(_dump(payload))}]}


def _get_prompt(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    repository_id = arguments.get("repositoryId", "<repositoryId>")
    summary = arguments.get("summary", "<planned change>")
    if name == "pre_mortem_before_edit":
        text = (
            f"Before editing code in repository {repository_id}, assess this planned change: {summary}. "
            "Call helix_create_safety_review first; it is the preferred pre-edit safety tool because it combines "
            "the evidence-backed pre-mortem, human-gate status, and blast-radius context. If the review is HIGH, "
            "CRITICAL, blocked_insufficient_evidence, or requiresHumanApproval is true, stop and ask for human "
            "approval. Record the reviewer outcome with helix_record_human_decision before continuing."
        )
    elif name == "safe_code_change_review":
        text = (
            f"Prepare a reviewer-ready safety report for repository {repository_id}: {summary}. "
            "Use helix_ask_twin, helix_create_safety_review, helix_record_human_decision, and helix_create_audit_package. "
            "Cite file paths, line numbers, dependency chains, gate decision, and uncertainty."
        )
    else:
        raise NotFoundError("MCP prompt is not supported.", {"prompt": name})
    return {"description": name.replace("_", " "), "messages": [{"role": "user", "content": {"type": "text", "text": text}}]}


def _premortem_request(arguments: dict[str, Any]) -> PreMortemRequest:
    return PreMortemRequest(
        repositoryId=_require(arguments, "repositoryId"),
        summary=_require(arguments, "summary"),
        changeType=arguments.get("changeType", "modify"),
        targetRefs=_require_list(arguments, "targetRefs"),
    )


def _safety_review_request(arguments: dict[str, Any]) -> SafetyReviewRequest:
    return SafetyReviewRequest(
        repositoryId=_require(arguments, "repositoryId"),
        summary=_require(arguments, "summary"),
        targetRefs=_require_list(arguments, "targetRefs"),
        scenarioId=arguments.get("scenarioId"),
        changeType=arguments.get("changeType", "modify"),
        depth=arguments.get("depth", 2),
        relationshipTypes=arguments.get("relationshipTypes", []),
    )


def _blast_request(arguments: dict[str, Any]) -> BlastRadiusRequest:
    return BlastRadiusRequest(
        repositoryId=_require(arguments, "repositoryId"),
        summary=_require(arguments, "summary"),
        changeType=arguments.get("changeType", "modify"),
        targetRefs=_require_list(arguments, "targetRefs"),
        depth=arguments.get("depth", 2),
        relationshipTypes=arguments.get("relationshipTypes", []),
    )


def _create_safety_review(arguments: dict[str, Any]) -> dict[str, Any]:
    return _dump(safety_review_service.create(_safety_review_request(arguments)))


def _record_human_decision(arguments: dict[str, Any]) -> dict[str, Any]:
    review_id = str(_require_any(arguments, "safetyReviewId", "reviewId", "changeId"))
    decision = str(_require(arguments, "decision"))
    normalized = decision.lower().replace("-", "_").replace(" ", "_")
    request = SafetyReviewDecisionRequest(
        reviewer=_require(arguments, "reviewer"),
        reason=_require_any(arguments, "reason", "rationale"),
    )
    if normalized == "approved":
        return _dump(safety_review_service.approve(review_id, request))
    if normalized in {"rejected", "needs_changes"}:
        return _dump(safety_review_service.reject(review_id, request))
    raise NotFoundError("MCP human decision is not supported.", {"decision": decision})


def _agent_decision_reason(assessment: Any) -> str:
    if assessment.evidence_gaps:
        return f"Evidence is incomplete: {assessment.evidence_gaps[0]}"
    if assessment.findings:
        finding = assessment.findings[0]
        return f"{finding.get('severity', assessment.risk_status).upper()} risk: {finding.get('title', 'risk finding')} at {finding.get('filePath', 'unknown file')}:{finding.get('line', 'unknown line')}"
    return "No evidence-backed blocking finding was returned. Standard review still applies."


def _tool_result(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "content": [{"type": "text", "text": _json_text(payload)}],
        "structuredContent": payload,
        "isError": False,
    }


def _dump(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        dumped = value.model_dump(mode="json", by_alias=True)
        return dumped if isinstance(dumped, dict) else {"value": dumped}
    if isinstance(value, dict):
        return value
    return {"value": value}


def _json_text(payload: dict[str, Any]) -> str:
    import json

    return json.dumps(payload, indent=2, sort_keys=True)


def _require(arguments: dict[str, Any], key: str) -> Any:
    value = arguments.get(key)
    if value is None or value == "":
        raise NotFoundError("MCP tool argument is required.", {"argument": key})
    return value


def _require_any(arguments: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = arguments.get(key)
        if value is not None and value != "":
            return value
    raise NotFoundError("MCP tool argument is required.", {"argument": keys[0]})


def _require_list(arguments: dict[str, Any], key: str) -> list[str]:
    value = _require(arguments, key)
    if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
        raise NotFoundError("MCP tool argument must be a non-empty string list.", {"argument": key})
    return value


def _error(request_id: str | int, code: int, message: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message, "data": data or {}}}
