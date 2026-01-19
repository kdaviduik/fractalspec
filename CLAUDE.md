# sc - Spec Management CLI

CLI tool for managing recursive specification documents using EARS (Easy Approach to Requirements Syntax) format.

## Project Overview

`sc` enables hierarchical spec management where large features decompose into smaller, manageable specs. Each spec can have child specs (creating a tree) and dependencies (blocking relationships). This differs from traditional PRD→SDD→ticket cascades by allowing recursive decomposition at any level.

**Key concepts:**
- **Spec**: A markdown document with YAML frontmatter defining a unit of work
- **Parent/child**: Hierarchical relationship for decomposition
- **Blocks**: Dependency relationships (spec A blocks spec B = B cannot start until A is done)
- **EARS**: Structured requirement syntax ensuring testable, unambiguous requirements

## Installation & Setup

### Prerequisites
- [Bun](https://bun.sh) runtime

### Installation

```bash
# Clone repository (or navigate to existing clone)
cd /path/to/sc

# Install dependencies
bun install

# Build CLI
bun run build

# Link for global usage
bun link

# Verify installation
sc --help
```

### Development Setup

```bash
# Install dependencies
bun install

# Run tests
bun run test

# Run linter
bun run lint

# Type check
bun run typecheck
```

**Configuration:**
- Specs are stored in `docs/specs/` directory (resolved from git repository root)
- Each spec lives in `<slug>-<id>/<slug>-<id>.md`
- Worktrees are created at `<repo-root>/../work-<id>/` (sibling to repository root)

## Quick Start

```bash
# Find available work
sc list --ready

# Claim a spec and start working
sc claim ABC123

# View spec details
sc show ABC123

# Create a new spec with specific status
sc create --status blocked -t "Future Implementation"

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
| `sc create --status <status>` | Create with specific initial status | `sc create --status blocked -t "Future Task"` |
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
1. When the user submits valid credentials, the authentication module shall create a session.
2. If authentication fails, then the login UI shall display an error message.

## Tasks
- [ ] Implementation task 1
- [ ] Implementation task 2
```

### Frontmatter Schema

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `id` | string | 6-char alphanumeric | Unique identifier |
| `status` | string | see below | Current state (settable at creation via 'sc create --status') |
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

- **Location**: `<repo-root>/../work-<spec-id>/` (sibling to repository root)
- **Branch**: `work/<spec-id>` (checked out in the worktree)
- **Isolation**: Git prevents the same branch from being checked out in multiple worktrees, ensuring exclusive access
- **Cleanup**: Running `sc done` or `sc release` automatically removes both the worktree and branch
- **Command execution**: Commands can be run from any directory in the repository

**Note**: If you run `sc done` or `sc release` from inside the work worktree being removed, you will be left in a deleted directory. Navigate elsewhere if this happens.

## EARS Patterns

EARS (Easy Approach to Requirements Syntax) ensures requirements are testable and unambiguous.

### Pattern Templates

| Pattern | Template | Use When |
|---------|----------|----------|
| **Ubiquitous** | `[Component] shall <response>` | Always-true constraints |
| **Event-driven** | `When <trigger>, [component] shall <response>` | Response to events |
| **State-driven** | `While <state>, [component] shall <response>` | Behavior during states |
| **Optional** | `Where <feature>, [component] shall <response>` | Feature-dependent behavior |
| **Unwanted** | `If <condition>, then [component] shall <response>` | Error/edge cases |
| **Complex** | `While <state>, when <trigger>, [component] shall <response>` | State + event combo |

**Component Naming**: Use specific component names ("Tier 1", "the backend server", "the auth module") instead of generic "the system" when components are defined in your architecture. The validator will warn about generic usage.

### Validation Levels

The validator distinguishes between critical errors and style warnings:

- **Errors** (fail validation): Missing EARS structure, vague responses ("shall work well", "shall be fast"), empty requirements
- **Warnings** (pass with suggestions): Generic "system" usage when specific components exist, very long requirements (>200 chars)

### Examples

```markdown
## Requirements

### Core Behavior (Ubiquitous)
1. Tier 1 shall encrypt all parsed data at rest using AES-256.
2. The audit logger shall log all authentication attempts.

### User Interactions (Event-driven)
3. When the user clicks "Submit", the form validator shall check all 5 required fields.
4. When validation succeeds, the backend server shall save the record within 200ms.

### Error Handling (Unwanted)
5. If the database connection fails, then the retry handler shall attempt reconnection 3 times with exponential backoff before displaying an error.

### Session Management (State-driven)
6. While the user is authenticated, the navigation component shall display the user menu.

### Premium Features (Optional)
7. Where the user has a premium subscription, the analytics dashboard shall enable advanced filtering.
```

**Vague Requirements (Rejected by Semantic Validation)**:
- ❌ "The system shall work well" → Not testable
- ❌ "The UI shall be fast" → Not measurable
- ✅ "The UI shall render initial view within 100ms" → Specific, testable

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
# 1. Claim the spec (creates worktree as sibling to repo root)
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
# Mark complete (sets status to closed, removes worktree)
# Can be run from any directory in the repository
sc done ABC123
```

**Note:** If run from inside the work worktree being removed, you will be left in a deleted directory. Navigate to a different directory afterward if needed.

### Abandoning Work

```bash
# Release back to pool (resets to ready, removes worktree)
# Can be run from any directory in the repository
sc release ABC123
```

**Note:** If run from inside the work worktree being removed, you will be left in a deleted directory. Navigate to a different directory afterward if needed.

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

## Testing

### Framework
This project uses Bun's built-in test runner.

### Test Location
Tests are co-located with source files: `src/foo.ts` → `src/foo.test.ts`

### Running Tests

```bash
# Run all tests
bun run test

# Run specific test file
bun test src/ears/validation.test.ts

# Run tests in watch mode
bun test --watch
```

### Testing Standards
- **Unit tests:** Test individual functions in isolation
- **Integration tests:** Test command execution end-to-end
- **Validation tests:** Ensure EARS patterns catch all error cases

### Coverage
Run tests with coverage reporting:
```bash
bun test --coverage
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

## Help System Standards

The `sc` help system provides git-quality, self-documenting CLI help. When adding or updating commands, **you MUST implement and test comprehensive help documentation**.

### Architecture Overview

**Help Infrastructure** (`src/help.ts`):
- `CommandHelp` interface defines help content structure
- `SubcommandHelp` interface for commands with subcommands (e.g., `deps`)
- ANSI formatting utilities: `bold()`, `underline()`, `dim()`
- Automatic pager support via `displayWithPager()` (uses `less -R`)
- Formatting utilities for sections, flags, and subcommands

**Command Interface** (`src/types.ts`):
```typescript
interface CommandHandler {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<number>;
  getHelp?: () => CommandHelp;  // Required for all commands
}
```

**Help Detection** (`src/cli.ts`):
- Detects `--help` and `-h` at any argument position
- Supports both command help (`sc claim --help`) and subcommand help (`sc deps add --help`)
- Falls back gracefully for commands without `getHelp()`

### Requirements for New/Updated Commands

#### 1. Implement `getHelp()` Method

**Every command MUST provide a `getHelp()` method** that returns a `CommandHelp` object:

```typescript
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';

export const command: CommandHandler = {
  name: 'example',
  description: 'Short one-line description',

  getHelp(): CommandHelp {
    return {
      name: 'sc example',
      synopsis: 'sc example <required> [optional] [--flag]',
      description: `Detailed multi-line description.

  Explain what the command does, when to use it, and its effects.
  Use proper indentation for readability.`,

      flags: [
        {
          flag: '--flag, -f',
          description: 'What this flag does and when to use it',
        },
      ],

      examples: [
        '# Use case description',
        'sc example foo',
        '',
        '# Another use case',
        'sc example bar --flag',
      ],

      notes: [
        'Important behavioral detail users should know.',
        'Edge cases, cleanup requirements, or critical warnings.',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    // Use printCommandUsage for consistent error messages
    if (!args[0]) {
      printCommandUsage(this.getHelp!());
      return 1;
    }
    // ... implementation
  },
};
```

#### 2. Commands with Subcommands

For commands like `deps` with multiple subcommands, include `subcommands` in the help:

```typescript
getHelp(): CommandHelp {
  return {
    name: 'sc example',
    synopsis: 'sc example <add|remove|list> <args>',
    description: 'Manage example resources.',

    subcommands: {
      add: {
        synopsis: 'sc example add <name> <value>',
        description: 'Add a new example resource.',
        examples: ['sc example add foo bar'],
      },
      remove: {
        synopsis: 'sc example remove <name>',
        description: 'Remove an example resource.',
        examples: ['sc example remove foo'],
      },
      list: {
        synopsis: 'sc example list',
        description: 'List all example resources.',
        examples: ['sc example list'],
      },
    },

    examples: [
      '# Add resource',
      'sc example add myname myvalue',
      '',
      '# List all',
      'sc example list',
    ],
  };
},
```

Then in `execute()`, use subcommand-specific usage strings:

```typescript
async execute(args: string[]): Promise<number> {
  const subcommand = args[0];

  if (!subcommand) {
    printCommandUsage(this.getHelp!());
    return 1;
  }

  switch (subcommand) {
    case 'add': {
      if (!args[1] || !args[2]) {
        const help = this.getHelp!();
        console.error(`Usage: ${help.subcommands!['add'].synopsis}`);
        return 1;
      }
      // ... implementation
    }
    // ... other cases
  }
}
```

### Content Standards

#### Synopsis Format

Use standard POSIX conventions:
- `<required>` - Required argument
- `[optional]` - Optional argument
- `--flag` - Flag (boolean or with value)
- `<choice1|choice2>` - Mutually exclusive choices
- Use `dim()` formatting for optional parts in formatted output (handled automatically)

#### Description Content

**What to include:**
1. **Primary purpose** - What the command does in 1-2 sentences
2. **Effects** - What changes in the system (status updates, file operations, etc.)
3. **Prerequisites** - What must be true before running (e.g., "spec must be claimed")
4. **When to use** - Guidance on appropriate usage scenarios

**Example:**
```typescript
description: `Claim a spec and prepare it for work. This command:
  - Sets the spec status to 'in_progress'
  - Creates a dedicated git worktree (sibling to repository root)
  - Creates and checks out branch work/<id> in that worktree
  - Ensures exclusive access (git prevents same branch in multiple worktrees)

After claiming, switch to the work worktree to begin implementation.
Commands can be run from any directory in the repository.`
```

#### Examples Content

**Guidelines:**
- Group examples by use case with comment headers
- Use realistic IDs (e.g., `a1b2c3`, not `foo`)
- Show complete workflows, not just isolated commands
- Include blank lines between distinct use cases for readability
- Show both simple and complex usage patterns

**Example:**
```typescript
examples: [
  '# Basic usage',
  'sc example a1b2c3',
  '',
  '# With optional flag',
  'sc example a1b2c3 --verbose',
  '',
  '# Complete workflow',
  'sc example create foo',
  'sc example show foo',
  'sc example delete foo',
]
```

#### Notes Content

**When to use notes:**
- Critical warnings (data loss, destructive operations)
- Important behavioral details not obvious from description
- Edge cases (e.g., "running from inside work worktree")
- Cleanup or post-operation guidance when relevant
- Cross-references to related commands

**Don't include:**
- Implementation details users don't need
- Redundant information already in description
- Obvious statements

### ANSI Formatting Standards

The help system uses ANSI escape codes for improved readability:

**Automatic formatting** (handled by help utilities):
- Section headers (NAME, DESCRIPTION, etc.) → `bold()`
- Command names in COMMANDS section → `underline()`
- Optional parameters in synopsis → `dim()`

**Respects user preferences:**
- Checks `NO_COLOR` environment variable
- Gracefully degrades when colors disabled
- Preserves formatting through pager (`less -R`)

**Don't manually add ANSI codes** - use the formatting functions:
```typescript
import { bold, underline, dim } from '../help.js';

// Good
const text = `${bold('SECTION')} ${underline('command')} ${dim('[optional]')}`;

// Bad - don't hardcode escape sequences
const text = '\x1b[1mSECTION\x1b[0m';
```

### Pager Behavior

The `displayWithPager()` function automatically:
- Detects if stdout is a TTY
- Counts content lines vs terminal height
- Pipes through `less -R` if content exceeds screen height
- Skips pager when output is piped or redirected
- Gracefully falls back if `less` unavailable

**You don't need to handle paging manually** - it's automatic in `printCommandHelp()` and global `printHelp()`.

### Testing Requirements

**When adding or updating a command, you MUST test:**

1. **Command help**: `bun run src/cli.ts <command> --help`
   - Verify all sections present (synopsis, description, examples, etc.)
   - Check formatting renders correctly
   - Ensure content is accurate and complete

2. **Subcommand help** (if applicable): `bun run src/cli.ts <command> <subcommand> --help`
   - Verify subcommand-specific help displays
   - Check synopsis is correct for that subcommand

3. **Short flag**: `bun run src/cli.ts <command> -h`
   - Same output as `--help`

4. **Usage on error**: `bun run src/cli.ts <command>` (missing required args)
   - Should print usage string and exit with code 1
   - Usage should match synopsis from `getHelp()`

5. **Pager behavior**:
   - TTY output: Long help should automatically page
   - Piped output: `bun run src/cli.ts <command> --help | cat` should skip pager

**Test checklist example:**
```bash
# Test command help
bun run src/cli.ts mycommand --help
bun run src/cli.ts mycommand -h

# Test subcommand help (if applicable)
bun run src/cli.ts mycommand add --help
bun run src/cli.ts mycommand remove --help

# Test usage on error
bun run src/cli.ts mycommand  # Should show usage

# Test pager skip when piped
bun run src/cli.ts mycommand --help | cat
```

### Global Help Maintenance

When adding a new command, update `printHelp()` in `src/command-router.ts`:

1. Add command to appropriate section (Discovery, Workflow, Creation, etc.)
2. Include command name with `underline()` formatting
3. Add synopsis with required/optional args using `dim()` for optional parts
4. Include brief description of primary flags (if any)
5. Add example usage in EXAMPLES section
6. Keep consistent indentation and spacing

**Example addition:**
```typescript
  ${underline('Validation & Health')}
    ${underline('mycommand')} ${dim('[id]')}         Check something useful
                           No args: check all
                           With <id>: check specific item
      --fix                Auto-fix issues found
```

### Design Decisions Reference

**Why these choices:**

1. **Pager by default** - Matches git behavior; long help is readable without scrolling
2. **ANSI formatting** - Improves scannability; respects NO_COLOR for accessibility
3. **Subcommand help** - `sc deps add --help` is more discoverable than reading full `sc deps --help`
4. **Consistent usage errors** - `printCommandUsage()` ensures errors match help docs
5. **Separation of content and presentation** - `CommandHelp` data can later generate man pages, JSON, web docs

**Reference implementations:**

Study these commands for patterns:
- **Simple command**: `show`, `edit` - basic help with examples
- **Command with flags**: `list` - multiple mutually exclusive flags
- **Command with subcommands**: `deps` - hierarchical help structure
- **Workflow command**: `claim`, `done`, `release` - critical notes about cleanup

### Quick Checklist for New Commands

- [ ] Implement `getHelp()` method returning `CommandHelp`
- [ ] Import `printCommandUsage` from `help.js`
- [ ] Replace hardcoded usage strings with `printCommandUsage(this.getHelp!())`
- [ ] Include all help sections: synopsis, description, examples
- [ ] Add flags section if command has flags
- [ ] Add subcommands section if command has subcommands
- [ ] Add notes section for critical warnings or edge cases
- [ ] Update `printHelp()` in `command-router.ts` with new command
- [ ] Test `--help`, `-h`, and usage-on-error behavior
- [ ] Test subcommand help if applicable
- [ ] Verify paging works for long output
- [ ] Check that piped output skips pager

## Documentation Maintenance Checklist

Before marking any task as "done", verify you've updated all relevant documentation:

### 1. Identify Documentation Dependencies

For the code you modified, check if it affects:

- [ ] **CLAUDE.md** - Project documentation, architecture, workflows
- [ ] **Skills** (.claude/skills/*.md) - Agent workflow guides
- [ ] **Command Help** (`getHelp()` methods in src/commands/*.ts) - CLI help text
- [ ] **Global Help** (src/command-router.ts `printHelp()`) - Top-level command reference
- [ ] **Templates** (e.g., create.ts spec template) - Example content shown to users
- [ ] **README.md** - Public-facing project documentation

### 2. Documentation Dependency Map

| Code Change Type | Documentation to Check |
|------------------|------------------------|
| **New/modified CLI command** | Command's `getHelp()`, global help in command-router.ts, CLAUDE.md commands section |
| **New/modified validation logic** | CLAUDE.md validation section, related skill files, command help for validation commands |
| **New/modified workflow** | CLAUDE.md workflow section, .claude/skills/*-workflow.md |
| **New pattern/syntax** | CLAUDE.md, skills, command help, create.ts template examples |
| **New feature** | CLAUDE.md overview, README.md if user-facing |

### 3. Update Checklist Questions

Ask yourself:
1. **Does this change how users interact with the system?** → Update CLAUDE.md, skills
2. **Does this change command behavior or output?** → Update command `getHelp()`
3. **Does this introduce new patterns or examples?** → Update all files showing examples
4. **Does this change validation rules?** → Update validation docs, example templates
5. **Does this affect agent workflow?** → Update skill files

### 4. Cross-Reference Verification

After updating documentation:
- [ ] Search codebase for old terminology (e.g., if you changed "system shall" → "[component] shall", grep for remaining "system shall" in docs)
- [ ] Check that examples in docs match what the code actually accepts/produces
- [ ] Verify help text matches actual command behavior

### 5. Follow Single Source of Truth Principle

When documenting facts that might change:
- **Code constants** (like EARS_PATTERN_TEMPLATES): Reference generically in prose, import in code
- **Lists of items** (commands, patterns, features): Keep authoritative list in one file, reference with phrases like "various patterns" elsewhere
- **Examples**: Keep in docs, but ensure they match what code validates/accepts

## Git Commit Checklist for Documentation

When committing changes:
- [ ] Commit message mentions documentation updates (e.g., "feat: add X feature + update CLAUDE.md, skills")
- [ ] All files touched in commit include both code AND related documentation
- [ ] If you modified a pattern/syntax, you've searched for and updated all examples
