# ADR-025: Campaign calendar, time, and reminders

- Status: Accepted
- Date: 2026-08-13
- Decision owner: Human developer

## Context

Milestone 7 must let a Campaign maintain an in-world date and time, advance it
manually, and surface advisory reminders. Campaign calendars may differ from
the Gregorian calendar. The application must not simulate elapsed time,
execute fictional events, or silently reinterpret historical dates when the
calendar definition changes.

The calendar and reminders must persist independently of Sessions. Calendar
advancement and meaningful reminder lifecycle changes can participate in a
Session audit when the caller supplies valid Session context.

## Options Considered

### Calendar definition

#### Option A: Configurable fixed Campaign calendar

Advantages:

- Supports common fantasy calendars with predictable date conversion.
- Adds useful structure without becoming a general calendar rules engine.

Disadvantages:

- Does not model leap rules, eras, moons, or irregular months.

#### Option B: Gregorian calendar only

Advantages:

- Can use established date libraries directly.

Disadvantages:

- Excludes many in-world calendars.

#### Option C: Free-text current date

Advantages:

- Accepts any fictional notation.

Disadvantages:

- Cannot calculate advancement or reminder due state reliably.

### Definition changes

#### Option A: Lock structure after time use or reminder creation

Advantages:

- Prevents existing absolute times from silently acquiring new meanings.
- Leaves initial setup correctable before dependent state exists.

Disadvantages:

- Later structural corrections require an explicit migration workflow.

#### Option B: Reinterpret existing values after every edit

Advantages:

- Keeps the definition freely editable.

Disadvantages:

- Can move current dates and reminder deadlines unexpectedly.

#### Option C: Never permit definition edits

Advantages:

- Has the simplest historical semantics.

Disadvantages:

- Makes harmless setup mistakes difficult to fix.

### Time representation

#### Option A: One absolute integer minute offset

Advantages:

- Makes ordering, advancement, correction, and due checks deterministic.
- Derives all display components from one canonical value.

Disadvantages:

- Requires conversion code for the Campaign's custom calendar.

#### Option B: Store year, month, day, hour, and minute independently

Advantages:

- Mirrors the displayed fields.

Disadvantages:

- Creates invalid and ambiguous combinations during updates.

#### Option C: Store date only

Advantages:

- Is simpler.

Disadvantages:

- Omits the requested in-world time and minute-level reminders.

### Time mutation

#### Option A: Positive advancement plus a separate confirmed correction

Advantages:

- Keeps ordinary play monotonic while allowing mistakes to be repaired.
- Gives audit history distinct semantic events.

Disadvantages:

- Requires a confirmation path and two commands.

#### Option B: Allow signed advancement

Advantages:

- Uses one command.

Disadvantages:

- Makes accidental backward movement easy and obscures corrections.

#### Option C: Do not permit correction

Advantages:

- Guarantees monotonic time.

Disadvantages:

- Leaves data-entry mistakes permanent.

### Reminder ownership and lifecycle

#### Option A: Campaign reminders with optional visible Entry links and manual states

Advantages:

- Supports standalone events and Entry-related deadlines.
- Keeps completion and dismissal intentional.

Disadvantages:

- Due state and lifecycle state must be presented separately.

#### Option B: Require every reminder to belong to an Entry

Advantages:

- Gives every reminder content context.

Disadvantages:

- Forces general Campaign events into unrelated Entries.

#### Option C: Store reminders only inside documents

Advantages:

- Avoids a relational reminder model.

Disadvantages:

- Cannot query or surface due reminders reliably.

### Recurrence

#### Option A: One-time reminders only

Advantages:

- Has explicit, predictable lifecycle behavior.
- Meets Milestone 7 without adding recurrence generation rules.

Disadvantages:

- Repeating fictional events must be recreated manually.

#### Option B: Fixed-interval recurrence

Advantages:

- Supports common restock and downtime patterns.

Disadvantages:

- Introduces occurrence generation and edit-series semantics.

#### Option C: General recurrence rules

Advantages:

- Models complex schedules.

Disadvantages:

- Expands the milestone into a calendar rules engine.

### Due behavior

#### Option A: Surface newly due reminders without executing them

Advantages:

- Keeps the DM in control of fictional events.
- Makes time advancement informative but nonblocking.

Disadvantages:

- The DM must complete or dismiss reminders manually.

#### Option B: Block advancement until reminders are resolved

Advantages:

- Prevents reminders from being overlooked.

Disadvantages:

- Interrupts play and gives reminders control over Campaign time.

#### Option C: Execute associated events automatically

Advantages:

- Provides automation.

Disadvantages:

- Violates the product's DM-assistant boundary.

## Decision

A Campaign may explicitly configure one fixed in-world calendar. Its structural
definition consists of ordered named months with positive integer day counts,
ordered weekday names, positive integer hours per day, and positive integer
minutes per hour. The definition excludes leap rules, eras, moon cycles,
variable years, and other irregular calendar behavior.

The first minute of year 1, month 1, day 1 is the display epoch. Store current
Campaign time and reminder deadlines as canonical integer minute offsets from
that epoch, at minute precision, and derive year, month, day, weekday, hour,
and minute for display. Calendar APIs must validate a documented safe integer
range and round-trip offsets without precision loss. Calendar calculations do
not use host timezone or JavaScript `Date` semantics.

Month names, month lengths, weekday names, hours per day, and minutes per hour
may be edited only before the first time advancement or correction and before
the first reminder is created. The calendar records that its structure is
locked when either event occurs. Later structure changes require a future
explicit migration that previews how current time and reminders move; simple
update endpoints must reject them.

Ordinary advancement accepts only a positive integer number of minutes. A
separate correction command may set the current offset earlier or later after
explicit user confirmation and must reject a no-op. Advancement and correction
are distinct Session activity event types when valid Session context is
provided. Neither command opens, completes, dismisses, or executes a reminder.

Store one-time reminders as Campaign-owned records with UUIDv7 identity,
required bounded title, optional bounded notes, due-minute offset, all-day
flag, lifecycle status, timestamps, and an optional Entry reference. A linked
Entry must be visible in the reminder's Campaign context. The link remains
valid when that Entry is archived and does not transfer ownership of the
reminder.

Reminder lifecycle is exactly `PENDING`, `COMPLETED`, or `DISMISSED`.
Completion and dismissal are explicit manual transitions from pending and are
not inferred from time. Due presentation is derived independently: a pending
reminder is upcoming when its due minute is after current Campaign time and is
due or overdue otherwise. The all-day flag changes presentation, not storage;
the deadline still has one canonical minute offset. Milestone 7 does not
generate recurring reminder instances.

A successful positive time advancement returns the pending reminders crossed
by that command, ordered by due minute and stable identity, in the same response
as the updated calendar. The Calendar utility presents them nonblockingly and
continues to show all pending due reminders on later reads. Forward corrections
also return pending reminders crossed by the correction; backward corrections
recompute derived due presentation but do not change reminder lifecycle.
Reminder surfacing never executes a fictional event or mutates referenced
Entries.

Creating, rescheduling, completing, or dismissing a reminder and advancing or
correcting Campaign time creates the corresponding semantic Session activity
event only when valid Session context is supplied. Routine reads and due-state
derivation do not create events.

## Reasoning

A fixed custom calendar covers the common useful case while retaining exact,
queryable arithmetic. One canonical minute coordinate avoids partially valid
dates and makes reminder crossing deterministic. Structural locking protects
existing meaning, and manual reminder lifecycle preserves the product rule
that software advises the DM rather than running the Campaign.

## Consequences

### Positive

- Fantasy dates and minute-level time advance deterministically.
- Current time and reminders share one sortable representation.
- Existing deadlines cannot silently shift after calendar-definition edits.
- Reminder surfacing informs play without controlling it.

### Negative / Tradeoffs

- Calendar setup must be completed before operational use.
- Fixing a locked structural error requires a future migration workflow.
- Leap years, eras, moons, and recurrence are unavailable in Milestone 7.
- The client must distinguish reminder lifecycle from derived due presentation.

### Future implications

- Recurrence requires an explicit occurrence and series-editing design.
- Calendar-definition migration must preview and atomically update every
  affected offset.
- Import and export must preserve definition order, lock state, canonical
  offsets, reminder identity, and lifecycle.
- Automatic event execution remains outside the product boundary.

## Validation

- Calendar tests cover custom month lengths, year boundaries, weekday
  derivation, nonstandard hours and minutes, and safe-range limits.
- lock tests prove structure is editable only before advancement, correction,
  or reminder creation.
- command tests prove advance is positive-only and correction requires explicit
  confirmation and cannot be a no-op.
- Reminder tests cover ownership, visible Entry links, archive behavior,
  all-day presentation, rescheduling, completion, and dismissal.
- crossing tests prove advances and forward corrections return each applicable
  pending reminder in deterministic order without changing its lifecycle.
- backward-correction tests prove due presentation recomputes without reopening
  completed or dismissed reminders.
- activity tests prove only approved semantic commands create Session events.

