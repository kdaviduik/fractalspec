# Plan: Add `--cd` Flag to `sc claim` Command

## Overview

Add an opt-in `--cd` flag to `sc claim` that outputs a shell-evaluable command, enabling users to automatically change to the newly created worktree directory.

**Challenge**: A CLI process cannot directly change the parent shell's working directory. The solution is to output a command that the shell can evaluate.

## Background Research

### Current Implementation

The `sc claim` command:
1. Creates a git worktree at `../work-<slug>-<id>/` (sibling to repo root)
2. Sets spec status to `in_progress`
3. Prints instructions: `cd ../work-<slug>-<id>`

Users must manually copy/paste or type the `cd` command.

### Shell Integration Patterns

Standard approaches for CLI tools that need to change directories:

| Approach | Example | Pros | Cons |
|----------|---------|------|------|
| **Shell function wrapper** | `sccd() { eval "$(sc claim --cd "$@")" }` | Clean UX, one command | Requires shell config |
| **Command substitution** | `eval "$(sc claim --cd ABC123)"` | No setup required | Verbose invocation |

**Recommended**: Output `cd '<quoted-path>'` when `--cd` is used, to be wrapped in `eval "$(...)"` or a shell function.

## Proposed Design

### Flag Behavior

```bash
# Without --cd (current behavior, unchanged)
$ sc claim ABC123
Claimed: My Feature
  Status: in_progress

To start working:
  cd ../work-my-feature-ABC123

# With --cd (new behavior)
$ sc claim --cd ABC123
cd '/absolute/path/to/work-my-feature-ABC123'
```

### Design Decisions

1. **Output only `cd` command to stdout when `--cd` is used** — No other stdout to keep it eval-safe
2. **Send status info to stderr in `--cd` mode** — User still sees "Claimed: ..." feedback (John's suggestion)
3. **Use absolute paths with single-quote escaping** — Shell-safe for paths with spaces/special chars (Sheldon's requirement)
4. **Exit code 0 on success, non-zero on failure** — Critical for `eval` safety
5. **On failure: empty stdout** — Prevents `eval` from executing garbage (Gray's requirement)

### Path Quoting (Critical for Shell Safety)

```typescript
// Single-quote escaping handles all shell metacharacters
const escapedPath = worktreePath.replace(/'/g, "'\\''");
console.log(`cd '${escapedPath}'`);
```

This is safe because:
- Single quotes prevent all shell expansion
- The escape pattern handles embedded single quotes
- Works in bash, zsh, sh, and POSIX shells

### Usage Patterns

**Option A: Direct eval (no setup)**
```bash
eval "$(sc claim --cd ABC123)"
```

**Option B: Shell function (recommended for frequent use)**
```bash
# Add to ~/.bashrc or ~/.zshrc
sccd() {
  local output
  output=$(sc claim --cd "$@") && eval "$output"
}

# Then use:
sccd ABC123
```

### Failure Behavior

When claim fails with `--cd`:
- **stdout**: Empty (prevents `eval` from executing garbage)
- **stderr**: Error message (visible to user)
- **exit code**: Non-zero (prevents `&&` from proceeding)

```bash
# Example: Invalid spec
$ eval "$(sc claim --cd INVALID)"
# stderr shows: Error: Spec not found: INVALID
# eval executes empty string (no-op)
# shell function's && prevents further execution
```

## Implementation Steps

### 1. Update `src/commands/claim.ts`

Add `--cd` flag parsing and conditional output:

```typescript
// In execute():
const cdFlag = args.includes('--cd') || args.includes('-C');
const filteredArgs = args.filter(a => a !== '--cd' && a !== '-C');

// ... existing validation (must return early with empty stdout on error) ...

// ... existing claim logic ...

if (cdFlag) {
  // Status info to stderr so user sees feedback
  console.error(`Claimed: ${spec.title} (in_progress)`);
  // Eval-safe cd command to stdout with proper quoting
  const escapedPath = worktreePath.replace(/'/g, "'\\''");
  console.log(`cd '${escapedPath}'`);
} else {
  // Existing human-readable output
  console.log(`Claimed: ${spec.title}`);
  console.log(`  Status: in_progress`);
  console.log(`\nTo start working:`);
  console.log(`  cd ${worktreePath}`);
}
```

### 2. Update `getHelp()` in `src/commands/claim.ts`

Add flag documentation:

```typescript
flags: [
  {
    flag: '--cd, -C',
    description: 'Output cd command for shell evaluation (use with eval or wrapper function)',
  },
],
```

Add examples showing both usage patterns.

### 3. Update Global Help in `src/command-router.ts`

Update all 3 locations where claim appears:
- Line ~83: Workflow diagram
- Line ~103-106: Command synopsis
- Line ~186: Examples section

### 4. Add Tests in `src/commands/claim.test.ts`

**Required test cases** (from Gray's review):

| Scenario | Expected stdout | Expected stderr | Exit |
|----------|----------------|-----------------|------|
| `sc claim --cd VALID` | `cd '/abs/path'\n` | `Claimed: ...` | 0 |
| `sc claim VALID --cd` | `cd '/abs/path'\n` | `Claimed: ...` | 0 |
| `sc claim -C VALID` | `cd '/abs/path'\n` | `Claimed: ...` | 0 |
| `sc claim VALID -C` | `cd '/abs/path'\n` | `Claimed: ...` | 0 |
| `sc claim --cd INVALID` | (empty) | `Error: ...` | 1 |
| `sc claim --cd ALREADY_CLAIMED` | (empty) | `Error: ...` | 1 |
| `sc claim --cd` (no arg) | (empty) | `Usage: ...` | 1 |
| `sc claim VALID` (no --cd) | `Claimed: ...` | (empty) | 0 |
| `sc claim --cd --help` | (help text) | (empty) | 0 |

**Additional test requirements:**
- Path is absolute (starts with `/`)
- Path is properly single-quoted
- Help documentation includes `--cd` flag

### 5. Update Documentation Files

| File | What to Update |
|------|---------------|
| `src/commands/claim.ts` | `getHelp()` - add `--cd, -C` to flags, add eval/shell function examples |
| `src/command-router.ts` | Lines ~83, ~103-106, ~186 - add `--cd` flag in all 3 locations |
| `CLAUDE.md` | Commands Reference table (~line 107), Agent Workflow (~lines 303-307) |
| `.claude/skills/sc-spec-workflow.md` | Claim section (~lines 24-29) - add `--cd` alternative |

### 6. Implementation Review Gate (BLOCKING)

**INSTRUCTION FOR EXECUTING AGENT**: This is a BLOCKING gate. Before proceeding to any subsequent steps, invoke the following agents for code review using the Task tool. Do not proceed until all agents approve.

**Agents to Invoke**:

| Agent | Full Name (use this) | Approval Criteria | Status |
|-------|---------------------|-------------------|--------|
| John | `john-ousterhout` | Design simplicity, interface depth, information hiding | [ ] Pending |
| Sheldon | `sheldon-code-guardian` | Code quality, shell safety, path quoting | [ ] Pending |
| Gray | `gray-verification-guardian` | Tests exist, pass, cover all cases | [ ] Pending |
| Donna | `donna-docs-guardian` | All 4 doc files updated, no stale refs | [ ] Pending |

**Re-approval Rule**: If ANY agent requests changes, make the changes, then re-invoke ALL agents above. All must approve the SAME final version.

**Review Summary** (fill in during execution):

| Agent | Verdict | Summary |
|-------|---------|---------|
| John | | |
| Sheldon | | |
| Gray | | |
| Donna | | |

**Completion**: This step is complete when ALL agents show approved status above.

## Verification

### Manual Testing

```bash
# Test --cd flag outputs quoted cd command
sc claim --cd <test-spec-id>

# Test eval integration
eval "$(sc claim --cd <test-spec-id>)"
pwd  # Should be in worktree

# Test error handling (invalid spec ID) - stdout must be empty
sc claim --cd INVALID
echo "Exit code: $?"  # Should be non-zero

# Test flag position variations
sc claim <test-spec-id> --cd
sc claim -C <test-spec-id>
```

### Automated Tests

```bash
bun run test
```

### Lint and Typecheck

```bash
bun run lint && bun run typecheck
```

### Post-Implementation Doc Verification

```bash
# Find remaining "cd ../work-" patterns that might need updating
grep -rn "cd \.\./work-" --include="*.md" .

# Find all claim examples to verify consistency
grep -rn "sc claim" --include="*.md" .
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/commands/claim.ts` | Add `--cd` flag parsing, conditional output with path quoting, update `getHelp()` |
| `src/command-router.ts` | Update global help in 3 locations |
| `src/commands/claim.test.ts` | Add comprehensive tests per matrix above |
| `CLAUDE.md` | Commands Reference table, Agent Workflow section |
| `.claude/skills/sc-spec-workflow.md` | Claim section - add `--cd` alternative |

## Agent Plan Review Gate

**Reviewing Agents** (must all approve before presenting to user):

| Agent | Full Name | Approval Criteria |
|-------|-----------|-------------------|
| John | `john-ousterhout` | Design simplicity, module depth |
| Sheldon | `sheldon-code-guardian` | Shell safety, path quoting |
| Gray | `gray-verification-guardian` | Test coverage completeness |
| Donna | `donna-docs-guardian` | Documentation completeness |

### Review Summary

| Agent | Verdict | Summary |
|-------|---------|---------|
| John | ✅ APPROVE WITH SUGGESTIONS | Design sound. Added: stderr feedback in --cd mode, documented failure behavior |
| Sheldon | ✅ APPROVE (after revision) | Critical fix: single-quote path escaping for shell safety |
| Gray | ✅ APPROVE (after revision) | Added: full test matrix, flag position tests, error-path verification |
| Donna | ✅ APPROVE (after revision) | Added: sc-spec-workflow.md, expanded CLAUDE.md sections, 3 locations in command-router |

**All agents have approved this revised plan.**

## Status

- [x] Plan reviewed by agents
- [ ] Plan approved by user
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Documentation updated
