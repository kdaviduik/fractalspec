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

`--ready` shows only leaf specs (parent specs with children are excluded). Results are sorted by priority (10 highest → 1 lowest), then by depth (leaf specs first), then alphabetically. Use `--limit 1` for "what should I work on next?" behavior.

### 2. Claim the Spec

```bash
# Branch mode (default) — creates branch in current repo
sc claim <spec-id>

# Worktree mode — creates isolated worktree
sc claim <spec-id> --worktree

# With shell integration (worktree mode auto-cd)
eval "$(sc init bash)"  # One-time setup
sc claim <spec-id> --worktree
```

This sets status to `in_progress`. Branch mode (default) creates and checks out a work branch in your current repo — requires a clean working tree. Worktree mode (`--worktree`) creates a dedicated worktree (sibling to repository root) for isolated work.

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

## Creating Specs with Priority

When creating specs, you can set priority explicitly or rely on inheritance:

```bash
# Create with explicit high priority (10 = highest)
sc create -t "Critical Security Fix" --priority 10

# Child specs inherit parent's priority by default
sc create -p ABC123 -t "Sub-task"

# Override inherited priority
sc create -p ABC123 -t "Low-priority cleanup" --priority 2
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

Run `sc doctor` periodically to catch structural health issues including orphaned references, missing blockers, circular dependencies, and unclosed parent specs.

Use `sc doctor --fix` to auto-repair detected issues where possible.

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
Branch mode (default) requires a clean working tree since it checks out a new branch in-place. If you have uncommitted changes, `sc claim` will fail with a clear error. Either commit or stash your changes first, or use `--worktree` for an isolated workspace that doesn't affect your current working tree.

### Validate Early
Run `sc validate` before marking complete. Invalid EARS requirements indicate unclear specifications.

## Claim Modes

By default, `sc claim` creates a branch in the current repository (branch mode). Use `--worktree` for an isolated worktree (sibling to repository root) with branch `work-<slug>-<spec-id>`. Branch mode requires a clean working tree. The branch (and worktree if present) is automatically removed when you run `sc done` or `sc release`.

## See Also

Full command reference: `main/CLAUDE.md`
