# Feature Specification: HelixFactory Platform

**Feature Branch**: `001-helixfactory-platform`

**Created**: 2026-05-26

**Status**: Draft

**Input**: User description: "Build HelixFactory from the full product vision and customer stories: an AI-native software factory that builds a living code digital twin, predicts change failure, visualizes blast radius, governs ticket-to-PR agent execution, reviews pull requests, records all actions in git, scans security risk, reconstructs architecture history, preserves organizational memory, and improves through codebase-specific skill refinements."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trust AI-Assisted Change Before Work Begins (Priority: P1)

As an engineering leader or senior engineer, I want every proposed change to be
checked against a living understanding of the codebase before an agent or
engineer writes code, so that failures are predicted with evidence rather than
discovered in production.

**Why this priority**: Trust is the core product promise. Without the digital
twin and pre-mortem, AI-assisted delivery remains fast but unsafe.

**Independent Test**: Ingest a real multi-service public repository, propose a
change to an important component, and verify that the system produces a
pre-mortem with severity, file, line, dependency chain, owner context, and a
preventive check before code execution begins.

**Acceptance Scenarios**:

1. **Given** a repository has been ingested into the twin, **When** a user
   proposes a change to a function, file, service, schema, data flow, or
   configuration, **Then** the system identifies direct and downstream impacts
   from the twin before implementation starts.
2. **Given** the twin lacks enough evidence for a claimed risk, **When** the
   pre-mortem evaluates the change, **Then** the system omits that claim or
   reports insufficient evidence instead of surfacing a vague warning.
3. **Given** the pre-mortem identifies a HIGH or CRITICAL risk, **When** an
   agent workflow reaches a merge decision, **Then** the system blocks automatic
   merge and requires human approval.

---

### User Story 2 - See Blast Radius Before Review (Priority: P2)

As an engineer preparing a significant change, I want to see the blast radius as
a contextual graph, so that I can understand the cascade of affected services,
data, infrastructure, and owners before opening or approving a pull request.

**Why this priority**: Visual risk makes consequences understandable and helps
engineers act before reviewers have to intervene.

**Independent Test**: Select a proposed database, infrastructure, service, or
interface change and verify that the system shows a centered graph where direct
dependencies appear first, transitive dependencies follow, risk severity is
visible, and the user can recenter, hover, filter, and control depth.

**Acceptance Scenarios**:

1. **Given** a proposed change has known direct and transitive dependencies,
   **When** the user opens blast radius, **Then** the graph ripples outward from
   the changed node and marks affected nodes by risk level.
2. **Given** a user clicks any graph node, **When** the node becomes the focus,
   **Then** the graph recenters around that node and updates visible
   relationships without showing the full universe.
3. **Given** a user filters by relationship type, **When** a filter is applied,
   **Then** only matching relationships remain emphasized while unrelated
   context is reduced.

---

### User Story 3 - Govern Ticket-to-PR Execution (Priority: P3)

As an engineering manager, I want low-risk tickets to move through a governed
ticket-to-PR pipeline with full context, review, testing, and audit evidence, so
that engineers spend less time on mechanical implementation and more time on
judgment-heavy work.

**Why this priority**: Governed execution converts intelligence and risk
analysis into delivery value while keeping human gates for risky changes.

**Independent Test**: Submit a low-risk ticket with enough context, verify that
the system reads relevant memory, runs pre-mortem and blast-radius checks,
executes the work, runs reviewer checks, and opens a pull request with a complete
audit trail.

**Acceptance Scenarios**:

1. **Given** a low-risk ticket is eligible for automation, **When** it enters
   the pipeline, **Then** the system gathers relevant repository, ticket,
   discussion, prior-change, and decision context before execution.
2. **Given** the pre-mortem and security scan pass below the human-gate
   threshold, **When** agent execution completes, **Then** the system opens a
   pull request with reviewer findings, test evidence, and audit records.
3. **Given** a ticket requires changes across multiple repositories, **When**
   the workflow is approved for multi-repo execution, **Then** the system
   coordinates the related changes and preserves traceability across all
   affected repositories.

---

### User Story 4 - Prove Every AI-Assisted Change (Priority: P4)

As a compliance or security stakeholder, I want every AI-assisted action to be
recorded in a durable, reviewable audit trail, so that audits can prove what
happened, why it happened, what risk was known, and who approved it.

**Why this priority**: Enterprises and regulated teams cannot adopt AI-assisted
delivery without evidence that survives tool changes and organizational change.

**Independent Test**: Run an AI-assisted change touching sensitive or regulated
data and verify that the evidence package includes pre-mortem, blast radius,
security scan, execution, reviewer, approval, and merge records.

**Acceptance Scenarios**:

1. **Given** an AI-assisted workflow performs a platform action, **When** the
   action completes, **Then** the system records a structured audit entry that
   can be reviewed later without relying on a proprietary audit database.
2. **Given** an auditor requests all AI-assisted changes touching a sensitive
   data field during a date range, **When** a compliance user generates evidence,
   **Then** the system produces a complete package with actions, approvals, and
   risk checks for that scope.
3. **Given** a change touches regulated data, **When** approval gates are
   evaluated, **Then** the system requires pre-mortem, security scan, and human
   approval before merge.

---

### User Story 5 - Preserve and Reuse Organizational Memory (Priority: P5)

As a new or existing engineer, I want to ask plain English questions across code,
past decisions, tickets, pull requests, discussions, and documents, so that I
can understand why the system works the way it does without relying on a senior
engineer's memory.

**Why this priority**: Institutional memory reduces onboarding time, repeated
mistakes, and dependency on informal knowledge.

**Independent Test**: Ask why a field, service, dependency, or workflow exists
and verify that the answer cites connected evidence from code and historical
knowledge sources.

**Acceptance Scenarios**:

1. **Given** knowledge sources have been ingested, **When** a user asks why a
   system element exists, **Then** the answer summarizes the rationale and cites
   relevant evidence.
2. **Given** a user asks what would break if a system element changed, **When**
   the system answers, **Then** it combines graph impact and historical context.
3. **Given** a source is unavailable or stale, **When** the system answers,
   **Then** it identifies the gap instead of inventing certainty.

---

### User Story 6 - Improve Agents With Codebase-Specific Learning (Priority: P6)

As an engineering team, I want the system to identify recurring codebase-specific
mistakes after agent executions and propose human-reviewable skill refinements,
so that future executions get measurably better at our system.

**Why this priority**: Compounding memory is the long-term differentiator. The
system must learn patterns owned by the team, not rely on generic advice.

**Independent Test**: Mark an agent execution as having caused or narrowly
avoided a recurring issue, then verify that the reflection output proposes a
specific skill refinement with evidence, reasoning, and review workflow.

**Acceptance Scenarios**:

1. **Given** an agent execution outcome is available, **When** the reflection
   process runs, **Then** it identifies only patterns specific to the codebase.
2. **Given** a proposed refinement is generic, **When** it is evaluated, **Then**
   the system rejects it as not codebase-specific.
3. **Given** a refinement is accepted by a human reviewer, **When** future agent
   executions encounter the same pattern, **Then** the system applies that
   learning before writing code.

### Edge Cases

- A repository cannot be cloned, read, or parsed: the system reports the failed
  source, continues with available sources where possible, and marks the twin as
  partial.
- A proposed risk cannot be tied to a file, line, and dependency chain: the
  system does not surface it as a pre-mortem finding.
- A graph query would produce an unreadable full-universe view: the system keeps
  the view centered on a selected node, query, or proposed change and limits
  depth.
- A human gate is required but no eligible approver is available: the system
  pauses the merge path and records the blocked state.
- A source of organizational memory conflicts with another source: the system
  shows the conflict, cites both sources, and avoids treating either as
  authoritative without user confirmation.
- An external issue, discussion, or document source is unavailable: the system
  proceeds with available evidence and identifies the missing context.
- A security finding affects many services through transitive paths: the system
  prioritizes affected services by severity, exposure, and dependency path.
- A historical reconstruction has missing snapshots: the system reports the
  nearest known states and the gap in the timeline.
- An automated execution produces no code changes: the system records the reason
  and does not open an empty pull request unless the outcome itself is useful.
- A generated skill refinement would encode secrets, personal data, or regulated
  content: the system blocks the refinement and requests human review.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST ingest one or more repositories and create a living
  code digital twin containing files, functions, classes, dependencies,
  ownership, rationale, historical state, and data-flow relationships.
- **FR-002**: System MUST represent relationship types distinctly, including
  direct calls, asynchronous events, shared schemas, environment-based
  conditionals, runtime dependency links, data flows, and infrastructure
  relationships.
- **FR-003**: System MUST keep the twin current by updating affected graph areas
  after repository changes rather than requiring full manual re-ingestion.
- **FR-004**: System MUST allow users and governed workflows to query the twin by
  repository, service, file, function, owner, relationship type, risk, and
  historical state.
- **FR-005**: System MUST run a change pre-mortem before agent execution and
  before significant user-submitted changes proceed to review.
- **FR-006**: Every pre-mortem finding MUST include severity, specific file,
  specific line, dependency chain, consequence, owner context when known, and a
  recommended preventive check.
- **FR-007**: System MUST reject or suppress pre-mortem findings that cannot be
  supported by evidence in the twin.
- **FR-008**: System MUST classify CRITICAL, HIGH, MEDIUM, and LOW findings using
  consequence-based definitions that distinguish production failure, costly
  diagnosis, degraded behavior, and informational risk.
- **FR-009**: System MUST prevent automatic merge for any change with unresolved
  HIGH or CRITICAL pre-mortem findings.
- **FR-010**: System MUST calculate direct and transitive blast radius for
  modify, rename, delete, database, interface, infrastructure, and dependency
  changes.
- **FR-011**: System MUST display blast radius as a contextual graph centered on
  a query, selected node, or proposed change, never as an unrestricted
  full-universe graph.
- **FR-012**: Graph users MUST be able to recenter by clicking nodes, illuminate
  relationships by hovering, filter by relationship type, and control traversal
  depth.
- **FR-013**: System MUST visually distinguish risk levels in the graph and show
  impact propagation from direct to transitive dependencies.
- **FR-014**: System MUST support governed ticket-to-PR execution for low-risk
  changes initiated from ticket assignment, user request, or delivery pipeline
  trigger.
- **FR-015**: Before code execution, the governed pipeline MUST gather relevant
  twin context, prior attempts, related discussions, linked pull requests,
  decisions, pre-mortem results, blast radius, and security status.
- **FR-016**: System MUST support coordinated execution for tasks affecting
  multiple repositories while preserving cross-repository traceability.
- **FR-017**: System MUST evaluate pull requests with specialist review
  perspectives covering bugs, security, quality, performance, and pre-mortem
  consistency.
- **FR-018**: Reviewer findings MUST be filtered so that only evidence-backed,
  actionable issues are surfaced to engineers.
- **FR-019**: System MUST allow low-risk pull requests to proceed through
  automated approval only when all configured gates pass.
- **FR-020**: System MUST record every platform action as a durable git-native
  audit record, including ingestion, pre-mortem, blast radius, agent execution,
  security scan, reviewer result, approval, and merge decision.
- **FR-021**: Compliance users MUST be able to generate evidence packages for
  AI-assisted changes filtered by repository, date range, data sensitivity,
  owner, risk level, and approval status.
- **FR-022**: System MUST scan code and ingested repositories for security
  vulnerabilities, policy violations, and compliance risks before merge.
- **FR-023**: Security results MUST identify affected services, dependency paths,
  severity, and prioritized remediation order.
- **FR-024**: System MUST reconstruct historical architecture state for selected
  points in time and compare two selected states.
- **FR-025**: System MUST preserve organizational memory from connected code,
  pull requests, tickets, discussions, commit messages, design documents, and
  decision records.
- **FR-026**: Users MUST be able to ask plain English questions about system
  behavior, ownership, rationale, risk, history, and change impact.
- **FR-027**: Answers from organizational memory MUST cite the underlying
  sources used and identify uncertainty when evidence is incomplete.
- **FR-028**: After agent execution, system MUST support a reflection process
  that proposes only codebase-specific skill refinements with evidence and
  reasoning.
- **FR-029**: Skill refinements MUST require human review before they influence
  future agent execution.
- **FR-030**: System MUST gracefully degrade when ingestion, pre-mortem, graph
  rendering, security scanning, or memory sources fail, and MUST NOT report a
  false all-clear.
- **FR-031**: System MUST provide role-appropriate views for engineers,
  engineering leaders, reviewers, security users, compliance users, and
  administrators.
- **FR-032**: System MUST maintain clear ownership status for graph elements,
  including unknown owner, current owner, last modifier, and inactive or
  disbanded team when known.
- **FR-033**: System MUST expose a demo-ready path that ingests a real public
  repository, shows the twin, runs pre-mortem, displays blast radius, and answers
  an architecture question without manual intervention.

### Key Entities *(include if feature involves data)*

- **Repository**: A source code collection included in the twin, with identity,
  access status, ingestion status, ownership, and historical snapshots.
- **Twin Node**: A file, function, class, service, data field, infrastructure
  object, decision, owner, document, ticket, pull request, or other meaningful
  unit of system knowledge.
- **Twin Edge**: A typed relationship between nodes, such as call, event,
  ownership, data flow, schema sharing, runtime dependency, configuration link,
  historical change, or rationale link.
- **Proposed Change**: A user, ticket, or pipeline-submitted intent to modify,
  rename, delete, add, or review part of a software system.
- **Pre-Mortem Finding**: An evidence-backed prediction of a failure mode,
  including severity, location, dependency chain, consequence, owner, and
  preventive check.
- **Blast Radius View**: A contextual graph centered on a query, node, or change
  that shows direct and transitive impact with risk state and filters.
- **Agent Execution**: A governed workflow run that gathers context, evaluates
  risk, performs work, runs checks, and produces an auditable outcome.
- **Reviewer Finding**: A specialist review result with evidence, category,
  severity, and recommended action.
- **Audit Record**: A durable git-native record of a platform action, actor,
  inputs, outputs, timestamps, approvals, and related artifacts.
- **Security Finding**: A vulnerability, policy violation, or compliance risk
  linked to affected services and dependency paths.
- **Architecture Snapshot**: A reconstructable point-in-time view of system
  structure, dependencies, configuration, ownership, and relevant decisions.
- **Knowledge Source**: A repository, pull request, ticket, discussion, document,
  commit, decision record, or other source contributing organizational memory.
- **Skill Refinement**: A human-reviewable, codebase-specific learning proposal
  derived from agent execution outcomes.
- **Approval Gate**: A rule that blocks or permits progression based on risk,
  security, compliance, reviewer, or human approval state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can ingest a real public repository and view a
  query-centered twin graph within 3 minutes from a standing start.
- **SC-002**: For a proposed change on an ingested repository, 95% of
  pre-mortem findings include file, line, dependency chain, severity, and
  preventive check.
- **SC-003**: The system produces no pre-mortem finding without evidence tied to
  the twin during validation runs.
- **SC-004**: Users can generate and understand a blast radius graph for a
  significant change in under 10 seconds for demo-sized repositories.
- **SC-005**: At least 90% of test users can identify the highest-risk impacted
  service from the blast radius view without reading a written finding first.
- **SC-006**: Low-risk ticket-to-PR workflows complete with pre-mortem, security,
  review, and audit evidence attached in at least 80% of eligible trial tickets.
- **SC-007**: No HIGH or CRITICAL pre-mortem finding is auto-merged during gate
  validation.
- **SC-008**: A compliance user can generate an evidence package for a selected
  date range and repository scope in under 5 minutes.
- **SC-009**: New engineers can answer "why does this exist?" for selected
  services, fields, or workflows using cited organizational memory in under 2
  minutes.
- **SC-010**: Reflection runs produce skill refinement proposals only when they
  cite a recurring, codebase-specific pattern and a concrete execution outcome.
- **SC-011**: At least one graceful failure path is demonstrated for ingestion,
  pre-mortem, graph rendering, security scanning, or memory-source access.
- **SC-012**: A complete demo of twin ingestion, pre-mortem, blast radius, and
  architecture Q&A can be completed in under 3 minutes.

## Assumptions

- The initial users are engineering teams that already use source control,
  tickets, pull requests, and some AI-assisted development workflow.
- The primary value path is trust and governance for AI-assisted software
  delivery, not faster code generation by itself.
- The first release prioritizes a real public repository demo and the week-one
  scope defined in the project constitution: digital twin, contextual graph,
  pre-mortem, blast radius, and architecture Q&A.
- Broader enterprise capabilities such as full ticket automation, reviewer
  fleets, time machine, security dashboard, compliance evidence packages, and
  self-improvement loop are specified as platform requirements but can be
  planned incrementally.
- Human approval is mandatory for high-risk and regulated changes even when all
  automated checks are confident.
- Users accept partial results when the system clearly identifies missing or
  stale evidence and avoids false all-clear states.
- Organizational memory sources may become available incrementally; the system
  must provide value with repository and pull-request evidence first.
- Sensitive or regulated data workflows require stricter gates, explicit
  approval, and complete evidence records.

## Decision Log *(mandatory)*

- **Decision**: Treat HelixFactory as one platform specification with prioritized
  user journeys rather than ten separate feature specs.
  **Rationale**: The product vision describes a connected value chain where
  memory, risk, execution, security, governance, and improvement depend on each
  other.
  **Alternatives considered**: Separate specs per feature; rejected because the
  user requested a comprehensive spec from both documents and cross-feature
  requirements would be duplicated or lost.

- **Decision**: Make the living code digital twin and evidence-backed
  pre-mortem the P1 scenario.
  **Rationale**: The customer stories repeatedly show trust, risk prediction,
  and evidence as the adoption trigger.
  **Alternatives considered**: Start with ticket-to-PR automation; rejected
  because automation without trust and risk gates contradicts the product
  vision and constitution.

- **Decision**: Include the full product vision in requirements while marking
  the constitution's week-one scope as the first release assumption.
  **Rationale**: The spec must be comprehensive but still support pragmatic
  planning for the current project phase.
  **Alternatives considered**: Limit the spec only to week-one scope; rejected
  because it would omit major customer-story outcomes such as audit evidence,
  self-improvement, and governed execution.

- **Decision**: Avoid technology-specific implementation details in the spec.
  **Rationale**: This specification defines user value, business behavior, and
  acceptance criteria; technical choices belong in planning.
  **Alternatives considered**: Embed the known stack choices; rejected because
  the specification template requires stakeholder-facing requirements.

- **Decision**: Do not add clarification markers.
  **Rationale**: The two reference documents and project constitution provide
  enough scope, actors, constraints, and priorities to make reasonable defaults.
  **Alternatives considered**: Ask for enterprise-only versus hackathon-only
  scope; rejected because the spec can express full platform scope with
  incremental planning assumptions.
