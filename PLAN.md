# Plan: Recursive Spec System for Agentic Workflows

## Overview

Replace the current PRD → SDD → Feature Spec → Task List cascade with a **single recursive document type ("Spec")** that supports parallel agent work via git-branch-based claims and explicit dependency tracking.

**Key innovation:** Requirements use EARS (Easy Approach to Requirements Syntax) for maximum unambiguity.

## CLI Tool

- **Name:** `sc` (one-handed typing)
- **Runtime:** Bun (TypeScript)
- **Install:** `bun install -g sc` (or local `bunx sc`)
- **Invocation:** `sc <command> [options]`

## Core Design Decisions

### 1. Single Document Type: "Spec"
- **Contains**: What/Why (always), Technical Approach (when needed), Tasks (inline or linked)
- **Recursive**: A spec can have child specs (tasks that are big enough become specs themselves)
- **Self-contained**: Everything needed to implement lives in the spec

### 2. File Structure
```
docs/specs/
  my-app-a1b2/
    my-app-a1b2.md              # Root spec (filename matches directory)
    auth-feature-c3d4/
      auth-feature-c3d4.md      # Child spec
      oauth-setup-e5f6/
        oauth-setup-e5f6.md     # Grandchild spec
    dashboard-i9j0/
      dashboard-i9j0.md
```

**Rules:**
- Always create a directory (consistency over adaptivity)
- Directory name: `[slug]-[hash]/` (hash length is adaptive, see section 3)
- Spec file: `[slug]-[hash].md` (matches directory name for clear editor tabs)
- Hierarchy = folder nesting

### 3. Spec IDs (Beads-style Adaptive Length)

**Generation:** Random UUID → derive short alphanumeric hash (a-z, 0-9)

**Adaptive length:** ID length grows with database size to maintain low collision probability.

| Spec Count | ID Length | Max Collision Prob |
|------------|-----------|-------------------|
| 0–500 | 4 chars | 7.17% |
| 501–1,500 | 5 chars | 1.84% |
| 1,501–5,000 | 5 chars | 18.68% |
| 5,001–15,000 | 6 chars | 5.04% |
| 15,001+ | 7+ chars | continues scaling |

**Collision resolution:** 30 retries (10 at base length, 10 at +1, 10 at +2)

**Full path format:** `[slug]-[hash]` (e.g., `implement-auth-a1b2`)

### 4. Status Values
| Status | Meaning |
|--------|---------|
| `ready` | Available for work, no blockers |
| `in_progress` | Being worked on (branch exists) |
| `blocked` | Waiting on dependencies |
| `closed` | Complete |
| `deferred` | Postponed |
| `not_planned` | Won't do |

### 5. Relationships
- **Parent-child**: Implied by folder structure
- **Blocks**: Explicit list of spec IDs this spec blocks

### 6. Claim Mechanism (Git Branch-Based)
```
Agent wants to work on spec a1b2:
  1. Check if branch `work/a1b2` exists → if yes, already claimed
  2. Create branch `work/a1b2`
  3. Update spec status to `in_progress`
  4. Work, commit to branch
  5. On completion: merge branch, delete, set status to `closed`
```

**Manual release:** `sc release a1b2` deletes branch, resets status

### 7. EARS Requirements Format

All requirements in the Requirements section MUST use EARS syntax for maximum unambiguity.

**The 6 EARS Patterns:**

| Type | Template | Use When |
|------|----------|----------|
| **Ubiquitous** | `The <system> shall <response>` | Always-true constraints |
| **State-driven** | `While <state>, the <system> shall <response>` | Behavior during states |
| **Event-driven** | `When <trigger>, the <system> shall <response>` | Response to events |
| **Optional** | `Where <feature>, the <system> shall <response>` | Product variants |
| **Unwanted** | `If <condition>, then the <system> shall <response>` | Error handling |
| **Complex** | `While <state>, when <trigger>, the <system> shall <response>` | Combined conditions |

**Examples:**
```
# Ubiquitous (always true)
The system shall respond to API requests within 200ms.

# Event-driven (on trigger)
When the user clicks "Submit", the system shall validate all form fields.

# State-driven (during state)
While the user is unauthenticated, the system shall redirect protected routes to login.

# Unwanted behavior (error handling)
If the database connection fails, then the system shall retry 3 times with exponential backoff.

# Complex (state + event)
While the cart contains items, when the user clicks "Checkout", the system shall initiate payment flow.
```

### 8. CLI Design Principles (from Beads)

**Minimize cognitive overload.** Every new command, flag, or option adds burden. Before adding anything:

1. **Recovery/fix operations → `sc doctor --fix`**: Don't create separate commands like `sc recover`. Doctor detects problems - `--fix` handles remediation. All health operations in one place.

2. **Prefer flags on existing commands**: Before creating a new command, ask: "Can this be a flag on an existing command?" Example: `sc list --ready` instead of `sc ready`.

3. **Consolidate related operations**: Related operations live together. Use subcommands: `sc deps {add,remove,list}`, not separate top-level commands.

4. **Count the commands**: Run `sc --help` and count. If approaching 15+ commands, we have a discoverability problem. Consider subcommand grouping.

5. **New commands need strong justification**: A new command should represent a fundamentally different operation, not just a convenience wrapper.

### 9. Commands (Applying Design Principles)

```bash
# Core operations (fundamentally different actions)
sc create [--parent <id>]    # Create new spec
sc show <id>                 # View spec details
sc edit <id>                 # Edit spec in $EDITOR
sc list                      # List all specs
sc list --ready              # List specs ready for work
sc list --tree               # Show hierarchy as tree
sc list --status             # Show status summary

# Work coordination
sc claim <id>                # Claim spec (create branch, update status)
sc release <id>              # Release claim
sc done <id>                 # Mark complete

# Dependencies (subcommand group)
sc deps add <id> <blocker>   # Add blocking dependency
sc deps remove <id> <blocker># Remove dependency
sc deps list <id>            # Show dependencies for spec

# Validation & health
sc validate [id]             # Check EARS format + consistency
sc validate --fix            # Auto-fix what's possible
sc doctor                    # Check repo health (orphans, circular deps)
sc doctor --fix              # Fix health issues

# EARS conversion (LLM-powered)
sc ears <text>               # Convert freeform text to EARS format
```

**Command count: 10** (plus flags/subcommands) - well under the 15 threshold.

---

## Spec Document Format

```markdown
---
id: a1b2
status: ready
parent: null
blocks: []
---

# Spec: [Human-Readable Title]

## Overview
[2-3 sentences: what this is and why it matters]

## Background & Context
[Why this is being built now. Business context, user pain points.]

## Goals
- [Specific, measurable objective]

## Technical Approach (optional)
[Only when needed: greenfield, major tech decisions, schema changes]

## Requirements (EARS format)

Requirements MUST use EARS syntax. Group by feature area.

### Authentication
1. When the user submits valid credentials, the system shall create a session and redirect to dashboard.
2. If the credentials are invalid, then the system shall display an error message and remain on login page.
3. While the user is authenticated, the system shall include the session token in all API requests.

### Session Management
4. The system shall expire sessions after 24 hours of inactivity.
5. When the user clicks "Logout", the system shall invalidate the session and redirect to login.

## Tasks

### Inline Tasks
- [ ] Small task that doesn't need its own spec
- [ ] Another small task

### Child Specs
- [Auth OAuth Setup](./oauth-setup-e5f6/) — Status: ready
- [Session Management](./session-mgmt-g7h8/) — Status: blocked

## Prerequisites
[Prose description of what must be done first, if any]

## Open Questions
- [Unresolved items]
```

---

## Implementation Plan

### Phase 1: Project Setup
- Initialize Bun project with TypeScript, ESLint (strict rules per CLAUDE.md)
- Set up CLI using Bun's native arg parsing or Commander.js
- Configure as global package (`bun install -g`)

### Phase 2: Core Data Model
**Files to create:**
- `src/types.ts` — TypeScript types for Spec, Status, EARS patterns
- `src/id.ts` — Hash ID generation (adaptive length, collision-resistant)
- `src/parse.ts` — Parse spec markdown with YAML frontmatter
- `src/serialize.ts` — Serialize spec back to markdown

### Phase 3: File System Operations
**Files to create:**
- `src/fs.ts` — Read/write specs, create directories
- `src/tree.ts` — Build spec tree from filesystem
- `src/query.ts` — Query specs (ready, blocked, etc.)

### Phase 4: Git Branch Operations
**Files to create:**
- `src/git.ts` — Branch operations (create, delete, check exists)
- `src/claim.ts` — Claim/release logic

### Phase 5: EARS Tooling
**Files to create:**
- `src/ears/patterns.ts` — Regex patterns for 6 EARS types
- `src/ears/validate.ts` — Check requirements against EARS patterns
- `src/ears/convert.ts` — LLM-powered conversion (calls Claude API)

### Phase 6: CLI Commands
**Files to create:**
- `src/commands/create.ts` — `sc create`
- `src/commands/show.ts` — `sc show <id>`
- `src/commands/list.ts` — `sc list [--ready|--tree|--status]`
- `src/commands/claim.ts` — `sc claim <id>`
- `src/commands/validate.ts` — `sc validate [id]`
- `src/commands/ears.ts` — `sc ears <text>`
- (etc. for remaining commands)

### Phase 7: Documentation & Testing
- README with usage examples
- EARS guide for humans and agents
- Integration tests for all commands

---

## Verification

### Manual Testing
1. Create a root spec: `sc create`
2. Add child specs: `sc create --parent <root-id>`
3. View hierarchy: `sc list --tree`
4. List available work: `sc list --ready`
5. Claim a spec: `sc claim <id>`
6. Verify branch created: `git branch | grep work/`
7. Release claim: `sc release <id>`
8. Mark done: `sc done <id>`

### EARS Validation Testing
9. Run `sc validate <id>` on a spec with valid EARS requirements
10. Run `sc validate <id>` on a spec with freeform requirements (should warn)
11. Run `sc ears "Users can login with email"` → should suggest EARS format

### Edge Cases to Test
- Two agents trying to claim same spec (should fail for second)
- Circular dependencies (should detect and warn)
- Orphan specs (child with missing parent)
- Release of non-claimed spec
- Invalid EARS syntax detection

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Document type | Single "Spec" (recursive) |
| CLI name | `sc` |
| Runtime | Bun (TypeScript) |
| File structure | `docs/specs/[slug]-[hash]/[slug]-[hash].md` |
| IDs | Adaptive-length hash (beads-style, 4-7+ chars) |
| Statuses | ready, in_progress, blocked, closed, deferred, not_planned |
| Claims | Git branch `work/<id>` + status update |
| Relationships | Parent-child (folders) + explicit blocks |
| Cache | None (traverse filesystem) |
| Requirements format | EARS (mandatory in Requirements section) |
| EARS tooling | Validation + LLM-powered conversion |

---

## Open Questions (Resolved)

~~Tech stack~~ → Bun (TypeScript)
~~Storage location~~ → `docs/specs/`
~~Index file~~ → None (traverse filesystem)
~~Claim mechanism~~ → Git branches + status
~~File naming~~ → Match directory name for clear editor tabs

