# ADR-008: PostgreSQL Entry search and Quick Open

- Status: Accepted
- Date: 2026-08-11
- Decision owner: Human developer

## Context

Milestone 3 must provide category, Campaign, World, and global Entry search and
a keyboard-driven Quick Open workflow. Search should inspect titles, document
content, and tags. Archived Entries remain searchable but should not clutter
normal active views.

Entry documents are versioned ProseMirror JSON rather than plain text. ADR-005
deliberately deferred a derived search projection until this milestone. The
application already uses local PostgreSQL, contextual REST endpoints, and an
Entry browser that distinguishes World and Campaign scope. Milestone 4, not
Milestone 3, owns the persistent floating-window workspace.

## Options Considered

### Search storage and engine

#### Option A: PostgreSQL full-text search with derived document text

Extract version-aware plain text from each validated ProseMirror document,
store it as derived data, and index searchable Entry text with PostgreSQL
full-text search. Include tags through relational queries and supplement
full-text ranking with exact and prefix title matching for Quick Open.

Advantages:

- Uses the existing database and local deployment model.
- Avoids repeatedly walking JSON documents during every search.
- Supports ranked document-content search with a GIN index.
- Keeps canonical document JSON separate from rebuildable search data.

Disadvantages:

- Requires custom PostgreSQL migration and query logic around Prisma.
- Search projections must remain synchronized with Entry changes.
- Full-text search alone is not typo tolerant.

#### Option B: Derived text with unindexed or lightly indexed `ILIKE` matching

Advantages:

- Is straightforward to implement and understand.
- Naturally supports arbitrary substring matching.

Disadvantages:

- Provides weak ranking.
- Becomes slower as documents and Entry counts grow.
- Encourages later replacement of API-visible behavior.

#### Option C: Dedicated search service

Advantages:

- Can provide advanced fuzzy matching and ranking.

Disadvantages:

- Adds an unnecessary service and synchronization boundary to the local MVP.

### Search scope

#### Option A: Preserve established Entry visibility boundaries

Category search uses the active context and selected Entry type. Campaign
search includes the selected Campaign plus inherited World Entries. World
search includes World-scoped Entries only. Global search includes all Entries.

Advantages:

- Matches ADR-004 and the existing Entry browser.
- Prevents Campaign-specific canon from appearing as World canon.
- Keeps every search result's inclusion rule explainable.

Disadvantages:

- Searching a World does not search all Campaigns beneath it.
- Cross-Campaign discovery requires global search.

#### Option B: Hierarchical World search

Advantages:

- Finds all content contained anywhere beneath a World.

Disadvantages:

- Mixes isolated Campaign timelines into World results.
- Requires stronger scope labeling and ambiguity handling.

### Archived search behavior

#### Option A: Active by default with archived and combined filters

Advantages:

- Keeps ordinary results focused while preserving explicit access to archived
  material.
- Matches existing archive filter conventions.

Disadvantages:

- Finding archived content requires changing a filter.

#### Option B: Always include archived Entries

Advantages:

- Never hides a potentially useful result.

Disadvantages:

- Adds noise to normal search and Quick Open.

### API and result sizing

#### Option A: Contextual search endpoints with a bounded result set

Provide World, Campaign, and global endpoints with consistent query, type, tag,
archive, and limit parameters. Return no more than 100 ranked results without
pagination in Milestone 3.

Advantages:

- Matches the existing contextual REST API.
- Prevents unbounded document-search responses.
- Keeps Quick Open and initial search UI simple.

Disadvantages:

- Callers must choose the correct contextual route.
- Results after the limit cannot be browsed without narrowing the search.

#### Option B: One universal endpoint with scope parameters

Advantages:

- Centralizes search routing.

Disadvantages:

- Permits contradictory or invalid scope parameter combinations.

#### Option C: Add cursor pagination immediately

Advantages:

- Supports very large result sets.

Disadvantages:

- Stable cursor behavior over relevance-ranked results adds complexity before
  real usage demonstrates a need.

### Quick Open before the Campaign workspace

#### Option A: Reusable keyboard picker with a replaceable open action

In Milestone 3, Quick Open selects the chosen Entry in the current editor. Keep
the final open action behind a component boundary so Milestone 4 can replace it
with open-or-focus floating-window behavior.

Advantages:

- Delivers keyboard-driven retrieval without designing the workspace early.
- Makes the search and selection interface reusable in Milestone 4.

Disadvantages:

- The interim behavior opens an Entry inline rather than in a floating window.

#### Option B: Implement an early workspace shell

Advantages:

- Resembles the final interaction sooner.

Disadvantages:

- Pulls window state, focus, and persistence decisions into the wrong
  milestone.

## Decision

Store a derived plain-text projection for every Entry document. Extraction must
be version-aware, deterministic, and rebuildable from canonical ProseMirror
JSON. Create and document updates must write canonical content and its search
projection atomically. Tag changes remain relational and participate in search
without becoming part of the document projection.

Use PostgreSQL full-text search with a GIN index and the `simple` text-search
configuration so fantasy names and game-specific terminology are not subjected
to aggressive English stemming. Search titles, tag names, and document text.
Rank exact and prefix title matches first, followed by tag matches and then
document-content relevance. Typo-tolerant fuzzy search is not part of
Milestone 3.

Use these scope rules:

- category search uses the current World or Campaign context plus an Entry type;
- Campaign search includes that Campaign and inherited Entries from its parent
  World;
- World search includes World-scoped Entries only; and
- global search includes Entries across all Worlds and Campaigns.

Every result must expose enough type, scope, and archive information to
disambiguate duplicate titles. Search defaults to active Entries. Provide
explicit archived and combined filters. Archived Entries and references remain
intact and directly openable.

Use contextual REST search operations for World and Campaign searches and a
global search operation for all accessible content. Apply consistent query,
Entry type, tag, archive, and result-limit validation. Return at most 100 ranked
results and do not add pagination in Milestone 3. Empty-query category browsing
may continue to use the existing deterministic Entry list APIs; search queries
use relevance ordering.

Implement Quick Open as a keyboard-accessible search picker using the active
Campaign search when a Campaign is selected, the active World search otherwise,
and global search only when explicitly selected. In Milestone 3 its open action
selects the Entry in the current editor. Keep that action replaceable so
Milestone 4 can open or focus the corresponding floating window without
replacing search.

Do not add a client router, global state library, external search service, or
premature workspace shell for this milestone.

## Reasoning

PostgreSQL full-text search gives the local application durable ranked search
without another service. A rebuildable text projection isolates search from the
canonical document representation and lets every supported document version
define its own safe extractor. Exact and prefix title precedence keeps Quick
Open useful for names even though full-text matching is optimized for tokens.

The chosen scopes preserve the canon and visibility rules users already see in
Entry browsing. Bounded contextual endpoints fit the current API and avoid
premature pagination. A replaceable Quick Open action delivers the navigation
workflow now while leaving the defining window behavior to Milestone 4.

## Consequences

### Positive

- Titles, tags, and rich-text content are searchable through one local
  PostgreSQL system.
- Search avoids scanning and interpreting JSON for every request.
- Search scopes match existing World and Campaign browsing.
- Archived content remains deliberately discoverable.
- Quick Open can transition to floating windows without redesigning search.

### Negative / Tradeoffs

- Prisma code must use or encapsulate PostgreSQL-specific full-text queries.
- Projection synchronization adds work to Entry writes.
- Search is not typo tolerant in Milestone 3.
- World search intentionally excludes Campaign-specific content.
- A hard result cap requires narrowing broad searches.

### Future implications

- Every future document schema version must provide compatible text extraction.
- Milestone 4 replaces only Quick Open's final open action with workspace
  open-or-focus behavior.
- Milestone 8 may add fuzzy matching, pagination, or ranking refinements after
  real-use evidence.
- Milestone 9 can rebuild search projections after import rather than treating
  them as canonical archive data.

## Validation

- Unit tests prove deterministic plain-text extraction for every supported
  document version and formatting structure.
- Transaction tests prove document and search projection changes cannot diverge.
- PostgreSQL integration tests prove title, prefix, tag, and document matches,
  ranking order, and the 100-result maximum.
- Scope tests prove Campaign inheritance, World-only results, category
  filtering, and global coverage without sibling-Campaign leakage.
- Archive tests prove active defaults and explicit archived and combined
  searches.
- API tests prove validation and consistent contextual response metadata.
- UI tests prove keyboard navigation, duplicate-title disambiguation, filters,
  and opening a selected result in the current editor.
- A representative local dataset verifies acceptable search latency before the
  milestone is considered complete.

