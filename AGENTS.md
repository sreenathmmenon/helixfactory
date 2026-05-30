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

Locked product promise:

> HelixFactory lets enterprises ship with AI speed and human-grade control.
> Every AI-assisted change is checked against a living code twin, scored for
> risk, mapped for blast radius, gated by policy, and recorded as audit evidence
> before it moves forward.

Do not change the product headline/subheading or positioning unless the user
explicitly asks to revisit positioning. Feature discussions, demo repository
selection, and UX work should support this promise rather than inventing a new
headline.

Target users:

- Engineering leaders evaluating AI-assisted delivery risk.
- Platform and DevEx teams building internal AI SDLC controls.
- Staff/principal engineers onboarding teams to complex codebases.
- Security, compliance, and audit stakeholders who need evidence.
- Developers who need fast answers about architecture and change impact.

Primary product workflow:

1. AI agent or developer proposes a change.
2. HelixFactory reads the living twin.
3. It finds exact affected code.
4. It predicts failure modes.
5. It maps blast radius.
6. It blocks or allows based on policy.
7. HIGH and CRITICAL risk require human approval.
8. It records audit evidence.
9. Reviewer outcomes become learning signals.
10. The same safety decision is exposed through UI, MCP, and future CI/PR gates.

The current UI should treat `Assess Change` as the main product path. Twin,
pre-mortem, impact, Q&A, MCP, and audit are supporting capabilities for that
workflow, not competing product stories.

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
    services/     runtime, registry, context, safety review, execution orchestration
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
- Unified safety review service combining pre-mortem, blast radius, policy
  decision, approval state, and audit record.

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

Optional AI provider configuration may live outside the repo, for example
`/Users/sreenath/.helix/.env`. Do not commit API keys or copy secrets into the
repository.

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
curl -s http://127.0.0.1:8000/mcp
curl -s http://127.0.0.1:8000/ai/status
```

Full workflow smoke checks should exercise real behavior, not only page
rendering:

```bash
curl -s -X POST http://127.0.0.1:8000/repositories/ingest \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://github.com/pallets/flask"}'

curl -s -X POST http://127.0.0.1:8000/safety-reviews \
  -H 'Content-Type: application/json' \
  -d '{"repositoryId":"<repo-id>","summary":"Modify Flask session and cookie handling for authentication safety","targetRefs":["sessions.py","app.py","cookie"],"changeType":"interface","scenarioId":"flask-session-cookie-safety","depth":2,"relationshipTypes":[]}'

curl -s -X POST http://127.0.0.1:8000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"review","method":"tools/call","params":{"name":"helix_create_safety_review","arguments":{"repositoryId":"<repo-id>","summary":"Modify Flask session and cookie handling for authentication safety","targetRefs":["sessions.py","app.py","cookie"],"changeType":"interface","depth":2}}}'
```

For the Flask safety scenario, a healthy demo should return a HIGH risk,
`decision.status` of `block`, exact file/line evidence, `requiresHumanApproval:
true`, and an audit id.

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
- Safety review is the preferred user-facing risk workflow. Keep
  `/safety-reviews` and MCP `helix_create_safety_review` aligned so UI and
  agents receive the same decision model.
- Approval and rejection actions must write audit records and return audit ids.
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
- Keep `Assess Change` as a guided workflow, not a generic form. It should show
  the safety loop, decision, PR/CI gate implication, MCP output, twin context,
  evidence, required checks, approval, and audit id.
- Twin should support the safety workflow. It should help users understand
  affected code and impact, not compete with Assess Change as a separate
  product story.
- Audit should read as an evidence package: chronological, readable,
  manager/reviewer/auditor friendly, and free of raw internal JSON.

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

MCP interface:

- MCP is a product feature, not only an implementation detail. It lets AI
  coding agents ask HelixFactory whether a change should continue before
  editing code.
- Keep the following tools discoverable and tested:
  - `helix_ask_twin`
  - `helix_get_node_context`
  - `helix_get_node_source`
  - `helix_assess_change`
  - `helix_create_safety_review`
  - `helix_record_human_decision`
  - `helix_blast_radius`
  - `helix_should_agent_continue`
  - `helix_create_audit_package`
- MCP outputs should include structured content with decision, risk status,
  evidence, blast radius where relevant, human gate status, and audit ids.
- Avoid MCP-only logic drift. If a safety decision changes in REST, update MCP
  and tests in the same change.

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
- `GET /repositories` is not currently a list endpoint. Use
  `/repositories/{repository_id}` for a known repository and
  `/repositories/ingest` to create/update a repository twin.
- The current reliable demo repository is `https://github.com/pallets/flask`
  with the session/cookie safety scenario. Starlette/Django/LangChain/LiteLLM
  may be useful later, but validate ingestion, evidence quality, and graph
  readability before using them for demos.

## Quality Bar

For any meaningful change, finish with:

- What changed.
- What was validated.
- What could not be validated, if anything.
- Any known follow-up risk.

Do not call work complete just because code was edited. It is complete only
after the relevant behavior is validated or a blocker is clearly stated.
