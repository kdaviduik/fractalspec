# sc Spec Workflow

Guide for working with the `sc` spec management CLI. Use this skill when implementing features defined by specs.

## Workflow: Claim → Implement → Complete

### 1. Find Available Work

```bash
sc list --ready
```

Pick a spec with no blockers. If unsure which to prioritize, check the tree view (`sc list --tree`) to understand dependencies.

### 2. Claim the Spec

```bash
sc claim <spec-id>
cd ../work-<spec-id>
```

This sets status to `in_progress` and creates a dedicated worktree at `../work-<spec-id>`.

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
cd ../main  # Make sure you're in the main worktree
sc done <spec-id>
```

This sets status to `closed` and removes the work worktree. **Important:** Run this from the main worktree for automatic cleanup.

## Writing EARS Requirements

When creating or editing specs, use EARS patterns for clear, testable requirements.

### Pattern Quick Reference

| Pattern | Starts With | Use For |
|---------|-------------|---------|
| Ubiquitous | "The system shall..." | Always-true rules |
| Event-driven | "When X, the system shall..." | User actions, triggers |
| State-driven | "While X, the system shall..." | Behavior during states |
| Unwanted | "If X, then the system shall..." | Errors, edge cases |
| Optional | "Where X, the system shall..." | Feature-gated behavior |
| Complex | "While X, when Y, the system shall..." | State + trigger combo |

### Good vs Bad Examples

**Bad (vague, untestable):**
- "The login should be secure"
- "Users can manage their profile"
- "Handle errors appropriately"

**Good (specific, testable):**
- "The system shall hash passwords using bcrypt with cost factor 12."
- "When the user clicks 'Edit Profile', the system shall display the profile form."
- "If the API returns a 500 error, then the system shall display 'Service unavailable' and log the error."

### Converting Informal Requirements

Use `sc ears` to help convert informal text:

```bash
sc ears "users should be able to login with email"
```

## Health Checks

Run `sc doctor` periodically to catch:
- **Orphans**: Specs referencing non-existent parents
- **Missing blockers**: References to deleted specs
- **Circular dependencies**: A blocks B blocks A

Use `sc doctor --fix` to auto-repair orphans and missing blockers.

## Common Pitfalls

### Always Return to Main Worktree Before Done/Release
Before running `sc done` or `sc release`, make sure you're in the main worktree (`cd ../main`). If you run these commands from inside the work worktree, the branch will be deleted and status updated, but you'll need to manually clean up the worktree directory.

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

When you claim a spec, `sc` creates a dedicated git worktree at `../work-<spec-id>` with branch `work/<spec-id>`. Always work in this worktree. The worktree and branch are automatically removed when you run `sc done` or `sc release` from the main worktree.

## See Also

Full command reference: `main/CLAUDE.md`
