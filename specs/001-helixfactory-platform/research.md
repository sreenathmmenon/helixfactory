# Research: HelixFactory Platform

## Decision: Implement the week-one slice before broader automation

**Rationale**: The constitution fixes week-one priority as living code digital
twin, contextual graph UI, change pre-mortem, blast radius, and architecture Q&A.
The customer stories show these capabilities create the trust needed before
ticket-to-PR automation, reviewer fleets, security dashboards, and
self-improvement loops can be credible.

**Alternatives considered**:

- Start with autonomous ticket-to-PR execution. Rejected because execution
  without twin-first risk evidence violates the core product trust model.
- Build only a static dependency map. Rejected because the product requires
  contextual risk, ownership, auditability, and Q&A, not only dependency lists.

## Decision: Use NetworkX for hackathon graph storage with Neo4j-compatible model

**Rationale**: NetworkX satisfies the constitution's hackathon allowance and
keeps local setup fast enough for a 3-minute demo. Modeling nodes and edges with
stable IDs, labels, relationship types, provenance, and properties preserves a
clean migration path to Neo4j.

**Alternatives considered**:

- Neo4j from day one. Rejected for week one because it increases setup and demo
  operational risk.
- Ad hoc dictionaries. Rejected because typed graph traversal, blast radius, and
  evidence chains need explicit graph semantics.

## Decision: Parse Python, TypeScript, and JavaScript only

**Rationale**: The constitution explicitly limits language scope to these three
languages. This reduces parser surface while covering the target public-repo
demo set.

**Alternatives considered**:

- Add Java and Go. Rejected as post-hackathon scope.
- Treat all files as text. Rejected because pre-mortem evidence must cite
  precise symbol and line relationships where parsers are available.

## Decision: Require evidence-backed findings or suppress them

**Rationale**: Evidence over heuristics is a non-negotiable constitution rule.
The pre-mortem engine must return file, line, dependency chain, consequence, and
preventive check for surfaced findings. If evidence is incomplete, the product
must show an evidence gap rather than a vague warning.

**Alternatives considered**:

- Surface confidence-scored guesses. Rejected because vague warnings train users
  to ignore the system and violate the constitution.
- Block all changes when evidence is incomplete. Rejected because graceful
  degradation allows partial twins as long as uncertainty is explicit.

## Decision: Store platform audit as structured git records

**Rationale**: Git is the source of truth. GitPython gives the backend a direct
way to create audit commits for ingestion, pre-mortem, blast radius, Q&A, scan,
approval, and agent-boundary events using a portable record schema.

**Alternatives considered**:

- Custom audit database. Rejected by constitution.
- Append-only local logs. Rejected because logs are not the canonical audit
  trail and are harder to review, revert, and package for compliance.

## Decision: Use contextual graph interactions only

**Rationale**: The constitution prohibits full-universe graph UX. The visual
experience must start from a selected repo, query, node, or proposed change and
support depth control, relationship filters, recentering, and hover
illumination.

**Alternatives considered**:

- Show the complete graph with zoom and pan. Rejected because it creates a
  hairball and violates graph UX rules.
- Show a table-only blast radius. Rejected because customer stories emphasize
  visual cascade as the adoption trigger.

## Decision: Treat Q&A as cited graph-and-memory retrieval for week one

**Rationale**: Architecture Q&A must answer from the twin and cite sources.
Week-one scope can support repository and graph-derived answers first, with
external memory sources added later.

**Alternatives considered**:

- General chat over code without citations. Rejected because answers must be
  evidence-backed.
- Full organizational memory ingestion across Slack, Jira, and docs in week one.
  Rejected as post-hackathon scope.

## Decision: Define API and audit contracts now

**Rationale**: Even if implementation starts with a narrow demo, contracts keep
backend, frontend, audit, and future agent integration aligned. They also enable
contract tests before broader implementation.

**Alternatives considered**:

- Let frontend and backend evolve without contracts. Rejected because the graph,
  pre-mortem, and audit surfaces are central product behavior.
- Define only UI mock data. Rejected because the demo must work on a real public
  repository.
