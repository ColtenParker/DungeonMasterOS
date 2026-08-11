# ADR-002: PostgreSQL access and local development

- Status: Accepted
- Date: 2026-08-10
- Decision owner: Human developer

## Context

Milestone 0 requires PostgreSQL connectivity and a request that can travel
through the frontend, backend, and database. The application needs a repeatable
default local database environment, but developers who already run PostgreSQL
locally should not be forced to use containers.

The API also needs a database access and schema migration approach before
connectivity and integration tests can be implemented. This baseline must not
silently decide the World, Campaign, Entry, ownership, archive, or relationship
models reserved for later milestone design reviews.

## Options Considered

### Option A: Prisma with Docker Compose as the default

Use Prisma Client for database access and Prisma Migrate for schema migrations.
Configure the API through `DATABASE_URL`. Provide Docker Compose as the
documented default PostgreSQL environment while supporting any compatible
developer-managed PostgreSQL instance.

Advantages:

- Provides a typed client and an approachable schema and migration workflow.
- Gives contributors a reproducible default PostgreSQL version and
  configuration.
- Keeps containerization outside the application through a standard connection
  URL.
- Allows developers to use an existing PostgreSQL installation.

Disadvantages:

- Adds Prisma-specific schema, query, generation, and migration concepts.
- Generated persistence types must not be mistaken for API or domain contracts.
- Complex or PostgreSQL-specific queries may require raw SQL or additional
  adaptation.
- Supporting containerized and locally installed PostgreSQL creates two local
  setup paths to document.

### Option B: Drizzle with Docker Compose as the default

Use Drizzle for database access and migrations, retaining the same
`DATABASE_URL` boundary and support for both containerized and locally managed
PostgreSQL.

Advantages:

- Keeps queries and schema definitions relatively close to SQL.
- Provides TypeScript inference with a lighter abstraction than a full ORM.
- Preserves access to PostgreSQL concepts.

Disadvantages:

- Has a smaller ecosystem and a less integrated workflow than Prisma.
- Still introduces library-specific schema and migration APIs.
- Requires discipline to keep persistence types separate from external API
  contracts.

### Option C: Direct `pg` access with SQL migrations

Use the PostgreSQL driver directly with explicit SQL migrations and support the
same two local PostgreSQL setup paths.

Advantages:

- Makes SQL and PostgreSQL behavior directly visible.
- Avoids an ORM query abstraction.
- Supports all PostgreSQL features without waiting for ORM support.

Disadvantages:

- Requires more manual query, result-mapping, and typing code.
- Requires a separate migration convention or tool.
- Makes consistent CRUD and transaction patterns the application's
  responsibility.

## Decision

Use Option A:

- Prisma Client for API database access;
- Prisma Migrate for schema migrations;
- `DATABASE_URL` as the application's PostgreSQL configuration boundary;
- Docker Compose as the documented default local PostgreSQL environment; and
- support for a compatible developer-installed PostgreSQL instance through the
  same environment variable.

Use a dedicated test database configuration. Automated tests must not point at
or reset the normal development database.

The Compose service uses explicit local-development defaults for the database
name, role, and password, all of which may be overridden through environment
variables. The host port may be overridden independently with `POSTGRES_PORT`;
all connection URLs must use the same selected port. Machine-specific values
belong in the ignored root `.env`, while committed examples retain the
conventional port 5432.

The PostgreSQL health check must execute an authenticated query over TCP with
the configured role and password. A socket-ready check alone is insufficient
because it can report healthy when a persistent volume contains credentials
that no longer match the Compose environment.

Changing initialization credentials does not rewrite an existing PostgreSQL
volume. Developers must deliberately update the database role or recreate the
development volume; volume recreation is destructive and must never be part of
an ordinary start, test, or migration command.

Prisma schema and migrations belong to the API application. Milestone 0 may add
only the database configuration and migration machinery necessary to prove the
workflow; it must not introduce product-domain tables before the corresponding
domain decisions are reviewed and documented.

## Reasoning

Prisma provides an integrated TypeScript client and migration workflow that is
appropriate for establishing a small, understandable baseline. Docker Compose
gives contributors a repeatable default without coupling application code to
Docker. A `DATABASE_URL` boundary preserves the option to use a locally managed
database and keeps the runtime configuration consistent across both paths.

Separating the test and development databases protects local data and makes
database-backed readiness and integration tests repeatable. Explicitly
excluding domain tables from this ADR preserves human ownership of the models
scheduled for later milestones.

## Consequences

### Positive

- API queries receive generated TypeScript support.
- Schema changes have a defined migration workflow from the start.
- New contributors have a documented, reproducible PostgreSQL setup.
- Developers with an existing PostgreSQL server can use it without changing
  application code.
- Tests can exercise real PostgreSQL behavior without modifying development
  data.
- Container health reflects authenticated application-style connectivity, not
  only whether the PostgreSQL process is listening.
- A local port override avoids conflicts without changing the portable
  repository default.

### Negative / Tradeoffs

- Contributors must learn Prisma's schema, client, and migration commands.
- Prisma generation becomes part of installation and build workflows.
- Raw SQL may still be required for behavior that Prisma cannot express well.
- The two supported local database paths require clear environment and setup
  documentation.
- Database-backed tests need lifecycle and cleanup handling.
- Credential changes require an explicit role update or destructive volume
  recreation because PostgreSQL initialization variables are first-run inputs.

### Future implications

- Future schema decisions must be expressed through reviewed Prisma migrations.
- Prisma models remain persistence representations; they do not automatically
  define public API payloads or frontend state.
- World and Campaign identifiers, ownership, archive behavior, fields, and
  uniqueness rules remain Milestone 1 decisions.
- Replacing Prisma later would require query and migration work, so future
  database features should avoid unnecessary Prisma-specific leakage into the
  rest of the application.

## Validation

- Start the documented PostgreSQL environment with Docker Compose and connect
  through `DATABASE_URL`.
- Connect to a compatible developer-managed PostgreSQL instance using only a
  changed `DATABASE_URL`.
- Generate Prisma Client and execute the migration workflow from documented
  npm workspace commands.
- Verify the API readiness endpoint against a running PostgreSQL database.
- Verify readiness returns a sanitized non-success response when PostgreSQL is
  unavailable.
- Run database integration tests against the dedicated test database and
  confirm that the development database is unchanged.
