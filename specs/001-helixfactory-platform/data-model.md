# Data Model: HelixFactory Platform

## Repository

**Purpose**: Represents an ingested source repository and its ingestion state.

**Fields**:

- `id`: stable repository identifier
- `url`: source URL
- `default_branch`: branch used for demo ingestion
- `local_path`: temporary or managed clone location
- `ingestion_status`: `pending`, `in_progress`, `partial`, `complete`, `failed`
- `supported_languages`: subset of `python`, `typescript`, `javascript`
- `last_ingested_commit`: commit SHA or equivalent revision identifier
- `owner`: team or person when known
- `created_at`, `updated_at`: audit timestamps
- `failure_reason`: populated when status is `partial` or `failed`

**Relationships**:

- Has many `TwinNode`
- Has many `ArchitectureSnapshot`
- Has many `AuditRecord`

**Validation rules**:

- Repository URL is required.
- `partial` and `failed` states require a `failure_reason`.
- Unsupported languages are recorded as skipped, not parsed.

## TwinNode

**Purpose**: A typed graph node representing code, infrastructure, ownership, or
knowledge.

**Fields**:

- `id`: stable graph identifier
- `repository_id`: source repository
- `type`: `repository`, `file`, `function`, `class`, `service`, `data_field`,
  `config`, `infrastructure`, `owner`, `decision`, `document`, `ticket`,
  `pull_request`, `commit`
- `name`: display name
- `path`: source-relative path when applicable
- `start_line`, `end_line`: source range when applicable
- `language`: source language when applicable
- `owner`: current owner when known
- `last_modified_by`: last modifier when known
- `last_modified_at`: last known modification timestamp
- `provenance`: source evidence reference
- `metadata`: typed properties used by domain-specific nodes

**Relationships**:

- Connected to other nodes through `TwinEdge`
- Included in zero or more `BlastRadiusView` results
- Referenced by `PreMortemFinding`

**Validation rules**:

- Code nodes require `path` and line range.
- Nodes derived from partial evidence must carry provenance and uncertainty.

## TwinEdge

**Purpose**: A typed relationship between graph nodes.

**Fields**:

- `id`: stable edge identifier
- `source_node_id`: source node
- `target_node_id`: target node
- `type`: `calls`, `imports`, `emits_event`, `consumes_event`, `shares_schema`,
  `uses_env`, `runtime_injection`, `data_flows_to`, `owns`, `changed_by`,
  `documents`, `decided_by`, `depends_on`
- `confidence`: `exact`, `inferred`, `partial`
- `evidence_path`: source path or source document reference
- `evidence_line`: source line when available
- `metadata`: relationship-specific properties

**Relationships**:

- Joins two `TwinNode` records
- Used by `PreMortemFinding` evidence chains
- Traversed by `BlastRadiusView`

**Validation rules**:

- Surfaced pre-mortem chains require edges with evidence path and line where
  code evidence exists.
- Inferred edges must not be treated as exact evidence.

## ProposedChange

**Purpose**: Captures a user, ticket, or workflow request to change the system.

**Fields**:

- `id`: stable change identifier
- `source`: `manual`, `ticket`, `pipeline`, `agent`
- `summary`: human-readable change intent
- `change_type`: `add`, `modify`, `rename`, `delete`, `database`, `interface`,
  `infrastructure`, `dependency`
- `target_refs`: paths, symbols, services, or graph node IDs
- `risk_status`: `unknown`, `evaluating`, `low`, `medium`, `high`, `critical`
- `approval_status`: `not_required`, `required`, `approved`, `rejected`,
  `blocked`
- `created_by`, `created_at`

**Relationships**:

- Has many `PreMortemFinding`
- Has zero or more `BlastRadiusView`
- May start an `AgentExecution`
- Has many `AuditRecord`

**Validation rules**:

- Change intent and at least one target reference are required before pre-mortem.
- HIGH and CRITICAL risk require human approval before merge.

## PreMortemFinding

**Purpose**: Evidence-backed prediction of a failure mode.

**Fields**:

- `id`: stable finding identifier
- `proposed_change_id`: associated change
- `severity`: `critical`, `high`, `medium`, `low`
- `title`: concise failure prediction
- `consequence`: expected user, operational, compliance, or security impact
- `file_path`: evidence file
- `line`: evidence line
- `dependency_chain`: ordered `TwinEdge` references
- `owner_context`: current or historical owner information
- `preventive_check`: required test, review, migration, or approval
- `status`: `open`, `suppressed_insufficient_evidence`, `accepted`,
  `resolved`, `false_positive`

**Relationships**:

- Belongs to `ProposedChange`
- References `TwinNode` and `TwinEdge` evidence
- May trigger `ApprovalGate`

**Validation rules**:

- Surfaced findings require file, line, dependency chain, consequence, and
  preventive check.
- Findings without evidence must be suppressed or shown only as evidence gaps.

## BlastRadiusView

**Purpose**: Contextual graph result for a query, node, or proposed change.

**Fields**:

- `id`: stable view identifier
- `center_type`: `query`, `node`, `proposed_change`
- `center_ref`: query text, node ID, or proposed change ID
- `depth`: traversal depth
- `relationship_filters`: included edge types
- `nodes`: visible node IDs with risk state
- `edges`: visible edge IDs
- `risk_summary`: count by severity
- `generated_at`

**Relationships**:

- References `TwinNode`, `TwinEdge`, and optionally `ProposedChange`
- Can create an `AuditRecord`

**Validation rules**:

- View must be centered and depth-limited.
- Full-universe graph display is invalid.

## AgentExecution

**Purpose**: Governed automation run for a ticket, request, or pipeline trigger.

**Fields**:

- `id`: stable execution identifier
- `trigger`: `ticket`, `manual`, `pipeline`
- `proposed_change_id`: associated change
- `status`: `queued`, `collecting_context`, `risk_checking`, `executing`,
  `reviewing`, `blocked`, `completed`, `failed`
- `context_refs`: twin nodes, tickets, discussions, documents, prior attempts
- `test_evidence`: summary of validation performed
- `pull_request_ref`: generated PR reference when applicable
- `failure_reason`: populated when failed or blocked

**Relationships**:

- Belongs to `ProposedChange`
- Has many `ReviewerFinding`
- Has many `AuditRecord`
- May produce `SkillRefinement`

**Validation rules**:

- Execution cannot enter `executing` before pre-mortem and security status are
  known.
- Execution cannot auto-merge unresolved HIGH or CRITICAL risk.

## AuditRecord

**Purpose**: Structured git-native record of every platform action.

**Fields**:

- `id`: stable audit identifier
- `action_type`: `ingestion`, `premortem`, `blast_radius`, `agent_execution`,
  `security_scan`, `review`, `approval`, `merge`, `qa`, `skill_refinement`
- `actor`: user, system, or agent
- `subject_ref`: repository, change, execution, or finding reference
- `input_refs`: related records consumed
- `output_refs`: related records produced
- `summary`: human-readable action summary
- `result`: `success`, `partial`, `blocked`, `failed`
- `timestamp`: action timestamp
- `git_commit`: commit recording the audit event

**Relationships**:

- References the platform record it audits
- Can be included in compliance evidence packages

**Validation rules**:

- Every platform action must produce an audit record.
- `partial`, `blocked`, and `failed` results require explanatory details.

## SecurityFinding

**Purpose**: Vulnerability, policy, or compliance issue discovered before merge.

**Fields**:

- `id`: stable finding identifier
- `severity`: `critical`, `high`, `medium`, `low`
- `category`: vulnerability, policy, compliance, secret, dependency
- `affected_services`: services or nodes affected
- `dependency_paths`: graph paths that expose the risk
- `remediation_order`: prioritized fix order
- `status`: `open`, `accepted`, `resolved`, `suppressed`

**Relationships**:

- Associated with `Repository`, `ProposedChange`, or `AgentExecution`
- May trigger `ApprovalGate`

**Validation rules**:

- Findings require affected scope and remediation guidance.

## ArchitectureSnapshot

**Purpose**: Point-in-time system state for history and comparison.

**Fields**:

- `id`: stable snapshot identifier
- `repository_id`: repository scope
- `revision`: commit or release reference
- `captured_at`: snapshot time
- `node_refs`: included nodes
- `edge_refs`: included edges
- `known_gaps`: missing or partial evidence

**Relationships**:

- Belongs to `Repository`
- References `TwinNode` and `TwinEdge`
- Can be compared with another snapshot

**Validation rules**:

- Missing snapshot ranges must be explicit.

## KnowledgeSource

**Purpose**: Source of organizational memory used for cited answers.

**Fields**:

- `id`: stable source identifier
- `source_type`: `repository`, `pull_request`, `ticket`, `discussion`,
  `document`, `commit`, `decision_record`
- `external_ref`: URL, path, or provider-specific reference
- `title`: display title
- `status`: `available`, `unavailable`, `stale`, `partial`
- `ingested_at`: ingestion timestamp
- `provenance`: source metadata

**Relationships**:

- Produces `TwinNode` and `TwinEdge` records
- Cited by architecture Q&A answers

**Validation rules**:

- Answers must identify unavailable, stale, or partial source status.

## SkillRefinement

**Purpose**: Human-reviewable, codebase-specific learning proposal.

**Fields**:

- `id`: stable refinement identifier
- `agent_execution_id`: execution that produced the learning
- `pattern_summary`: codebase-specific pattern
- `evidence_refs`: executions, findings, files, or incidents supporting it
- `proposal_text`: human-readable refinement
- `status`: `proposed`, `approved`, `rejected`, `merged`
- `reviewer`: human reviewer when known

**Relationships**:

- Produced by `AgentExecution`
- Creates `AuditRecord`

**Validation rules**:

- Generic refinements are invalid.
- Approved refinements require human review.

## ApprovalGate

**Purpose**: Rule-backed decision point for risky or regulated changes.

**Fields**:

- `id`: stable gate identifier
- `gate_type`: `risk`, `security`, `compliance`, `review`, `human_approval`
- `subject_ref`: proposed change, finding, execution, or pull request
- `required`: boolean
- `status`: `pending`, `passed`, `blocked`, `approved`, `rejected`
- `reason`: why the gate exists or blocked
- `approved_by`: human approver when applicable
- `decided_at`: decision timestamp

**Relationships**:

- References `PreMortemFinding`, `SecurityFinding`, `AgentExecution`, or
  `ProposedChange`
- Creates `AuditRecord`

**Validation rules**:

- HIGH and CRITICAL pre-mortem findings require a human approval gate.
- Regulated-data changes require pre-mortem, security scan, and human approval.

## State Transitions

### Repository Ingestion

`pending -> in_progress -> complete`

`pending -> in_progress -> partial`

`pending -> in_progress -> failed`

Partial and failed states must record a user-visible reason.

### Proposed Change

`unknown -> evaluating -> low|medium|high|critical`

`high|critical -> approval_required -> approved|rejected|blocked`

### Agent Execution

`queued -> collecting_context -> risk_checking -> executing -> reviewing -> completed`

Any state may transition to `blocked` or `failed` with an audit record.

### Skill Refinement

`proposed -> approved -> merged`

`proposed -> rejected`
