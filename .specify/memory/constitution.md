<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles:
- Template principle 1 -> I. Twin First
- Template principle 2 -> II. Evidence Over Heuristics
- Template principle 3 -> III. Git Is the Source of Truth
- Template principle 4 -> IV. Human Gates on High Risk
- Template principle 5 -> V. Contextual Graph, Never Full Universe
Added sections:
- What HelixFactory Is
- Additional Core Principles
- Tech Stack
- Week One Scope
- Definition of Done
- AI Agent Rules
Removed sections:
- Placeholder SECTION_2_NAME and SECTION_3_NAME
Templates requiring updates:
- ✅ .specify/templates/plan-template.md
- ✅ .specify/templates/spec-template.md
- ✅ .specify/templates/tasks-template.md
- ⚠ .specify/templates/commands/*.md not present in this project
- ✅ AGENTS.md
Follow-up TODOs: None
-->

# HelixFactory Constitution

## What HelixFactory Is

HelixFactory is an AI-native software factory: a platform that builds a living
digital twin of any codebase, predicts failure before change begins, simulates
blast radius visually, executes with governed agents, preserves institutional
memory, and improves itself with every task.

## Core Principles

### I. Twin First

No agent writes code without first reading the twin. No pre-mortem runs without
twin data. No blast radius is calculated without traversing the actual graph.
The twin is the foundation. Everything else is built on top of it.

Rationale: predictions, code changes, and risk analysis are only meaningful when
grounded in the current codebase model.

### II. Evidence Over Heuristics

Every pre-mortem finding MUST cite a specific file, a specific line, and a
specific dependency chain. Vague warnings are rejected. If the evidence cannot
be found in the twin, the finding MUST NOT be surfaced.

Rationale: HelixFactory exists to provide defensible engineering intelligence,
not generic warnings.

### III. Git Is the Source of Truth

Every platform action, including ingestion, pre-mortem, blast radius, agent
execution, security scan, and approval, MUST be recorded as a structured git
commit. Proprietary audit databases and black-box logs are not accepted for the
canonical audit trail.

Rationale: Git keeps auditability portable, inspectable, and aligned with
developer workflows.

### IV. Human Gates on High Risk

No agent auto-merges a change flagged CRITICAL or HIGH by the pre-mortem. Human
approval is mandatory and MUST NOT be bypassed regardless of confidence score.

Rationale: high-risk changes require accountable human judgment.

### V. Contextual Graph, Never Full Universe

The knowledge graph MUST NOT be displayed in full. It MUST be centered on a
query, a proposed change, or a selected node. The accepted graph UX is
Obsidian-style: click to recenter, hover to illuminate, and depth-controlled
expansion.

Rationale: full-universe graphs are visually noisy and undermine codebase
understanding.

## Additional Core Principles

### VI. Codebase-Specific Intelligence

The self-improvement loop MUST propose only codebase-specific skill refinements:
patterns unique to this system, not generic best practices. Generic refinements
are rejected.

### VII. Spec Before Code

Every feature MUST start with a written specification that has been reviewed.
No implementation begins without a spec. Vibe coding is not permitted in this
codebase.

### VIII. Language Scope

The twin ingestion pipeline handles Python, TypeScript, and JavaScript only for
the current scope. Java and Go are post-hackathon additions unless this
Constitution is amended.

### IX. Graceful Degradation

If any component fails, including twin ingestion, pre-mortem, or graph
rendering, the system MUST degrade gracefully. A partial twin is better than no
twin. A failed pre-mortem MUST show an error and MUST NOT produce a false
all-clear.

### X. Demo-Ready at All Times

The main branch MUST always be demo-ready. A working subset of features that
works perfectly is preferred over all features working partially. Every merge to
main MUST leave the demo in a better state than before.

## Tech Stack

- Backend: Python and FastAPI
- Graph database: Neo4j, or NetworkX for hackathon scope
- AST parsing: tree-sitter for polyglot parsing
- Agent execution: OpenAI Codex API
- Frontend: React, React Flow for graph rendering, and Tailwind
- Audit trail: Git via GitPython
- Deployment: Railway

These stack choices are fixed decisions. Any feature plan that changes them
MUST document a Constitution conflict and wait for explicit developer approval.

## Week One Scope

Week one scope is limited to these items in priority order:

1. Living Code Digital Twin: ingest any GitHub repo and build the knowledge graph
2. Obsidian-style graph UI: contextual and query-driven, not full universe
3. Change Pre-Mortem: evidence-backed failure prediction with file and line
4. Blast Radius: visual ripple animation on the graph
5. Architecture Q&A: plain English queries against the twin

Everything else is post-hackathon scope unless explicitly approved.

## Definition of Done

A feature is done only when:

- It works on a real public GitHub repo, not a toy demo repo
- The happy path works end-to-end without manual intervention
- At least one failure case is handled gracefully
- It is demo-ready in under 3 minutes from a standing start

## AI Agent Rules

### Rule 1. Constitution Is Read-Only During Feature Implementation

The AI agent MUST NOT amend this Constitution during a feature implementation
conversation, even if context compression has occurred and the agent believes
the Constitution is outdated or inconsistent.

If the agent identifies a conflict between the Constitution and the current
implementation, it MUST stop and flag it to the developer, using this format:

```text
CONSTITUTION CONFLICT — cannot proceed until resolved. <describe the conflict>.
Please instruct how to proceed.
```

The agent MUST then wait for explicit developer instruction before continuing.
It MUST NOT resolve the conflict on its own initiative.

### Rule 2. Task Validation Protocol

Every task MUST follow this exact status progression:

```text
TODO -> IN PROGRESS -> IMPLEMENTED -> VALIDATED -> DONE
```

- IMPLEMENTED means code is written.
- VALIDATED means tested with evidence. Evidence MUST describe what was tested.
- DONE is allowed only after VALIDATED with evidence. Date alone is not evidence.

Only one task may be IN PROGRESS at a time. If two tasks are found IN PROGRESS,
the agent MUST stop and flag the violation before continuing.

### Rule 3. Protected Files

The following files MUST NOT be recreated, overwritten, or deleted by the agent
during feature implementation:

- Any `speckit.specify.md` file under any `specs/` folder
- Any `speckit.plan.md` file under any `specs/` folder
- Any `speckit.tasks.md` file under any `specs/` folder
- `speckit.constitution.md` (project root reference copy)
- `.specify/memory/constitution.md` (the live constitution Codex reads)

If the agent cannot find one of these files when required, it MUST stop and
report the missing file. It MUST NOT create a replacement.

The agent MUST NOT create markdown files outside these allowed locations:

- `.specify/memory/` — constitution only
- `specs/001-*/` — spec, plan, tasks, checklist for that feature
- `specs/002-*/` — and so on per feature
- `backend/` — Python source files only
- `frontend/src/` — React/JS files only

Any markdown file created outside these locations is a violation.
The agent MUST ask before creating any file not explicitly required by the current task.

### Rule 4. Decision Log in Every Spec

Every spec MUST contain a Decision Log section that records why each key
decision was made. After context compression, the agent MUST re-read the
Decision Log before continuing. Decisions already made are not up for
re-derivation.

### Rule 5. Working Directory Rule

Before running any command, the agent MUST verify the current directory.
Backend commands MUST run from `backend/`. Frontend commands MUST run from
`frontend/`. Backend and frontend commands MUST NOT run from the project root.

Spec files MUST only be written inside `specs/` subfolders. 
Never write spec files to the project root or backend/ or frontend/.

### Rule 6. Command Timeout Rule

Any command that runs longer than 2 minutes MUST be killed and reported as
failed. A hanging command is always treated as a failure, never as progress.

## Governance

This Constitution supersedes all other project practices when there is a
conflict. Feature specs, implementation plans, task lists, and agent behavior
MUST pass the Constitution Check before implementation begins.

Amendments require explicit developer instruction in a constitution-focused
conversation. The agent MUST NOT amend this Constitution opportunistically while
implementing a feature. Any amendment MUST include a Sync Impact Report and
MUST propagate required updates to Speckit templates and runtime guidance.

Versioning follows semantic versioning:

- MAJOR for backward-incompatible governance or principle redefinitions
- MINOR for new principles, new required sections, or materially expanded rules
- PATCH for clarifications, wording fixes, and non-semantic refinements

Compliance review is required at these gates:

- During spec creation: confirm a reviewed spec exists and includes a Decision Log
- During planning: confirm stack, scope, twin-first, evidence, graph UX, git audit,
  human-gate, graceful-degradation, and demo-readiness requirements
- During task execution: enforce one IN PROGRESS task and the required task status
  progression
- Before merge to main: confirm the feature is demo-ready and no HIGH or CRITICAL
  pre-mortem finding was auto-merged

**Version**: 1.0.0 | **Ratified**: 2026-05-26 | **Last Amended**: 2026-05-26
