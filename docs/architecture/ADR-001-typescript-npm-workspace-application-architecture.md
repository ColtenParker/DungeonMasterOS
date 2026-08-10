# ADR-001: TypeScript npm-workspace application architecture

- Status: Accepted
- Date: 2026-08-10
- Decision owner: Human developer

## Context

Milestone 0 requires a stable development baseline with a React frontend, an
Express backend, PostgreSQL connectivity, tests, and linting and formatting
scripts. The frontend, backend, and database must be able to complete a simple
request through the full stack.

The repository needs clear runtime and package boundaries without introducing
product-domain models or infrastructure that belongs to later milestones. The
baseline should also remain straightforward for a developer to run, test, and
explain.

## Options Considered

### Option A: Strict TypeScript applications in an npm workspace

Use native ECMAScript modules and strict TypeScript throughout an npm workspace.
Place the Vite and React frontend in `apps/web` and the Express API in
`apps/api`. Use relative `/api` requests with a Vite development proxy. Use
Vitest across both applications, React Testing Library for frontend behavior,
and Supertest for API behavior. Use ESLint and Prettier for linting and
formatting.

Advantages:

- Gives the browser and server explicit package and dependency boundaries.
- Uses one language, module system, package manager, and test runner across the
  application.
- Makes type errors visible before runtime and avoids a later JavaScript to
  TypeScript migration.
- Keeps the frontend-to-backend development path simple and same-origin from
  the browser's perspective.
- Leaves room for a shared package if concrete shared code is identified later.

Disadvantages:

- Requires workspace, TypeScript, Vite proxy, lint, and test configuration at
  the outset.
- Strict TypeScript can add friction when integrating libraries or handling
  data at runtime boundaries.
- npm's workspace isolation is less strict than pnpm's, so package dependencies
  require discipline.
- A development proxy does not decide or test a future production deployment
  topology.

### Option B: TypeScript applications in a pnpm workspace

Use the same application boundaries and tools as Option A, but use pnpm for
workspace and dependency management.

Advantages:

- Provides efficient installs and stricter dependency isolation.
- Offers strong workspace filtering and monorepo commands.

Disadvantages:

- Adds a package-manager installation or Corepack requirement.
- Uses a symlinked dependency layout that can expose compatibility issues in
  some tools.
- Increases onboarding requirements compared with the package manager bundled
  with Node.js.

### Option C: Separate client and server projects

Use independent `client` and `server` projects without a root workspace and
allow each application to select its own test and module conventions.

Advantages:

- Makes each application independently understandable.
- Avoids workspace-specific configuration.

Disadvantages:

- Duplicates scripts and dependency-management workflows.
- Makes root-level development and continuous-integration commands harder to
  coordinate.
- Makes future shared contracts more cumbersome.
- Allows frontend and backend conventions to drift.

## Decision

Use Option A:

- strict TypeScript throughout application and test code;
- native ECMAScript modules throughout;
- npm workspaces;
- `apps/web` for the Vite and React frontend;
- `apps/api` for the Express backend;
- relative `/api` browser requests proxied by Vite during development;
- Vitest in both applications, React Testing Library for frontend behavior, and
  Supertest for API behavior; and
- ESLint and Prettier for linting and formatting.

Do not create a shared package until there is code with demonstrated ownership
in both applications. This decision does not select a production hosting model.

Expose separate health endpoints:

- `GET /api/health/live` reports whether the API process can answer requests and
  does not query PostgreSQL.
- `GET /api/health/ready` reports whether the API can reach PostgreSQL. It
  returns a non-success response when the database is unavailable and must not
  expose credentials, stack traces, or raw database errors.

## Reasoning

This option uses the intended React, Express, and Node.js stack while keeping
the browser and server dependency boundaries explicit. npm minimizes onboarding
requirements, and a single TypeScript, ESM, testing, linting, and formatting
toolchain reduces avoidable variation between the applications.

The `/api` development proxy provides a small and understandable local request
path without making cross-origin deployment assumptions. Separate liveness and
readiness endpoints give process health and database availability precise
meanings while still providing the full-stack connectivity proof required by
Milestone 0.

## Consequences

### Positive

- Root workspace commands can run development, tests, linting, and formatting
  consistently.
- Frontend and backend code receive the same strict type checking.
- Each application owns its runtime-specific dependencies.
- The readiness endpoint provides a stable place to verify database
  connectivity.
- Later packages can be added without restructuring the two applications.

### Negative / Tradeoffs

- The baseline has several configuration files before product behavior exists.
- Runtime input still requires validation; TypeScript types alone do not make
  API or database data safe.
- npm workspaces do not prevent every accidental cross-package dependency.
- Separate liveness and readiness routes add a small amount of API surface.
- Production asset serving and deployment remain unresolved.

### Future implications

- A shared package requires a separate, concrete ownership decision rather than
  being used as a general-purpose dumping ground.
- Production hosting may use a different proxy or origin arrangement without
  changing frontend calls that remain relative to `/api`.
- Domain API shapes, client state management, and product-domain persistence
  remain decisions for their relevant milestones.

## Validation

- Install all workspace dependencies from the repository root with npm.
- Run strict TypeScript checks for both applications.
- Run ESLint and Prettier checks from the repository root.
- Run frontend tests with Vitest and React Testing Library.
- Run API tests with Vitest and Supertest.
- Verify that the frontend can request an API route through the Vite proxy.
- Verify that liveness succeeds without a database connection.
- Verify that readiness succeeds with PostgreSQL available and fails without
  exposing internal error details when PostgreSQL is unavailable.
