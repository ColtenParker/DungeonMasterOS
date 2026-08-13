# ADR-018: Quest structured sections

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

Quests may contain status, objectives, rewards, failure conditions, deadlines,
and related content, but the product explicitly permits a DM to ignore
structured sections and use free-form notes. Automation must not automatically
progress or fail quests. Milestone 7, rather than Milestone 6, owns in-world
time and calendar behavior.

## Options Considered

### Structured Quest data

#### Option A: Status and objectives only

Advantages:

- Enables filtering and manual progress tracking.
- Keeps prose and system-specific outcomes flexible.

Disadvantages:

- Rewards, failure conditions, and deadlines have no dedicated fields.

#### Option B: Structure every listed Quest section

Advantages:

- Provides dedicated fields for all examples immediately.

Disadvantages:

- Structures data before the application has defined behavior for it.

#### Option C: Structure status only

Advantages:

- Minimizes schema additions.

Disadvantages:

- Omits the most useful trackable Quest content.

### Objective representation

#### Option A: Ordered objective rows with manual completion

Advantages:

- Supports stable identity, reordering, and explicit progress.
- Avoids automatic gameplay consequences.

Disadvantages:

- Represents a simple complete/incomplete model only.

#### Option B: Rich objective workflow states

Advantages:

- Can express blocked, failed, or skipped objectives.

Disadvantages:

- Introduces a workflow vocabulary not required by the product.

#### Option C: Rich-document checklists only

Advantages:

- Requires no relational child model.

Disadvantages:

- Cannot provide reliable structured progress behavior.

### Deadline representation

#### Option A: Keep deadlines free-form until time is designed

Advantages:

- Avoids confusing fictional and real-world timestamps.
- Lets Milestone 7 define the calendar relationship deliberately.

Disadvantages:

- Deadlines cannot yet drive reminders or chronological views.

#### Option B: Store real-world timestamps

Advantages:

- Uses established date-time primitives.

Disadvantages:

- Misrepresents most in-world deadlines.

#### Option C: Store an opaque structured string

Advantages:

- Provides a dedicated field without choosing a calendar.

Disadvantages:

- Gives the application no behavior beyond displaying text.

## Decision

Add `QUEST` as an Entry type with optional status and objectives sections.
Status follows ADR-015. Objectives are ordered relational rows with UUIDv7
identity, bounded plain-text content, a manually controlled completion boolean,
and ordering. Saving objective changes never changes Quest status, relationships,
calendar state, or any other Entry automatically.

Keep rewards, failure conditions, narrative consequences, and deadlines in the
rich document. Continue to use generic relationships for related NPCs,
Locations, Items, and other content rather than duplicating those references in
the Quest extension.

Do not add a structured deadline until Milestone 7 defines in-world time and
calendar semantics. A real-world timestamp and an opaque string are both
insufficient substitutes for that design.

## Reasoning

Status and objectives are the portions of a Quest on which the application can
provide immediate, understandable behavior. Everything else currently benefits
more from the existing document and relationship tools. Manual completion
honors the product rule against automatic campaign-state changes.

## Consequences

### Positive

- Quests can be filtered and their objectives manually tracked.
- Objective order and identity survive aggregate saves.
- Free-form Quest planning remains first-class.

### Negative / Tradeoffs

- Objectives have only complete and incomplete states.
- Objective text is not added to full-text search in Milestone 6.
- Deadlines provide no structured behavior yet.

### Future implications

- Milestone 7 may associate Quests or objectives with in-world calendar data.
- Rich objective states require a separate product decision if actual use
  demonstrates a need.
- Activity logging may record manual objective changes without automating them.

## Validation

- API tests enforce objective identifiers, text bounds, ordering, and boolean
  completion.
- aggregate-save tests prove objective and document changes are atomic.
- interaction tests cover adding, reordering, completing, removing, and
  discarding objectives.
- tests prove objective completion does not alter Quest status or related
  Entries.

