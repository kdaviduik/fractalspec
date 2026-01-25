# Plan: Spec CLI Workflow Safety and PR Tracking

## Problem Statement

The spec CLI has a critical workflow gap: `sc done` removes the worktree and force-deletes the branch (`git branch -D`), which destroys any uncommitted or unpushed work. This creates a catastrophic data loss risk when agents or users complete specs without first pushing code.

**Observed issues:**
1. No guidance to `cd` into worktree after `sc claim`
2. No enforcement of commit/push before `sc done` - silent data loss
3. No way to track PRs associated with specs

## Proposed Changes

### 1. Safety Checks in `sc done` and `sc release`

**New functions in `git-operations.ts`:**
- `hasUncommittedChanges(worktreePath)` - detect dirty worktree
- `hasUnpushedCommits(worktreePath, branchName)` - detect commits not on remote

**New function in `claim-logic.ts`:**
```typescript
interface SafetyCheckResult {
  safe: boolean;
  issues: string[];  // Human-readable: ["uncommitted changes", "unpushed commits"]
  worktreePath: string;
}

async function checkClaimSafety(spec: Spec): Promise<SafetyCheckResult>
```

**Command changes:**
- `sc done` errors if uncommitted changes or unpushed commits exist
- `sc release` errors if uncommitted changes or unpushed commits exist
- Both accept `--force` flag to bypass with explicit warning
- Error messages are **actionable** (show exact commands to resolve)
- All git operations have **timeout** (10 seconds) to prevent hangs

### 2. Enhanced `sc claim` Output

After claiming, explicitly output the `cd` command:
```
Claimed spec ABC123: "Feature Name"
Worktree created at: ../work-feature-name-ABC123
Branch: work-feature-name-ABC123

Next: cd ../work-feature-name-ABC123
```

### 3. New `pr` Frontmatter Field

Add optional `pr: string | null` field to track PR URL:
- Default: `null`
- Set via: `sc set <id> --pr <url>` or `sc set <id> --pr none`
- Display in: `sc show <id>`
- Preserved after `sc done` (useful for history)

**Note:** We're NOT adding `in_review` status initially. The `pr` field alone provides observability:
- `in_progress` + `pr: null` = actively working
- `in_progress` + `pr: "https://..."` = has open PR
- `closed` = merged

We can add `in_review` status later if the workflow actually needs it.

### 4. Documentation Updates

Update CLAUDE.md with:
- Minimal workflow: `claim → cd → work → commit → push → done`
- Full workflow with PR tracking: `... + set --pr <url> before done`
- Safety check documentation

---

## Edge Case Behavior

| Scenario | Behavior |
|----------|----------|
| Worktree manually deleted | `sc done` succeeds (postcondition satisfied) |
| No upstream tracking configured | Block (unpushed by definition), suggest push first |
| Empty worktree (no commits on branch) | Allow completion (nothing to lose) |
| Detached HEAD state | Block with clear error, suggest checking out branch |
| Git command times out | Block (assume unsafe), suggest manual investigation |
| Worktree exists but corrupt | Attempt `git worktree list` validation first |

**Note on "remote unreachable":** We use `git rev-list @{upstream}..HEAD` which works entirely locally (compares HEAD to local tracking ref). We do NOT contact the remote server - this avoids latency and network dependencies. If the local tracking ref is stale but user has pushed, that's an infrastructure issue outside our scope.

---

## Implementation Steps

### Phase 1: Core Types (No Breaking Changes)

1. **Add `pr` field to SpecFrontmatter interface** (`src/types.ts`)
2. **Update parser** (`src/spec-parser.ts`) - parse `pr` with null default
3. **Update serializer** (`src/spec-serializer.ts`) - include `pr` field
4. **Update tests** for types, parser, serializer

### Phase 2: Git Safety Functions

5. **Add `hasUncommittedChanges()`** (`src/git-operations.ts`)
6. **Add `hasUnpushedCommits()`** (`src/git-operations.ts`)
7. **Add `checkClaimSafety()`** (`src/claim-logic.ts`)
8. **Add tests** for all safety functions (see Test Cases below)

### Phase 3: Command Updates

9. **Update `claim.ts`** - enhance output with explicit `cd` command
10. **Update `done.ts`** - add safety checks, `--force` flag, actionable error messages
11. **Update `release.ts`** - add safety checks, `--force` flag, actionable error messages
12. **CREATE `done.test.ts`** - new test file for done command
13. **CREATE `release.test.ts`** - new test file for release command
14. **Update `set.ts`** - add `--pr` flag
15. **Update `show.ts`** - display `pr` field

### Phase 4: Documentation

16. **Update CLAUDE.md**:
    - Frontmatter Schema table (add `pr` field)
    - Spec Format example (add `pr: null`)
    - Critical Type Definitions (add `pr` to SpecFrontmatter)
    - Property Modification table (add `--pr` flag)
    - Workflow command table (mention safety checks, `--force`)
17. **Update command-router.ts** - global help text (workflow + property modification sections)
18. **Update individual command help** - done, release, set, show, claim
19. **Update `.claude/skills/sc-spec-workflow.md`** - safety check awareness in Complete section
20. **Update `.docs/dependencies.md`** - add PR Tracking section, update Git Operations section

### 21. Implementation Review Gate (BLOCKING)

**INSTRUCTION FOR EXECUTING AGENT**: This is a BLOCKING gate. Before marking task complete, invoke the following agents for code review using the Task tool. Do not proceed until all agents approve.

**Agents to Invoke**:

| Agent | Full Name (use this) | Approval Criteria | Status |
|-------|---------------------|-------------------|--------|
| John | `john-ousterhout` | Module depth, information hiding, interface simplicity | [ ] Pending |
| Kara | `kara-product-strategist` | Risk assessment, user experience, workflow completeness | [ ] Pending |
| Gray | `gray-verification-guardian` | Evidence of testing, no workarounds, claims verified | [ ] Pending |
| Donna | `donna-docs-guardian` | All doc touchpoints updated, no stale references | [ ] Pending |
| Sheldon | `sheldon-code-guardian` | Production reliability, timeouts, error handling | [ ] Pending |

**Re-approval Rule**: If ANY agent requests changes, make the changes, then re-invoke ALL agents above. All must approve the SAME final version.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types.ts` | Add `pr` field to SpecFrontmatter |
| `src/spec-parser.ts` | Parse `pr` field with null default |
| `src/spec-serializer.ts` | Serialize `pr` field |
| `src/git-operations.ts` | Add `hasUncommittedChanges()`, `hasUnpushedCommits()` |
| `src/claim-logic.ts` | Add `checkClaimSafety()` |
| `src/commands/claim.ts` | Enhanced output with `cd` command |
| `src/commands/done.ts` | Safety checks, `--force` flag, actionable errors |
| `src/commands/release.ts` | Safety checks, `--force` flag, actionable errors |
| `src/commands/set.ts` | `--pr` flag |
| `src/commands/show.ts` | Display `pr` field |
| `CLAUDE.md` | Workflow docs, frontmatter schema |
| `src/command-router.ts` | Global help text |

## Test Files

| File | Action | Tests |
|------|--------|-------|
| `src/types.test.ts` | Update | (no changes needed - pr field is optional) |
| `src/spec-parser.test.ts` | Update | Parse `pr` field, default to null |
| `src/spec-serializer.test.ts` | Update | Serialize `pr` field |
| `src/git-operations.test.ts` | Update | Safety check functions |
| `src/claim-logic.test.ts` | Update | `checkClaimSafety()` |
| `src/commands/done.test.ts` | **CREATE** | Safety check behavior (see table below) |
| `src/commands/release.test.ts` | **CREATE** | Safety check behavior (see table below) |
| `src/commands/set.test.ts` | Update | `--pr` flag |

---

## Test Cases for Safety Checks

### `done.test.ts` (CREATE)

| Scenario | Expected Exit | Expected Output Contains |
|----------|---------------|-------------------------|
| Clean worktree, all pushed | 0 | "Completed:" |
| Uncommitted changes, no --force | 1 | "uncommitted changes" |
| Unpushed commits, no --force | 1 | "unpushed commits" |
| Both issues, no --force | 1 | "uncommitted changes" AND "unpushed commits" |
| Uncommitted + --force | 0 | "Warning:" |
| Unpushed + --force | 0 | "Warning:" |
| Worktree doesn't exist | 0 | "Completed:" (postcondition satisfied) |
| No upstream configured, no --force | 1 | "unpushed commits" |

### `release.test.ts` (CREATE)

Same scenarios as `done.test.ts` but with "Released:" instead of "Completed:".

### `git-operations.test.ts` (UPDATE)

| Function | Scenario | Expected |
|----------|----------|----------|
| `hasUncommittedChanges` | Clean worktree | `false` |
| `hasUncommittedChanges` | Modified tracked file | `true` |
| `hasUncommittedChanges` | Untracked file | `true` |
| `hasUncommittedChanges` | Staged but uncommitted | `true` |
| `hasUnpushedCommits` | Up-to-date with remote | `false` |
| `hasUnpushedCommits` | Commits ahead of remote | `true` |
| `hasUnpushedCommits` | No upstream configured | `true` |
| `hasUnpushedCommits` | Detached HEAD | `true` (fail safe) |

---

## Verification Plan

1. **Unit tests** - Run `bun run test` after each phase
2. **Lint/typecheck** - Run `bun run lint && bun run typecheck`
3. **Manual testing**:
   - `sc claim <id>` → verify output includes explicit `cd` command
   - Make changes without committing, `sc done <id>` → should error with actionable message
   - Commit but don't push, `sc done <id>` → should error with actionable message
   - Push changes, `sc done <id>` → should succeed
   - `sc done <id> --force` with uncommitted → should warn but succeed
   - `sc set <id> --pr <url>` then `sc show <id>` → displays PR URL
   - `sc set <id> --pr none` → clears PR URL

---

## Agent Plan Review Gate

**Reviewing Agents** (must all approve before presenting to user):

| Agent | Full Name | Approval Criteria |
|-------|-----------|-------------------|
| John | `john-ousterhout` | Module depth, information hiding, interface simplicity |
| Kara | `kara-product-strategist` | Risk assessment, UX, workflow completeness |
| Gray | `gray-verification-guardian` | Verifiable claims, testable outcomes |

### Review Summary

| Agent | Verdict | Summary |
|-------|---------|---------|
| John | ✅ APPROVE | Deep module design correct, complexity pulled down, general-purpose approach |
| Kara | ✅ APPROVE | Proper safety/usability balance, via negativa applied, actionable errors committed |
| Gray | ✅ VERIFIED | All 4 concerns addressed: CREATE annotations, edge cases, 24 test cases enumerated |
| Donna | ⚠️ NEEDS ATTENTION | Identified 10 specific doc locations; all now added to Phase 4 |
| Sheldon | ✅ LGTM | Architecture sound; added detached HEAD handling, timeout, clarified remote semantics |

**All agents approved (Donna's concerns addressed by expanding Phase 4). Plan ready for user review.**
