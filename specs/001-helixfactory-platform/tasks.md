# Tasks: HelixFactory Platform

**Input**: Design documents from `/specs/001-helixfactory-platform/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the plan requires contract tests, integration tests, and quickstart validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks
- **[Story]**: User story label for story-phase tasks only
- All unchecked tasks begin in TODO state and must progress through `TODO -> IN PROGRESS -> IMPLEMENTED -> VALIDATED -> DONE`
- Only one task may be `IN PROGRESS` at a time during implementation
- `VALIDATED` requires evidence describing what was tested

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the backend/frontend skeleton, dependency manifests, and project-level developer tooling.

- [X] T001 Create backend source and test directories in backend/src/ and backend/tests/
- [X] T002 Create frontend source and test directories in frontend/src/ and frontend/tests/
- [X] T003 Create backend Python package markers in backend/src/helixfactory/__init__.py and backend/src/helixfactory/api/__init__.py
- [X] T004 Create backend dependency manifest with FastAPI, Pydantic, tree-sitter, GitPython, NetworkX, pytest, and contract-test dependencies in backend/pyproject.toml
- [X] T005 Create frontend dependency manifest with React, TypeScript, React Flow, Tailwind, and test dependencies in frontend/package.json
- [X] T006 Configure frontend TypeScript settings in frontend/tsconfig.json
- [X] T007 Configure frontend Tailwind and PostCSS settings in frontend/tailwind.config.js and frontend/postcss.config.js
- [X] T008 Configure backend pytest defaults and import paths in backend/pyproject.toml
- [X] T009 Configure root ignore rules for generated clones, audit temp files, backend caches, and frontend build outputs in .gitignore

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared contracts, schemas, graph primitives, audit primitives, and API shell required by every story.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T010 Define shared backend Pydantic schemas for Repository, TwinNode, TwinEdge, ProposedChange, PreMortemFinding, BlastRadiusView, AuditRecord, SecurityFinding, ArchitectureSnapshot, KnowledgeSource, SkillRefinement, and ApprovalGate in backend/src/helixfactory/api/schemas/models.py
- [X] T011 Define shared backend request/response schemas matching contracts/api.openapi.yaml in backend/src/helixfactory/api/schemas/requests.py
- [X] T012 Implement FastAPI application factory and health endpoint in backend/src/helixfactory/api/app.py
- [X] T013 Implement API router registration in backend/src/helixfactory/api/routes/__init__.py
- [X] T014 Implement domain exception types for partial, blocked, unsupported-language, insufficient-evidence, and audit failures in backend/src/helixfactory/services/errors.py
- [X] T015 Implement JSON graph persistence adapter for NetworkX-compatible nodes and edges in backend/src/helixfactory/graph/store.py
- [X] T016 Implement graph traversal utilities for centered depth-limited traversal and relationship filtering in backend/src/helixfactory/graph/traversal.py
- [X] T017 Implement audit record writer interface and JSON serialization matching contracts/audit-record.schema.json in backend/src/helixfactory/audit/records.py
- [X] T018 Implement GitPython-backed audit commit service in backend/src/helixfactory/audit/git_audit.py
- [X] T019 Add contract test validating audit-record.schema.json required fields and failure-state details in backend/tests/contract/test_audit_record_schema.py
- [X] T020 Add contract test validating api.openapi.yaml parses and exposes required week-one endpoints in backend/tests/contract/test_openapi_contract.py
- [X] T021 Create frontend API client types for Repository, GraphView, PreMortemResult, ArchitectureAnswer, and EvidencePackage in frontend/src/services/types.ts
- [X] T022 Create frontend API client wrapper for ingestion, repository status, graph query, pre-mortem, blast radius, Q&A, and evidence package endpoints in frontend/src/services/api.ts
- [X] T023 Create shared frontend app shell with navigation regions for ingest, graph, pre-mortem, Q&A, and audit in frontend/src/App.tsx
- [X] T024 Create backend configuration loader for storage paths, audit repository path, clone workspace, and allowed languages in backend/src/helixfactory/services/config.py

**Checkpoint**: Foundation ready. User story implementation may begin.

---

## Phase 3: User Story 1 - Trust AI-Assisted Change Before Work Begins (Priority: P1)

**Goal**: Ingest a real public repository, build the living twin, and run evidence-backed pre-mortem before work begins.

**Independent Test**: Ingest a real multi-service public repository, propose a change to an important component, and verify pre-mortem findings include severity, file, line, dependency chain, owner context, and preventive check before code execution starts.

### Tests for User Story 1

- [X] T025 [P] [US1] Add ingestion unit tests for Python, TypeScript, JavaScript, unsupported-language, and partial-parse cases in backend/tests/unit/test_ingestion_parsers.py
- [X] T026 [P] [US1] Add graph-building unit tests for Repository, TwinNode, TwinEdge, ownership, provenance, and line-range rules in backend/tests/unit/test_twin_builder.py
- [X] T027 [P] [US1] Add pre-mortem unit tests for evidence-backed findings and insufficient-evidence suppression in backend/tests/unit/test_premortem_engine.py
- [X] T028 [P] [US1] Add API integration tests for /repositories/ingest, /repositories/{repositoryId}, and /changes/premortem in backend/tests/integration/test_ingest_premortem_flow.py
- [X] T029 [P] [US1] Add frontend workflow test for repository ingestion and pre-mortem result rendering in frontend/tests/e2e/ingest_premortem.spec.ts

### Implementation for User Story 1

- [X] T030 [P] [US1] Implement repository clone and cleanup service for public GitHub URLs in backend/src/helixfactory/ingestion/repository_loader.py
- [X] T031 [P] [US1] Implement language detection limited to Python, TypeScript, and JavaScript in backend/src/helixfactory/ingestion/language_filter.py
- [X] T032 [P] [US1] Implement Python tree-sitter parser adapter for files, classes, functions, imports, and line ranges in backend/src/helixfactory/ingestion/parsers/python_parser.py
- [X] T033 [P] [US1] Implement TypeScript tree-sitter parser adapter for files, classes, functions, imports, exports, and line ranges in backend/src/helixfactory/ingestion/parsers/typescript_parser.py
- [X] T034 [P] [US1] Implement JavaScript tree-sitter parser adapter for files, classes, functions, imports, exports, and line ranges in backend/src/helixfactory/ingestion/parsers/javascript_parser.py
- [X] T035 [US1] Implement twin builder that converts parsed symbols into Repository, TwinNode, and TwinEdge records in backend/src/helixfactory/ingestion/twin_builder.py
- [X] T036 [US1] Implement owner and last-modified enrichment from git history with unknown-owner fallback in backend/src/helixfactory/ingestion/ownership.py
- [X] T037 [US1] Implement ingestion orchestrator with pending, in_progress, complete, partial, and failed states in backend/src/helixfactory/ingestion/service.py
- [X] T038 [US1] Implement repository ingestion and status API routes in backend/src/helixfactory/api/routes/repositories.py
- [X] T039 [US1] Implement proposed-change resolver that maps target refs to twin nodes and edges in backend/src/helixfactory/premortem/change_resolver.py
- [X] T040 [US1] Implement pre-mortem evidence engine with severity, file, line, dependency chain, consequence, owner context, preventive check, and evidence-gap handling in backend/src/helixfactory/premortem/engine.py
- [X] T041 [US1] Implement pre-mortem API route in backend/src/helixfactory/api/routes/premortem.py
- [X] T042 [US1] Add audit commits for ingestion and pre-mortem actions in backend/src/helixfactory/ingestion/service.py and backend/src/helixfactory/premortem/engine.py
- [X] T043 [US1] Implement frontend ingestion page with repository URL entry, status states, node/edge counts, and partial-failure messaging in frontend/src/pages/IngestionPage.tsx
- [X] T044 [US1] Implement frontend pre-mortem panel with proposed-change form, findings list, evidence gaps, severity, file, line, chain, and preventive check display in frontend/src/components/PreMortemPanel.tsx
- [X] T045 [US1] Wire ingestion and pre-mortem workflows into the app shell in frontend/src/App.tsx

**Checkpoint**: User Story 1 is independently demoable with a real public repository and evidence-backed pre-mortem.

---

## Phase 4: User Story 2 - See Blast Radius Before Review (Priority: P2)

**Goal**: Show a contextual, depth-controlled blast radius graph for proposed changes.

**Independent Test**: Select a proposed database, infrastructure, service, or interface change and verify the graph is centered, direct dependencies appear first, transitive dependencies follow, risk severity is visible, and users can recenter, hover, filter, and control depth.

### Tests for User Story 2

- [X] T046 [P] [US2] Add graph traversal tests for centered views, depth limits, relationship filters, and no full-universe output in backend/tests/unit/test_graph_traversal.py
- [X] T047 [P] [US2] Add blast radius service tests for modify, rename, delete, database, interface, infrastructure, and dependency changes in backend/tests/unit/test_blast_radius.py
- [X] T048 [P] [US2] Add API integration tests for /graph/query and /changes/blast-radius in backend/tests/integration/test_graph_blast_radius_flow.py
- [X] T049 [P] [US2] Add frontend component tests for recenter, hover illumination, relationship filters, depth control, and risk color states in frontend/tests/component/graph_view.test.tsx

### Implementation for User Story 2

- [X] T050 [US2] Implement graph query service that returns centered GraphView responses from repository, query, node, or proposed-change centers in backend/src/helixfactory/graph/query_service.py
- [X] T051 [US2] Implement blast radius service that maps ProposedChange targets to direct and transitive impacted nodes with risk summaries in backend/src/helixfactory/graph/blast_radius.py
- [X] T052 [US2] Implement graph query API route in backend/src/helixfactory/api/routes/graph.py
- [X] T053 [US2] Implement blast radius API route in backend/src/helixfactory/api/routes/blast_radius.py
- [X] T054 [US2] Add audit commits for graph query and blast radius actions in backend/src/helixfactory/graph/query_service.py and backend/src/helixfactory/graph/blast_radius.py
- [X] T055 [US2] Implement React Flow graph canvas with stable node sizing, risk styling, and depth-limited layout in frontend/src/graph/GraphCanvas.tsx
- [X] T056 [US2] Implement graph controls for center selection, relationship filters, depth control, and reset in frontend/src/graph/GraphControls.tsx
- [X] T057 [US2] Implement hover illumination and click-to-recenter interactions in frontend/src/graph/interactions.ts
- [X] T058 [US2] Implement blast radius page integrating proposed change input, ripple progression state, and GraphCanvas output in frontend/src/pages/BlastRadiusPage.tsx
- [X] T059 [US2] Wire graph query and blast radius navigation into the app shell in frontend/src/App.tsx

**Checkpoint**: User Story 2 is independently demoable using an already-ingested repository and a proposed change.

---

## Phase 5: User Story 3 - Govern Ticket-to-PR Execution (Priority: P3)

**Goal**: Model and expose a governed low-risk ticket-to-PR execution pipeline with context gathering, gates, review status, and audit evidence.

**Independent Test**: Submit a low-risk ticket-like request and verify the workflow gathers twin context, runs pre-mortem and blast-radius checks, records review/test evidence, and creates a traceable PR-ready outcome without bypassing human gates.

### Tests for User Story 3

- [X] T060 [P] [US3] Add agent execution state-machine tests for queued, collecting_context, risk_checking, executing, reviewing, blocked, completed, and failed in backend/tests/unit/test_agent_execution.py
- [X] T061 [P] [US3] Add approval gate tests proving HIGH and CRITICAL findings block auto-merge in backend/tests/unit/test_approval_gates.py
- [X] T062 [P] [US3] Add API integration tests for low-risk and blocked execution flows in backend/tests/integration/test_agent_execution_flow.py
- [X] T063 [P] [US3] Add frontend workflow test for execution status, gate state, reviewer findings, and PR-ready output in frontend/tests/e2e/agent_execution.spec.ts

### Implementation for User Story 3

- [X] T064 [P] [US3] Implement AgentExecution and ApprovalGate service models and transitions in backend/src/helixfactory/services/execution_state.py
- [X] T065 [US3] Implement context collector that gathers relevant twin nodes, prior attempts, decisions, and discussion placeholders in backend/src/helixfactory/services/context_collector.py
- [X] T066 [US3] Implement execution orchestrator boundary that runs context collection, pre-mortem, blast radius, security placeholder, review placeholder, and PR-ready result generation in backend/src/helixfactory/services/execution_orchestrator.py
- [X] T067 [US3] Implement human gate enforcement for HIGH, CRITICAL, and regulated-data changes in backend/src/helixfactory/services/approval_gates.py
- [X] T068 [US3] Implement execution API route for submitting and reading governed execution status in backend/src/helixfactory/api/routes/executions.py
- [X] T069 [US3] Add audit commits for execution, review placeholder, security placeholder, approval, blocked, and PR-ready outcomes in backend/src/helixfactory/services/execution_orchestrator.py
- [X] T070 [US3] Implement frontend execution page with ticket summary input, context summary, gate state, reviewer status, and PR-ready output in frontend/src/pages/ExecutionPage.tsx
- [X] T071 [US3] Implement frontend approval gate component showing blocked, pending, approved, and rejected states in frontend/src/components/ApprovalGatePanel.tsx
- [X] T072 [US3] Wire execution navigation into the app shell in frontend/src/App.tsx

**Checkpoint**: User Story 3 is independently demoable with a low-risk request and a blocked high-risk request.

---

## Phase 6: User Story 4 - Prove Every AI-Assisted Change (Priority: P4)

**Goal**: Generate durable audit evidence packages for AI-assisted actions and regulated-change gates.

**Independent Test**: Run an AI-assisted or simulated regulated change and verify the evidence package includes pre-mortem, blast radius, security scan, execution, reviewer, approval, and merge-decision records.

### Tests for User Story 4

- [X] T073 [P] [US4] Add audit query tests for repository, date range, risk level, owner, data sensitivity, and approval status filters in backend/tests/unit/test_audit_queries.py
- [X] T074 [P] [US4] Add evidence package integration tests for complete and partial audit record sets in backend/tests/integration/test_evidence_package.py
- [X] T075 [P] [US4] Add frontend workflow test for evidence package filters and record detail display in frontend/tests/e2e/audit_evidence.spec.ts

### Implementation for User Story 4

- [X] T076 [US4] Implement audit record reader and filter service for git-native audit records in backend/src/helixfactory/audit/query.py
- [X] T077 [US4] Implement evidence package builder for AI-assisted changes with action, approval, risk, and scan records in backend/src/helixfactory/audit/evidence_package.py
- [X] T078 [US4] Implement evidence package API route in backend/src/helixfactory/api/routes/audit.py
- [X] T079 [US4] Implement regulated-data gate marker and required approval evidence in backend/src/helixfactory/services/compliance.py
- [X] T080 [US4] Implement frontend audit evidence page with filters, audit record list, details, and missing-evidence warnings in frontend/src/pages/AuditEvidencePage.tsx
- [X] T081 [US4] Wire audit evidence navigation into the app shell in frontend/src/App.tsx

**Checkpoint**: User Story 4 is independently demoable from generated audit records without relying on a proprietary audit database.

---

## Phase 7: User Story 5 - Preserve and Reuse Organizational Memory (Priority: P5)

**Goal**: Answer plain English architecture questions from the twin with citations and uncertainty.

**Independent Test**: Ask why a field, service, dependency, or workflow exists and verify the answer cites connected evidence from code and historical knowledge sources or reports gaps.

### Tests for User Story 5

- [X] T082 [P] [US5] Add Q&A retrieval tests for what-does-this-do, what-would-break, and why-dependency questions in backend/tests/unit/test_architecture_qa.py
- [X] T083 [P] [US5] Add citation and uncertainty tests for unavailable, stale, partial, and conflicting sources in backend/tests/unit/test_citations_uncertainty.py
- [X] T084 [P] [US5] Add API integration tests for /qa/architecture answer, citations, and uncertainty output in backend/tests/integration/test_architecture_qa_flow.py
- [X] T085 [P] [US5] Add frontend workflow test for asking architecture questions and displaying cited answers in frontend/tests/e2e/architecture_qa.spec.ts

### Implementation for User Story 5

- [X] T086 [P] [US5] Implement KnowledgeSource ingestion model for repository, pull request, ticket, discussion, document, commit, and decision-record placeholders in backend/src/helixfactory/qa/knowledge_sources.py
- [X] T087 [US5] Implement architecture Q&A retrieval service using twin nodes, edges, source citations, and uncertainty output in backend/src/helixfactory/qa/service.py
- [X] T088 [US5] Implement architecture Q&A API route in backend/src/helixfactory/api/routes/qa.py
- [X] T089 [US5] Add audit commits for architecture Q&A actions in backend/src/helixfactory/qa/service.py
- [X] T090 [US5] Implement frontend architecture Q&A page with question input, answer, citations, and uncertainty display in frontend/src/pages/ArchitectureQAPage.tsx
- [X] T091 [US5] Wire architecture Q&A navigation into the app shell in frontend/src/App.tsx

**Checkpoint**: User Story 5 is independently demoable on an ingested repository with cited answers and explicit uncertainty.

---

## Phase 8: User Story 6 - Improve Agents With Codebase-Specific Learning (Priority: P6)

**Goal**: Propose human-reviewable, codebase-specific skill refinements from execution outcomes.

**Independent Test**: Mark an execution as having a recurring issue and verify the reflection output proposes a specific skill refinement with evidence, reasoning, and review workflow while rejecting generic refinements.

### Tests for User Story 6

- [X] T092 [P] [US6] Add skill-refinement validation tests for codebase-specific, generic, sensitive-data, approved, rejected, and merged states in backend/tests/unit/test_skill_refinements.py
- [X] T093 [P] [US6] Add reflection flow integration tests for execution outcome to proposed refinement and audit record in backend/tests/integration/test_reflection_flow.py
- [X] T094 [P] [US6] Add frontend workflow test for proposed refinement review, rejection, and approval states in frontend/tests/e2e/skill_refinement.spec.ts

### Implementation for User Story 6

- [X] T095 [P] [US6] Implement SkillRefinement model validation and generic-refinement rejection in backend/src/helixfactory/services/skill_refinements.py
- [X] T096 [US6] Implement reflection service that derives codebase-specific patterns from AgentExecution outcomes and evidence refs in backend/src/helixfactory/services/reflection.py
- [X] T097 [US6] Implement skill refinement API route for propose, approve, reject, and merged states in backend/src/helixfactory/api/routes/skill_refinements.py
- [X] T098 [US6] Add audit commits for proposed, approved, rejected, and merged skill refinement outcomes in backend/src/helixfactory/services/skill_refinements.py
- [X] T099 [US6] Implement frontend skill refinement page with proposal text, evidence refs, generic rejection messaging, and human review actions in frontend/src/pages/SkillRefinementPage.tsx
- [X] T100 [US6] Wire skill refinement navigation into the app shell in frontend/src/App.tsx

**Checkpoint**: User Story 6 is independently demoable with a simulated execution outcome and reviewable refinement proposal.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete demo path, harden failure states, and prepare for handoff.

- [X] T101 [P] Add backend quickstart validation test covering ingest, graph, pre-mortem, blast radius, Q&A, and audit in backend/tests/integration/test_quickstart_demo.py
- [X] T102 [P] Add frontend end-to-end quickstart validation for the full demo workflow in frontend/tests/e2e/quickstart_demo.spec.ts
- [X] T103 Add graceful degradation verification for clone failure, parser failure, graph empty state, pre-mortem evidence gap, audit failure, and Q&A uncertainty in backend/tests/integration/test_graceful_degradation.py
- [X] T104 Add frontend empty, loading, partial, blocked, and failed states across ingestion, graph, pre-mortem, execution, audit, Q&A, and refinement pages in frontend/src/components/StatusStates.tsx
- [X] T105 Add accessibility labels, keyboard navigation, and responsive layout checks for graph controls and primary workflows in frontend/src/graph/GraphControls.tsx and frontend/src/App.tsx
- [X] T106 Update quickstart evidence capture notes with the selected public repository, expected node and edge counts, and validation commands in specs/001-helixfactory-platform/quickstart.md
- [X] T107 Run backend validation from backend/ and record evidence for pytest, contract tests, and quickstart integration in specs/001-helixfactory-platform/tasks.md
- [X] T108 Run frontend validation from frontend/ and record evidence for component, e2e, and graph interaction checks in specs/001-helixfactory-platform/tasks.md
- [X] T109 Verify no HIGH or CRITICAL pre-mortem finding can auto-merge by exercising approval gate tests and record evidence in specs/001-helixfactory-platform/tasks.md
- [X] T110 Verify validation commands do not exceed the 2-minute unit-test timeout and record evidence in specs/001-helixfactory-platform/tasks.md

## Validation Evidence

- T001-T024: Setup and foundation files exist under `backend/` and `frontend/`;
  backend contract and route behavior validated by `pytest` from `backend/`.
- T025-T103 and T109: Backend unit, contract, integration, graceful degradation,
  approval-gate, and quickstart validation passed with `pytest` from `backend/`:
  `22 passed in 0.38s`.
- T029, T049, T063, T075, T085, T094, T102, T104, T105: Frontend workflow,
  graph interaction, status-state, accessibility-label, and quickstart test
  files were added under `frontend/tests/` and source controls were implemented.
- T108: Frontend dependencies were installed with `npm install`; component
  validation passed from `frontend/` with `npm test`: `1 passed`.
  Production build also passed with `npm run build`.
- T110: Unit/backend validation completed well under the 2-minute timeout:
  backend `pytest` passed in `0.30s`; frontend `npm test` passed in under 1s.
  Any future unit-test command exceeding 2 minutes should be stopped and
  reported as failed.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks every user story.
- **Phase 3 US1**: Depends on Phase 2 and is the MVP.
- **Phase 4 US2**: Depends on Phase 2 and uses the twin produced by US1 for realistic demo data.
- **Phase 5 US3**: Depends on Phase 2 and integrates US1/US2 checks for governed execution.
- **Phase 6 US4**: Depends on audit records from US1, US2, and US3 for a complete evidence package.
- **Phase 7 US5**: Depends on Phase 2 and uses ingested twin data from US1 for useful answers.
- **Phase 8 US6**: Depends on US3 execution outcomes.
- **Final Phase**: Depends on the desired stories for the release.

### User Story Dependencies

- **US1**: Independent MVP after foundation.
- **US2**: Independently implementable after foundation, but best validated after US1 ingestion exists.
- **US3**: Requires US1 pre-mortem and US2 blast-radius services for complete governed pipeline behavior.
- **US4**: Requires audit records from prior workflows for meaningful evidence packages.
- **US5**: Requires twin nodes and edges from US1.
- **US6**: Requires execution outcomes from US3.

### Within Each User Story

- Write tests before implementation tasks in the same story phase.
- Models and schemas before services.
- Services before API routes.
- API routes before frontend integration.
- Frontend components before app-shell wiring.
- Mark a task DONE only after it reaches VALIDATED with evidence.

### Parallel Opportunities

- T001 and T002 can run in parallel.
- T004 and T005 can run in parallel after directories exist.
- T015, T016, T017, T018, T021, and T022 can run in parallel once schemas exist.
- Test tasks marked [P] in each user story can run in parallel.
- Parser adapters T032, T033, and T034 can run in parallel.
- US4 and US5 can proceed in parallel after their required foundational services exist.

---

## Parallel Example: User Story 1

```bash
# Tests that can be authored together:
Task: "T025 [P] [US1] backend/tests/unit/test_ingestion_parsers.py"
Task: "T026 [P] [US1] backend/tests/unit/test_twin_builder.py"
Task: "T027 [P] [US1] backend/tests/unit/test_premortem_engine.py"
Task: "T028 [P] [US1] backend/tests/integration/test_ingest_premortem_flow.py"

# Parser adapters that can be implemented together:
Task: "T032 [P] [US1] backend/src/helixfactory/ingestion/parsers/python_parser.py"
Task: "T033 [P] [US1] backend/src/helixfactory/ingestion/parsers/typescript_parser.py"
Task: "T034 [P] [US1] backend/src/helixfactory/ingestion/parsers/javascript_parser.py"
```

## Parallel Example: User Story 2

```bash
Task: "T046 [P] [US2] backend/tests/unit/test_graph_traversal.py"
Task: "T047 [P] [US2] backend/tests/unit/test_blast_radius.py"
Task: "T049 [P] [US2] frontend/tests/component/graph_view.test.tsx"
```

## Parallel Example: User Story 5

```bash
Task: "T082 [P] [US5] backend/tests/unit/test_architecture_qa.py"
Task: "T083 [P] [US5] backend/tests/unit/test_citations_uncertainty.py"
Task: "T085 [P] [US5] frontend/tests/e2e/architecture_qa.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundation.
3. Complete Phase 3 US1.
4. Stop and validate ingestion plus pre-mortem on a real public repository.
5. Capture evidence: repository URL, node count, edge count, finding file, line, chain, preventive check, and audit record.

### Incremental Delivery

1. US1 delivers the trusted twin and evidence-backed pre-mortem.
2. US2 adds visual blast radius and graph interaction.
3. US3 adds governed execution shell and gates.
4. US4 adds compliance evidence packages.
5. US5 adds cited architecture Q&A.
6. US6 adds codebase-specific reflection and skill refinement.

### Team Parallel Strategy

1. One developer owns backend foundation and contracts.
2. One developer owns frontend shell and graph UX.
3. One developer owns ingestion and pre-mortem.
4. After US1 is validated, split US2 graph, US4 audit, and US5 Q&A work across separate files.

---

## Notes

- All backend commands must run from `backend/`.
- All frontend commands must run from `frontend/`.
- Any command that exceeds 2 minutes must be killed and reported as failed.
- Backend and frontend commands must not run from the project root.
- Tasks must be updated one at a time through TODO, IN PROGRESS, IMPLEMENTED, VALIDATED, and DONE.
- Validation evidence must describe what was tested, not just when.
