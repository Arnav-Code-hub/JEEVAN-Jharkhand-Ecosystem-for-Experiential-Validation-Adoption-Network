# ADR-0002: Neo4j vs. PostgreSQL + pgvector for competency matching

- **Status:** **Accepted** — Neo4j dropped; PostgreSQL + pgvector
- **Date:** 2026-08-31 (proposed) / 2026-08-31 (accepted)
- **Blocks:** Phase 4 and Phase 6

## Context

parameter.md names Neo4j as the definitive choice for the Competency Demand/Supply Knowledge Graph. In practice neo4j-driver is a backend dependency imported in zero files, and the ML service opens a driver at startup that never runs a query. The modelling need is a many-to-many between problems and competency tags, plus semantic similarity between a layman's complaint and a skill set.

## Recommendation

Drop Neo4j. Model competencies as Postgres tables and use pgvector for similarity matching, which is what competency matching actually requires (embedding nearest-neighbour, not graph traversal).

## Decision

**Neo4j is dropped. Competency modelling and matching live in PostgreSQL, using ordinary
relational tables for the taxonomy and the `pgvector` extension for similarity search.**

Rationale given at decision time: it removes a second database, a second query language, a second
connection pool, and the dual-write consistency problem, in exchange for capability the project was
not actually using — the driver was imported in zero backend files and the ML service never ran a
single Cypher query.

Consequences now binding:
- PostgreSQL is the sole datastore. `parameter.md` §1 is amended accordingly; MongoDB remains
  excluded as it always was.
- The `pgvector` extension must be enabled by migration before Phase 6, and the local Postgres
  image must be one that ships it (e.g. `pgvector/pgvector:pg15`) — plain `postgres:15-alpine`
  does not.
- Cleanup required, tracked as follow-up work: remove the unused `neo4j-driver` backend
  dependency, remove `ml-service/app/models/neo4j_driver.py` and its startup/shutdown hooks, and
  drop the `NEO4J_*` variables from `.env.example`.
- Competency matching becomes an embedding-similarity problem, so Phase 6 needs an embedding
  source. Until a real model is wired up it goes through the `ai-gateway` mock like every other
  AI call (`parameter.md` §3).

## Consequences if accepted

One database, one query language, one failure mode, no dual-write consistency problem. Deviates from a documented requirement, so it needs explicit sign-off. Requires the pgvector extension.

## Alternatives considered

Retain Neo4j: acceptable only if Postgres remains the sole system of record and Neo4j is a read-only projection rebuilt from it. Dual-writing to both stores is rejected outright - the graph rots silently the first time a write fails.

---

*Decided 2026-08-31. Supersedes the Recommendation section above where they differ.*
