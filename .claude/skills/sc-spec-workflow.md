# sc Spec Workflow

Guide for working with the `sc` spec management CLI. Use this skill when implementing features defined by specs.

## Workflow: Claim → Implement → Complete

### 1. Find Available Work

```bash
# See all ready specs (sorted by priority)
sc list --ready

# Get THE next highest-priority task
sc list --ready --limit 1

# Filter to specific priority level
sc list --ready --priority high
```

Specs are automatically sorted by priority (critical > high > normal > low), then by depth (leaf specs first), then alphabetically. Use `--limit 1` for "what should I work on next?" behavior.

### 2. Claim the Spec

```bash
sc claim <spec-id>
cd ../work-<slug>-<spec-id>
```

This sets status to `in_progress` and creates a dedicated worktree (sibling to repository root). The `<slug>` is derived from the spec's title.

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
sc done <spec-id>
```

This sets status to `closed` and removes the work worktree. Commands can be run from any directory in the repository.

## Creating Specs with Priority

When creating specs, you can set priority explicitly or rely on inheritance:

```bash
# Create with explicit priority
sc create -t "Critical Security Fix" --priority critical

# Child specs inherit parent's priority by default
sc create -p ABC123 -t "Sub-task"

# Override inherited priority
sc create -p ABC123 -t "Low-priority cleanup" --priority low
```

**Priority levels** (highest to lowest): `critical`, `high`, `normal`, `low`

**Default behavior**: Root specs default to `normal`. Child specs inherit their parent's priority unless overridden with `--priority`.

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

Run `sc doctor` periodically to catch:
- **Orphans**: Specs referencing non-existent parents
- **Missing blockers**: References to deleted specs
- **Circular dependencies**: A blocks B blocks A

Use `sc doctor --fix` to auto-repair orphans and missing blockers.

## Common Pitfalls

### Running Done/Release from Inside Work Worktree
If you run `sc done` or `sc release` from inside the work worktree being removed, the command will complete successfully, but you'll be left in a deleted directory. Navigate to a different directory (e.g., `cd ..`) after the command completes to avoid working in the deleted directory.

### Don't Skip Claiming
Always `sc claim` before starting work. This prevents conflicts and tracks work in progress.

### Don't Forget Dependencies
Before claiming, verify blockers are complete:
```bash
sc deps list <spec-id>
```

### Check Status Before Done
`sc done` only works on claimed specs. If you see "Spec is not claimed", you may have:
- Already completed it
- Released it
- Never claimed it

### Validate Early
Run `sc validate` before marking complete. Invalid EARS requirements indicate unclear specifications.

## Worktree Convention

When you claim a spec, `sc` creates a dedicated git worktree (sibling to repository root) with branch `work-<slug>-<spec-id>`. Always work in this worktree. The worktree and branch are automatically removed when you run `sc done` or `sc release`. Commands can be run from any directory in the repository.

## See Also

Full command reference: `main/CLAUDE.md`
