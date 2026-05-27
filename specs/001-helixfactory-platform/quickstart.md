# Quickstart: HelixFactory Platform

This quickstart validates the week-one demo path against a real public
repository. It is written as an implementation target for `/speckit-tasks`;
commands are intentionally scoped by directory according to the constitution.

## Prerequisites

- Backend dependencies installed from `backend/`
- Frontend dependencies installed from `frontend/`
- A real public GitHub repository URL with Python, TypeScript, or JavaScript
  source files
- Git configured for the audit repository

## Demo Flow

1. Start the backend from `backend/`.

   Expected result: the backend is reachable and reports healthy service state.

2. Start the frontend from `frontend/`.

   Expected result: the main HelixFactory UI opens with repository ingestion as
   the primary workflow.

3. Ingest a real public repository.

   Expected result: ingestion status moves from `pending` to `in_progress` to
   `complete` or `partial`. A partial result must show the failed files or
   unsupported languages. The twin must contain code nodes and typed edges.

4. Open the contextual twin graph.

   Expected result: the graph is centered on the repository, query, or selected
   node. It must not show the full universe. The user can control depth, filter
   relationship types, hover to illuminate relationships, and click to recenter.

5. Run a proposed change pre-mortem.

   Example change: rename or modify a function, remove an exported symbol, or
   change a configuration value in the ingested repository.

   Expected result: surfaced findings include severity, file, line, dependency
   chain, consequence, owner context when known, and preventive check. Findings
   without evidence are suppressed or listed as evidence gaps.

6. Open blast radius for the same proposed change.

   Expected result: direct dependencies appear first, transitive dependencies
   follow, and risk levels are visually distinguishable. The graph remains
   contextual and depth-limited.

7. Ask an architecture question.

   Example questions:

   - "What does this module do?"
   - "What would break if this function changed?"
   - "Why does this file depend on this module?"

   Expected result: the answer cites twin nodes, files, lines, or other known
   sources and identifies uncertainty when evidence is incomplete.

8. Inspect audit evidence.

   Expected result: ingestion, pre-mortem, blast radius, and Q&A actions produce
   structured git-native audit records. Failed or partial actions include an
   explanation and never report false all-clear.

## Constitution Validation

- Demo completes in under 3 minutes from a standing start.
- At least one real public repository is used.
- At least one graceful failure path is demonstrated or documented.
- HIGH and CRITICAL findings require human approval before merge.
- Backend commands are run from `backend/`.
- Frontend commands are run from `frontend/`.
- Any command exceeding 2 minutes is killed and reported as failed.

## Evidence To Capture

- Repository URL and ingestion status
- Node and edge counts
- Screenshot or recorded state of contextual graph
- Pre-mortem finding with file, line, and dependency chain
- Blast radius graph centered on the proposed change
- Architecture Q&A answer with citations
- Git audit record references

## Current Validation Notes

- Selected public repository for the default UI input:
  `https://github.com/tiangolo/fastapi`
- Backend validation command: from `backend/`, run `pytest`
- Backend validation evidence on 2026-05-26: `22 passed in 0.30s`
- Frontend validation command: from `frontend/`, run `npm test`
- Frontend validation evidence on 2026-05-26: `npm install` completed,
  `npm test` passed with `1 passed`, and `npm run build` completed in under 2s.
- Unit-test timeout evidence on 2026-05-26: backend and frontend validation
  commands completed below the 2-minute maximum; future unit-test commands that
  exceed 2 minutes should be stopped and reported as failed.
