# Implementation Plan: HelixFactory Platform

**Branch**: `001-helixfactory-platform` | **Date**: 2026-05-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-helixfactory-platform/spec.md`

## Summary

Build the week-one HelixFactory slice that proves the platform thesis end to
end: ingest a real public repository into a living code digital twin, query it,
run evidence-backed change pre-mortems, visualize contextual blast radius, and
answer architecture questions. The implementation uses the constitution's fixed
stack: a Python/FastAPI backend, tree-sitter-based ingestion, NetworkX graph
storage for hackathon scope with a Neo4j-compatible graph model, GitPython for
structured audit commits, and a React/React Flow/Tailwind frontend. Broader
platform capabilities are modeled in the data contracts so future phases can
extend the same foundation without redesign.

## Technical Context

**Language/Version**: Python 3.11+ for backend; TypeScript 5.x for frontend

**Primary Dependencies**: FastAPI, Pydantic, tree-sitter, GitPython, NetworkX,
React, React Flow, Tailwind, OpenAI Codex API integration boundary

**Storage**: NetworkX graph persisted to local JSON files for hackathon scope;
structured git commits for audit trail; graph model kept compatible with Neo4j
node/relationship migration

**Testing**: pytest for backend unit and integration tests; frontend component
and workflow tests through the existing frontend test runner once scaffolded;
quickstart validation against a real public GitHub repository

**Target Platform**: Local developer machine for demo; Railway deployment path
for hosted backend/frontend once implementation is ready

**Project Type**: Web application with backend API, graph ingestion service,
agent-governance service boundary, and frontend graph experience

**Performance Goals**: Demo-ready flow completes in under 3 minutes; graph query
and blast radius responses complete in under 10 seconds for demo-sized public
repositories; pre-mortem returns evidence-backed findings in under 10 seconds
for a proposed change on an ingested repository

**Constraints**: Twin ingestion scope is Python, TypeScript, and JavaScript only;
graph UX must remain contextual and depth-controlled; HIGH and CRITICAL findings
must block auto-merge; every platform action must create a structured git audit
record; failed components must report partial state and never false all-clear

**Scale/Scope**: Week-one implementation targets one public repository per demo
run, with enough nodes and edges to prove files, symbols, dependencies, owners,
pre-mortem evidence, blast radius, and architecture Q&A. Full enterprise
multi-repo execution, security dashboard, architecture time machine, reviewer
fleet, and self-improvement loop remain modeled but post-hackathon.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Spec Before Code**: PASS. The reviewed feature spec exists at
  `specs/001-helixfactory-platform/spec.md` and includes a Decision Log.
- **Twin First**: PASS. The plan begins with repository ingestion and twin query
  primitives before pre-mortem, blast radius, agent, or Q&A flows.
- **Evidence Over Heuristics**: PASS. Pre-mortem contracts require file, line,
  dependency-chain, consequence, owner context, and preventive check. Findings
  without evidence are suppressed or reported as insufficient evidence.
- **Git Audit Trail**: PASS. Ingestion, pre-mortem, blast radius, Q&A, security
  placeholder checks, approvals, and agent boundary actions are represented as
  structured git-native audit records.
- **Human Gates**: PASS. HIGH and CRITICAL pre-mortem findings block automatic
  merge and require human approval.
- **Contextual Graph UX**: PASS. The React Flow contract is centered on query,
  selected node, or proposed change with recenter, hover illumination, filters,
  and depth control. Full-universe display is prohibited.
- **Codebase-Specific Intelligence**: PASS. Reflection and skill refinement are
  modeled only as codebase-specific future capabilities; generic refinements are
  rejected.
- **Language Scope**: PASS. Ingestion is limited to Python, TypeScript, and
  JavaScript.
- **Graceful Degradation**: PASS. Partial twin, failed pre-mortem, graph-render
  failure, unavailable memory source, and audit failure paths are documented in
  data model and quickstart validation.
- **Demo Readiness**: PASS. The quickstart validates a real public repository
  flow in under 3 minutes from a standing start.
- **Working Directory Rule**: PASS. Future backend commands run from `backend/`;
  future frontend commands run from `frontend/`; planning commands run from the
  repository root as required by Speckit.
- **Command Timeout Rule**: PASS. Commands longer than 2 minutes must be killed
  and reported as failed during implementation and validation.

**Post-Design Recheck**: PASS. `research.md`, `data-model.md`, `contracts/`, and
`quickstart.md` preserve all gates above with no justified violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-helixfactory-platform/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.openapi.yaml
│   └── audit-record.schema.json
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   └── schemas/
│   ├── audit/
│   ├── graph/
│   ├── ingestion/
│   ├── premortem/
│   ├── qa/
│   └── services/
└── tests/
    ├── contract/
    ├── integration/
    └── unit/

frontend/
├── src/
│   ├── components/
│   ├── graph/
│   ├── pages/
│   ├── services/
│   └── state/
└── tests/
    ├── component/
    └── e2e/
```

**Structure Decision**: Use the constitution's web application shape. Backend
owns ingestion, graph traversal, pre-mortem, audit, and Q&A orchestration.
Frontend owns the contextual graph and user workflows. Contract tests live under
`backend/tests/contract/` against `contracts/api.openapi.yaml`.

## Complexity Tracking

No constitution violations are introduced. Complexity is inherent to the
platform vision, but week-one implementation is constrained to one demo-ready
slice and uses NetworkX instead of standing up Neo4j.
