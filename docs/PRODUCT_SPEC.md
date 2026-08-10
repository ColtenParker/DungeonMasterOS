# Product Specification

## 1. Product Vision

Build a Dungeon Master-focused campaign management application that combines:

- flexible interconnected knowledge management
- a map-centered persistent campaign workspace
- structured TTRPG tools only where structure provides concrete utility

The application should help a Dungeon Master organize and run campaigns without forcing tabletop play into a rigid video-game-like model.

Core principle:

> Combine the flexibility of a notebook with the advantages of structured software.

The software assists the DM. It does not interpret, simulate, or control the campaign.

## 2. MVP User

The MVP has one user:

- Dungeon Master

Deferred:

- player accounts
- collaboration
- permissions
- public/shared views
- D&D Beyond integration
- cloud sync
- AI features
- multiplayer
- VTT automation

## 3. Design Principles

### DM Control

Nothing in the fictional world changes automatically unless the DM explicitly changes it.

Automation may remind, organize, record, or surface information.

Automation should not automatically fail quests, progress factions, kill NPCs, change relationships, or redefine world canon.

### Flexible Structure

Structured data should exist when the application gains useful behavior from it.

Examples:

Structured:
- quest status
- initiative
- HP
- inventory lists
- current location
- parent location
- related entries

Free-form:
- dialogue
- rumors
- secrets
- descriptions
- personality
- session planning
- lore

### Intelligent Defaults

The application may choose context-sensitive defaults, but the DM can override them.

### Loose Coupling

Entries can reference one another for navigation and organization without creating deep gameplay dependencies.

### Preserve Working Context

The DM should not have to abandon the active workspace to retrieve information.

## 4. Core Hierarchy

### World

World is the highest-level content container.

A World represents a reusable fictional setting that may continue developing independently of individual campaigns.

A World can contain:

- Campaigns
- World-level entries
- media
- reusable setting information

### Campaign

A World may contain multiple Campaigns.

Campaigns represent individual groups, stories, or timelines operating within a World.

Campaign content may remain isolated from World canon.

Campaign changes may optionally be promoted to the World when the DM chooses.

Campaign events never automatically redefine the World.

## 5. Entry Model

Major content objects are Entries.

Examples:

- NPC
- Location
- Quest
- Faction
- Item
- Session
- Encounter
- Encounter Table
- Journal/Lore

Common Entry behavior:

- title
- rich-text document
- optional Markdown editing
- inline links
- related-content references
- tags
- World or Campaign scope
- searchability
- archive state
- media references

Each Entry type may add specialized structured sections.

## 6. Entry Editing

Rich text is the default editor.

Markdown is an optional alternative.

The DM can highlight text and either:

- link it to an existing Entry
- create a new Entry from that phrase

Backlinks are organizational only.

Related-content links may include an optional context note.

## 7. Entry Presets

Built-in presets determine which optional sections appear initially.

Example NPC presets:

- Blank
- Merchant
- Noble
- Guard
- Villain

A preset does not create a different domain type.

After creation, the DM may freely add or remove supported sections.

Custom preset management is deferred.

## 8. NPC

NPCs are standalone organizational anchors.

Possible sections:

- name
- portrait
- description
- notes
- status
- current location
- inventory
- stat block
- related content

NPCs are not owned by Locations and may move between Locations.

## 9. Location

Locations represent tangible places.

Locations may form a hierarchy.

Example:

World → Continent → Kingdom → City → District → Tavern → Basement

Locations may contain Points of Interest or nested Locations.

Locations may reference NPCs, Quests, Factions, Items, Maps, and Lore.

## 10. Quest

Quest may contain:

- status
- objectives
- rewards
- failure conditions
- deadlines
- related NPCs
- related Locations
- related Items

The DM may ignore structured sections and use free-form notes.

## 11. Faction

Faction is a standalone Entry, not a structural parent.

Possible sections:

- description
- goals
- leadership
- notes
- status

Other Entries may reference a Faction without becoming owned by it.

## 12. Items and Inventory

### Item Definition

Items exist independently in an Item Library.

Items may originate from:

- game-system defaults
- World-level custom content
- Campaign-level custom content

### Inventory

Inventory is a structured list of Item references.

It represents ownership or availability from the DM's perspective.

Deleting or removing an Inventory removes the references, not the Item definitions.

## 13. Game System

A World selects a Game System.

Game System may provide reusable reference content such as default Items, conditions, and rules references.

The MVP may initially support one system while preserving the concept for later expansion.

## 14. Encounter

MVP encounter support is intentionally limited.

Possible functionality:

- combatants
- initiative
- current HP
- max HP
- temporary HP
- free-form notes
- manual add/remove combatants

No automatic dice rolling or combat resolution is required.

## 15. Encounter Table

Encounter Tables organize possible scenarios.

The application does not roll automatically.

The DM can create a table, add ordered/numbered possibilities, write free-form outcome text, and add inline links.

## 16. Session

A Session is an Entry inside a Campaign.

Suggested minimal metadata:

- session name/number
- optional real-world date
- free-form preparation/notes

### Session Activity Log

When the DM explicitly starts a Session, the application records meaningful persistent changes until the Session ends.

Examples:

- Entry created
- status changed
- relationship added/removed
- calendar advanced
- inventory changed
- Entry archived
- Entry content edited

Do not log trivial UI activity such as searches, window movement, or resizing.

The log is an audit trail, not an automatically generated narrative recap.

## 17. In-Game Calendar

Campaigns may maintain an in-world date/time.

The DM manually advances time.

The application may surface reminders such as deadlines, restocks, faction events, downtime completion, or seasonal events.

The application does not execute those events automatically.

## 18. Campaign Workspace

Campaign owns one persistent visual workspace.

Base layer:

- active map
- image
- other chosen visual background

Floating Entry and utility windows appear above it.

Workspace windows should support:

- open
- close
- drag
- resize
- minimize
- bring to front
- optional pinning

Opening an already-open Entry brings its existing window forward.

Workspace state persists across Sessions.

Switching maps does not open, close, or rearrange windows.

## 19. Maps

Maps are stored in the Media Library.

Maps may contain interactive references.

Example:

- building marker → Location
- NPC marker → NPC

Map markers are navigational references only.

## 20. Navigation

Primary browsing is category-based.

Examples:

- NPCs
- Locations
- Quests
- Sessions
- Items
- Factions
- Encounters
- Encounter Tables
- Journal/Lore
- Media

Entries may additionally be filtered by archive state, scope, status, and tags.

## 21. Search

Search scope depends on context.

- Category search searches that category.
- Campaign search searches the Campaign.
- World search searches World-relevant content.
- Global search searches all accessible content.

Quick Open should allow fast keyboard-driven opening of Entries into the workspace.

Search should inspect titles and, where practical, document content and tags.

## 22. Tags

Tags are optional user-defined labels for cross-category organization.

They do not imply relationships or behavior.

Tags should support:

- multiple tags per Entry
- autocomplete from existing tags
- search
- filtering

Advanced tag hierarchies are deferred.

## 23. Status vs Archive

Status represents fictional in-world or campaign state.

Archive represents DM organization.

Status changes do not automatically trigger other changes.

Archived Entries remain intact, linked, and searchable while being hidden from default active views.

## 24. Deletion

Deletion is intentionally difficult.

An Entry may only be permanently deleted when no references depend on it.

If deletion is blocked, show the references preventing deletion.

Removing a relationship never deletes the related Entry.

Removing an inline link preserves the visible text.

## 25. Media Library

Media is managed through a dedicated reusable library.

Possible categories:

- Maps
- Images
- Documents
- Audio
- Video
- Tokens
- Other

Entries reference Media rather than owning duplicate copies.

Media may have World or Campaign scope.

## 26. Import and Export

Portability is a core local-first feature.

### Single Entry

Lightweight Entries may be exported as copy/paste codes.

Large media should not be embedded in these strings.

### Content Bundle

A bundle contains multiple selected Entries, relationships among included Entries, and relevant media.

### Campaign Archive

Exports an entire Campaign and Campaign-scoped content.

### World Archive

Exports the entire World, contained Campaigns, Entries, relationships, tags, media, and relevant workspace state.

### Import Review

Missing references generate warnings rather than hard failures.

For each warning, the DM may:

- link to an existing Entry
- remove the reference
- ignore/resolve later
- cancel import

The application should never auto-link merely because names match.

## 27. MVP Scope

The first usable version is:

- local
- single-user
- DM-only

The DM should be able to create a World, create a Campaign, organize interconnected content, prepare Sessions, run the Campaign from the map-centered workspace, track initiative/HP/time, search quickly, and back up or move their data.

## 28. Explicit Non-Goals

Do not turn the MVP into:

- a rules engine
- a campaign simulator
- a full VTT
- an AI Dungeon Master
- a player character creator
- a mandatory workflow system
