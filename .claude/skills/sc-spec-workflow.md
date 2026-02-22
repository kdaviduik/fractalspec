---
name: sc-spec-workflow
description: Guide for spec-driven development using the sc CLI tool. Covers claim → implement → complete workflow, EARS requirements patterns, and fractalspec tooling. Use when user mentions "sc", "spec", "fractalspec", or when working with specification files.
---

# sc Spec Workflow

Guide for working with the `sc` spec management CLI. Use this skill when implementing features defined by specs.

## Workflow: Claim → Implement → Complete

### 1. Find Available Work

```bash
# See all ready specs (sorted by priority)
sc list --ready

# Get THE next highest-priority task
sc list --ready --limit 1

# Filter to specific priority level or range
sc list --ready --priority 8-10
```

`--ready` shows only leaf specs (parent specs with children are excluded). Blocked specs whose blockers are all resolved are automatically included. Results are sorted by priority (10 highest → 1 lowest), then by depth (leaf specs first), then alphabetically. Use `--limit 1` for "what should I work on next?" behavior.

### 2. Claim the Spec

```bash
# Status-only (default) — sets in_progress, no git artifacts
sc claim <spec-id>

# Branch mode — creates and checks out a work branch
sc claim <spec-id> --branch

# Worktree mode — creates isolated worktree
sc claim <spec-id> --worktree

# With shell integration (worktree mode auto-cd)
eval "$(sc init bash)"  # One-time setup
sc claim <spec-id> --worktree
```

This sets status to `in_progress`. By default, no branch or worktree is created (status-only mode). Branch mode (`--branch`) creates and checks out a work branch in your current repo — requires a clean working tree. Worktree mode (`--worktree`) creates a dedicated worktree (sibling to repository root) for isolated work.

### 3. Understand Requirements

```bash
sc show <spec-id>
```

Read the spec carefully. Requirements follow EARS patterns (see below). Each requirement should be testable.

### 4. Implement

Write code that satisfies each requirement. Follow TDD when possible:
1. Write a test for a requirement
2. Implement until the test passes
3. Repeat for each requirement

### 5. Validate

Before completing, run:
```bash
sc validate <spec-id>  # Check EARS format
sc doctor              # Check for orphans/cycles
bun run test           # Ensure tests pass
bun run lint           # No lint errors
```

### 6. Complete

```bash
# Push your work first
git push -u origin work-<slug>-<spec-id>

# Optional: Set PR URL for tracking
sc set <spec-id> --pr https://github.com/org/repo/pull/123

# Mark complete
sc done <spec-id>
```

**Safety checks**: `sc done` verifies no uncommitted changes or unpushed commits exist before proceeding. This prevents accidental data loss. If you have unsaved work:
- The command will error with actionable instructions
- Use `--force` to bypass (with warning): `sc done <spec-id> --force`

This sets status to `closed` and removes the work branch (and worktree if one exists). Commands can be run from any directory in the repository.

## PR Tracking

Track pull requests associated with specs:

```bash
# Set PR URL when creating a PR
sc set <spec-id> --pr https://github.com/org/repo/pull/123

# View PR in spec details
sc show <spec-id>

# Clear PR URL
sc set <spec-id> --pr none
```

The `pr` field is preserved after `sc done`, useful for history.

## Creating Specs

When creating specs, you can set priority, content sections, and context programmatically:

```bash
# Create with explicit high priority (10 = highest)
sc create -t "Critical Security Fix" --priority 10

# Child specs inherit parent's priority by default
sc create -p ABC123 -t "Sub-task"

# Create with content (replaces boilerplate placeholders)
sc create -t "User Auth" --overview "Add JWT authentication" --goals "Login support" --goals "Session persistence" --tasks "Add login endpoint" --tasks "Add JWT middleware"

# Create with EARS requirements inline
sc create -t "Form Validation" --requirements "When user submits form, the validator shall check all required fields."

# Combine content flags with messages
sc create -t "API Refactor" --overview "Restructure API layer" -m "PR: https://github.com/org/repo/pull/789"
```

**Priority values**: Numeric 1-10, where 10 is highest priority.
- `10`: Critical/urgent work (security issues, blockers)
- `8-9`: High priority features
- `5`: Default/normal priority
- `2-4`: Lower priority improvements
- `1`: Backlog items

**Default behavior**: Root specs default to `5`. Child specs inherit their parent's priority unless overridden with `--priority`.

## Writing EARS Requirements

When creating or editing specs, use EARS patterns for clear, testable requirements.

### Pattern Quick Reference

| Pattern | Format | Use For |
|---------|--------|---------|
| Ubiquitous | `[Component] shall <action>` | Always-true rules |
| Event-driven | `When <trigger>, [component] shall <action>` | User actions, triggers |
| State-driven | `While <state>, [component] shall <action>` | Behavior during states |
| Unwanted | `If <condition>, then [component] shall <action>` | Errors, edge cases |
| Optional | `Where <feature>, [component] shall <action>` | Feature-gated behavior |
| Complex | `While <state>, when <trigger>, [component] shall <action>` | State + trigger combo |

**Component Naming**: Use specific names ("Tier 1", "the auth module") over generic "the system". The validator warns about generic usage.

**Validation**: Requirements must be specific and testable. Vague phrases like "shall work well", "shall be fast", "shall be user-friendly" will be rejected.

### Good vs Bad Examples

**Bad (vague, untestable):**
- "The login should be secure"
- "Users can manage their profile"
- "Handle errors appropriately"
- "The system shall be fast" ← Rejected: not testable

**Good (specific, testable):**
- "The auth module shall hash passwords using bcrypt with cost factor 12."
- "When the user clicks 'Edit Profile', the profile view shall display the edit form within 50ms."
- "If the API returns a 500 error, then the error handler shall display 'Service unavailable', log the error, and retry after 5 seconds."

### Converting Informal Requirements

Use `sc ears` to help convert informal text:

```bash
sc ears "users should be able to login with email"
```

The validator will suggest the appropriate EARS pattern and warn about vague language.

## Health Checks

Run `sc doctor` periodically to catch structural health issues. It detects parse failures (broken spec files invisible to other commands), orphaned references, and various other issues. Run `sc doctor --help` for the full list of checks.

Use `sc doctor --fix` to auto-repair detected issues where possible, including common status aliases (e.g., `done` → `closed`). Boilerplate content requires manual filling — use `sc set <id> --overview/--goals/etc.` to fill sections programmatically.

## Common Pitfalls

### Running Done/Release from Inside Work Worktree
If you run `sc done` or `sc release` from inside the work worktree being removed, the command will complete successfully, but you'll be left in a deleted directory. Navigate to a different directory (e.g., `cd ..`) after the command completes to avoid working in the deleted directory.

### Don't Skip Claiming
Always `sc claim` before starting work. This prevents conflicts and tracks work in progress. Note: both `sc claim` and `sc set --status in_progress` are blocked for parent specs — work on their child specs instead.

### Don't Forget Dependencies
Before claiming, verify blockers are complete:
```bash
sc show <spec-id>  # Shows blockers in spec details
```

### Check Status Before Done
`sc done` only works on claimed specs. If you see "Spec is not claimed", you may have:
- Already completed it
- Released it
- Never claimed it

### Dirty Working Tree in Branch Mode
Branch mode (`--branch`) requires a clean working tree since it checks out a new branch in-place. If you have uncommitted changes, `sc claim --branch` will fail with a clear error. Either commit or stash your changes first, or use `--worktree` for an isolated workspace that doesn't affect your current working tree.

### Validate Early
Run `sc validate` before marking complete. Invalid EARS requirements indicate unclear specifications.

## Claim Modes

By default, `sc claim` sets status to `in_progress` without creating git artifacts (status-only mode). Use `--branch` for a dedicated work branch (requires a clean working tree), or `--worktree` for an isolated worktree (sibling to repository root) with branch `work-<slug>-<spec-id>`. Any branch or worktree created is automatically removed when you run `sc done` or `sc release`. In bare repositories, `--branch` auto-escalates to worktree mode.

## EARS Requirements → Test Type Mapping

When planning test coverage for EARS requirements, the requirement language itself indicates the appropriate test type:

| Requirement Language | Test Type | Rationale |
|---------------------|-----------|-----------|
| "UI shall display...", "form shall show..." | E2E only | Tests user-visible behavior |
| "repository shall...", "handler shall..." | Integration required | Tests data layer behavior |
| "validator shall..." (client-side) | E2E only | Browser-side validation |
| "validator shall..." (server-side) | Integration required | Server logic |
| "database shall use CASCADE..." | Integration only | Schema constraint |
| Pure display formatting (dates, locale) | E2E only | JavaScript/browser API |

**Key heuristic:** If the requirement mentions a specific code layer (repository, handler, server, database), test that layer directly. If it describes what the user sees, E2E is sufficient.

**Example analysis:**
```
R1: "When a post's event date is today, the post shall display 'Today'"
    → E2E only (pure UI formatting)

R2: "The user repository shall set scheduledForDeletionAt to 14 days in future"
    → Integration required (requirement explicitly names repository)

R3: "While deletion is scheduled, the UI shall display a countdown banner"
    → E2E only (requirement describes UI behavior)
```

## See Also

Full command reference: `main/CLAUDE.md`
