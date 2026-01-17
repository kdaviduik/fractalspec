# sc - Spec Management CLI

CLI tool for managing recursive specification documents using EARS (Easy Approach to Requirements Syntax) format.

## Project Overview

`sc` enables hierarchical spec management where large features decompose into smaller, manageable specs. Each spec can have child specs (creating a tree) and dependencies (blocking relationships). This differs from traditional PRD→SDD→ticket cascades by allowing recursive decomposition at any level.

**Key concepts:**
- **Spec**: A markdown document with YAML frontmatter defining a unit of work
- **Parent/child**: Hierarchical relationship for decomposition
- **Blocks**: Dependency relationships (spec A blocks spec B = B cannot start until A is done)
- **EARS**: Structured requirement syntax ensuring testable, unambiguous requirements

## Quick Start

```bash
# Find available work
sc list --ready

# Claim a spec and start working
sc claim ABC123

# View spec details
sc show ABC123

# When done
sc done ABC123
```

## Commands Reference

### Discovery & Viewing

| Command | Description | Example |
|---------|-------------|---------|
| `sc list` | List all specs | `sc list` |
| `sc list --ready` | Show specs ready for work | `sc list --ready` |
| `sc list --tree` | Show hierarchical tree view | `sc list --tree` |
| `sc list --status` | Show status counts | `sc list --status` |
| `sc show <id>` | Display spec details | `sc show ABC123` |

### Workflow

| Command | Description | Example |
|---------|-------------|---------|
| `sc claim <id>` | Claim spec, set to `in_progress`, create worktree | `sc claim ABC123` |
| `sc done <id>` | Mark complete, set to `closed`, remove worktree | `sc done ABC123` |
| `sc release <id>` | Abandon work, reset to `ready`, remove worktree | `sc release ABC123` |

### Creation & Editing

| Command | Description | Example |
|---------|-------------|---------|
| `sc create` | Create new spec (interactive) | `sc create` |
| `sc create -t "Title"` | Create with title | `sc create -t "User Auth"` |
| `sc create -p PARENT_ID` | Create as child of parent | `sc create -p ABC123 -t "OAuth Flow"` |
| `sc edit <id>` | Open in $EDITOR | `sc edit ABC123` |

### Dependencies

| Command | Description | Example |
|---------|-------------|---------|
| `sc deps list <id>` | Show blockers and dependents | `sc deps list ABC123` |
| `sc deps add <id> <blocker>` | Add blocking dependency | `sc deps add ABC123 DEF456` |
| `sc deps remove <id> <blocker>` | Remove dependency | `sc deps remove ABC123 DEF456` |

### Validation & Health

| Command | Description | Example |
|---------|-------------|---------|
| `sc validate` | Validate all specs' EARS format | `sc validate` |
| `sc validate <id>` | Validate single spec | `sc validate ABC123` |
| `sc doctor` | Check repo health (orphans, cycles) | `sc doctor` |
| `sc doctor --fix` | Auto-fix issues where possible | `sc doctor --fix` |
| `sc ears` | Show EARS pattern reference | `sc ears` |
| `sc ears "<text>"` | Convert text to EARS format | `sc ears "users can login"` |

## Spec Format

Specs are stored as markdown files with YAML frontmatter:

```markdown
---
id: ABC123
status: ready
parent: null
blocks: []
---

# Spec: Feature Title

## Overview
[2-3 sentences describing what and why]

## Requirements (EARS format)

### User Authentication
1. When the user submits valid credentials, the system shall create a session.
2. If authentication fails, then the system shall display an error message.

## Tasks
- [ ] Implementation task 1
- [ ] Implementation task 2
```

### Frontmatter Schema

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `id` | string | 6-char alphanumeric | Unique identifier |
| `status` | string | see below | Current state |
| `parent` | string\|null | spec ID or null | Parent spec for hierarchy |
| `blocks` | string[] | spec IDs | Specs that must complete first |

### Status Values

| Status | Icon | Meaning |
|--------|------|---------|
| `ready` | ○ | Available for work (no blockers) |
| `in_progress` | ◐ | Currently being worked on |
| `blocked` | ⊘ | Waiting on dependencies |
| `closed` | ● | Completed |
| `deferred` | ◇ | Postponed |
| `not_planned` | ✕ | Will not be implemented |

## Worktree Convention

When you claim a spec, `sc` creates a dedicated git worktree for that work:

- **Location**: `../work-<spec-id>/` (sibling to the main worktree)
- **Branch**: `work/<spec-id>` (checked out in the worktree)
- **Isolation**: Git prevents the same branch from being checked out in multiple worktrees, ensuring exclusive access
- **Cleanup**: Running `sc done` or `sc release` from outside the work worktree automatically removes both the worktree and branch

**Best Practice**: Always return to the main worktree (`cd ../main`) before running `sc done` or `sc release` for automatic cleanup.

## EARS Patterns

EARS (Easy Approach to Requirements Syntax) ensures requirements are testable and unambiguous. Each pattern has a specific structure.

### Pattern Templates

| Pattern | Template | Use When |
|---------|----------|----------|
| **Ubiquitous** | `The <system> shall <response>` | Always-true constraints |
| **Event-driven** | `When <trigger>, the <system> shall <response>` | Response to events |
| **State-driven** | `While <state>, the <system> shall <response>` | Behavior during states |
| **Optional** | `Where <feature>, the <system> shall <response>` | Feature-dependent behavior |
| **Unwanted** | `If <condition>, then the <system> shall <response>` | Error/edge cases |
| **Complex** | `While <state>, when <trigger>, the <system> shall <response>` | State + event combo |

### Examples

```markdown
## Requirements

### Core Behavior (Ubiquitous)
1. The system shall encrypt all data at rest using AES-256.

### User Interactions (Event-driven)
2. When the user clicks "Submit", the system shall validate all form fields.
3. When validation succeeds, the system shall save the record and display confirmation.

### Error Handling (Unwanted)
4. If the database connection fails, then the system shall retry 3 times before displaying an error.

### Session Management (State-driven)
5. While the user is authenticated, the system shall display the navigation menu.

### Premium Features (Optional)
6. Where the user has a premium subscription, the system shall enable advanced analytics.
```

## Agent Workflow

### Finding Work

```bash
# See what's available
sc list --ready

# Check overall project status
sc list --status

# See hierarchy
sc list --tree
```

### Claiming & Working

```bash
# 1. Claim the spec (creates worktree at ../work-ABC123, sets status to in_progress)
sc claim ABC123

# 2. Switch to the work worktree
cd ../work-ABC123

# 3. Do the work...

# 4. Commit changes
git add . && git commit -m "feat: implement feature per ABC123"

# 5. Return to main worktree when done working
cd ../main
```

### Completing Work

```bash
# Make sure you're in the main worktree (not inside ../work-ABC123)
cd ../main

# Mark complete (sets status to closed, removes worktree)
sc done ABC123
```

**Note:** If you run `sc done` from inside the work worktree, the branch will be deleted and status updated, but you'll need to manually clean up the worktree directory after returning to main.

### Abandoning Work

```bash
# Make sure you're in the main worktree (not inside ../work-ABC123)
cd ../main

# Release back to pool (resets to ready, removes worktree)
sc release ABC123
```

**Note:** Same as above—run from the main worktree for automatic cleanup.

## File Structure

```
docs/specs/
├── feature-name-ABC123/
│   └── feature-name-ABC123.md
├── sub-feature-DEF456/
│   └── sub-feature-DEF456.md
└── another-GHI789/
    └── another-GHI789.md
```

**Convention:** `<slug>-<id>/<slug>-<id>.md`

- Slug: lowercase, hyphenated, max 30 chars
- ID: 6-character alphanumeric

## Development Commands

```bash
# Run tests
bun run test

# Lint
bun run lint

# Fix lint issues
bun run lint:fix

# Type check
bun run typecheck
```

## Critical Type Definitions

From `src/types.ts`:

```typescript
type Status = 'ready' | 'in_progress' | 'blocked' | 'closed' | 'deferred' | 'not_planned';

type EarsPattern = 'ubiquitous' | 'state_driven' | 'event_driven' | 'optional' | 'unwanted' | 'complex';

interface SpecFrontmatter {
  id: string;
  status: Status;
  parent: string | null;
  blocks: string[];
}
```
