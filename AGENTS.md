# AGENTS.md

This file is the repo-level operating guide for AI coding tools working on
HelixFactory. Read it before making plans, changing code, running tests, or
committing work.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/001-helixfactory-platform/plan.md`.
For governing project principles and AI agent rules, read
`.specify/memory/constitution.md` before feature planning or implementation.
<!-- SPECKIT END -->

## Product Context

HelixFactory is an AI-native software delivery platform. Its purpose is to make
AI-assisted software change safe, explainable, governed, and auditable.

The product starts from a living code digital twin. The twin powers architecture
Q&A, graph exploration, pre-mortem risk prediction, blast-radius analysis,
governed execution, audit evidence, and future self-learning.

Core product promise:

> Before AI changes code, HelixFactory makes it understand the system.

Target users:

- Engineering leaders evaluating AI-assisted delivery risk.
- Platform and DevEx teams building internal AI SDLC controls.
- Staff/principal engineers onboarding teams to complex codebases.
- Security, compliance, and audit stakeholders who need evidence.
- Developers who need fast answers about architecture and change impact.

## Non-Negotiable Principles

Follow the live constitution in `.specify/memory/constitution.md`. The most
important rules are:

- Twin first: do not build risk, Q&A, graph, or agent workflows that bypass the
  twin.
- Evidence over heuristics: every risk finding needs file path, line number,
  dependency chain, owner/context where available, and preventive check.
- Git is the audit trail: platform actions should produce structured git-native
  audit records.
- Human gates: HIGH and CRITICAL findings block auto-approval.
- Contextual graph only: never show the full universe by default.
- Graceful degradation: partial failures must be visible and human-readable.
- Demo-ready main: keep the main branch working and presentable.

If the requested work conflicts with the constitution, stop and report:

```text
CONSTITUTION CONFLICT - cannot proceed until resolved. <describe the conflict>.
Please instruct how to proceed.
```

## Current Architecture

Repository layout:

```text
backend/
  src/helixfactory/
    api/          FastAPI app, routes, schemas
    audit/        evidence package and git-native audit support
    graph/        graph query, traversal, blast radius
    ingestion/    repository loading, parsing, twin building
    premortem/    evidence-backed risk engine
    qa/           architecture Q&A and node summaries
    services/     runtime, registry, context, execution orchestration
  tests/
    unit/
    integration/

frontend/
  src/
    graph/        Twin graph visualization
    pages/        product pages and workflows
    services/     API client and frontend types
    components/   shared UI components
  tests/
    component/
    e2e/

specs/001-helixfactory-platform/
  spec.md
  plan.md
  tasks.md
  research.md
  data-model.md
  quickstart.md
  contracts/
```

Backend:

- Python 3.11+ / FastAPI.
- Pydantic request and response schemas.
- NetworkX-backed graph model for hackathon scope.
- tree-sitter parser packages for Python, JavaScript, and TypeScript.
- GitPython for audit records.
- Local repository registry and persisted graph state.

Frontend:

- React 18 + TypeScript + Vite.
- Sigma.js + Graphology for the Twin graph.
- ForceAtlas2 and Louvain/community tooling for graph layout and clustering.
- Vitest for component tests.
- Playwright for e2e tests.

Important note: older planning docs mention React Flow. The current graph
implementation uses Sigma.js + Graphology. Do not switch graph libraries again
without an explicit architecture decision.

## Setup

Backend setup from `backend/`:

```bash
python3 -m venv .venv
./.venv/bin/python -m pip install -e .
PYTHONPATH=src ./.venv/bin/python -m uvicorn helixfactory.api.app:app --host 127.0.0.1 --port 8000
```

Use `./.venv/bin/python`, not a shell alias for `python`. Some local shells may
alias `python` to Homebrew Python and bypass the virtual environment.

Frontend setup from `frontend/`:

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

The frontend expects the backend at `http://127.0.0.1:8000` unless configured
otherwise in the API client/environment.

## Validation Commands

Run commands from the correct directory.

Backend:

```bash
cd backend
PYTHONPATH=src ./.venv/bin/python -m pytest
```

Frontend:

```bash
cd frontend
npm run build
npm test -- --run
npm run test:e2e:existing
```

API smoke checks:

```bash
curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/repositories
```

E2E browser validation may require local browser permissions. If Playwright is
blocked by OS sandbox permissions, report that clearly and still run build,
unit tests, and API checks.

Command timeout rule:

- Unit tests should not run indefinitely.
- If a command exceeds 2 minutes during validation, stop it and report the
  command, elapsed time, and last useful output.

## Implementation Standards

Backend:

- Every endpoint must return structured success and error responses.
- Do not leak stack traces to users.
- Log and surface all failures; avoid silent `except` blocks.
- Ingestion must handle partial failures. One failed file must not stop the
  whole repository.
- Suppress pre-mortem findings that lack twin evidence.
- CRITICAL and HIGH findings must block auto-approval.
- Filter tests, docs, examples, vendored code, build output, and virtualenv
  content from production twin queries.
- Keep API schemas explicit and typed.

Frontend:

- Every page needs loading, error, empty, and partial-failure states.
- Do not display raw JSON in the UI.
- Avoid clutter. This product must feel like an enterprise engineering tool,
  not a demo dashboard.
- No UUIDs in user-facing labels unless the user explicitly asks.
- Buttons and inputs must show immediate visual feedback.
- Error copy must be human-readable.
- Layout must be responsive with no horizontal overflow.
- Text must remain readable on dark backgrounds.

Twin graph:

- Initial display should be calm and intent-first; do not show a full graph by
  default.
- Render contextual subgraphs only: search result, entry point, overview,
  selected node, impact map, or review map.
- No test/vendor/docs nodes should appear in normal graph views.
- Keep node counts capped by mode.
- Selected node, hover neighborhood, dimming, search, and recenter interactions
  must be smooth.
- Every node click should produce useful engineering intelligence: summary,
  path, connections, evidence, risk, and actions where available.

## Git And Branch Safety

- Never run destructive git commands such as `git reset --hard` or
  `git checkout -- <file>` unless the user explicitly asks.
- Do not revert user changes.
- Ignore unrelated dirty files unless they block the task.
- Commit only intentionally selected source and documentation files.
- Do not commit generated test artifacts such as Playwright traces,
  `frontend/test-results/`, or `frontend/.vite/`.
- Before commit, check:

```bash
git status --short
git diff --stat
```

Current canonical branch is `main`. Historical feature work used
`001-helixfactory-platform`.

## File Creation Rules

Respect the constitution's protected files and markdown restrictions.

Do not recreate, overwrite, or delete:

- `.specify/memory/constitution.md`
- protected Spec Kit files under `specs/`
- root reference constitution files, if present

Create Markdown only when it is explicitly required and allowed by the
constitution. For general project briefs or status documents, prefer `.txt`
unless the user explicitly asks for Markdown and the location is allowed.

## Known Local Issues And Lessons

- Backend dependency confusion happened when shell aliases bypassed `.venv`.
  Always use `./.venv/bin/python`.
- CORS/API reachability confusion happened when browser preflight failed or the
  frontend showed a generic API error. Validate with `/health` and actual API
  calls before assuming the backend is down.
- tree-sitter grammar packages are mandatory for production ingestion.
- Sigma.js requires every node to have numeric `x` and `y` coordinates before
  rendering. Layout must run or default coordinates must be assigned before
  creating the Sigma instance.
- Browser tests from Codex may be blocked by macOS sandbox permissions. If so,
  ask the user to run the Playwright command locally or validate through API,
  build, and code-level checks.
- The user cares strongly about production-grade UX. Avoid adding more panels,
  cards, badges, and text unless they improve the workflow.

## Quality Bar

For any meaningful change, finish with:

- What changed.
- What was validated.
- What could not be validated, if anything.
- Any known follow-up risk.

Do not call work complete just because code was edited. It is complete only
after the relevant behavior is validated or a blocker is clearly stated.
