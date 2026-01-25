# Design Review: Safety Checks and PR Tracking for Spec CLI

**Reviewer**: John Ousterhout (Design Principles Perspective)
**Date**: 2026-01-25
**Verdict**: APPROVE WITH SUGGESTIONS

---

## Summary Verdict

**APPROVE WITH SUGGESTIONS**

This implementation demonstrates solid application of software design principles. The safety check infrastructure is well-designed with good module depth, proper information hiding, and thoughtful error handling. The PR tracking is a clean, minimal addition. There are a few areas for minor improvement, but nothing that blocks approval.

---

## Principle-Based Analysis

### What's Done Well

#### 1. Deep Modules in `git-operations.ts`

The safety check functions exemplify deep module design:

```typescript
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean>
export async function hasUnpushedCommits(worktreePath: string): Promise<boolean>
export async function isDetachedHead(worktreePath: string): Promise<boolean>
```

**Why this is good**: Each function has a trivially simple interface (one string argument, returns boolean) while hiding significant complexity:
- Git command invocation with proper spawning
- Timeout handling
- Error recovery with fail-safe defaults
- Parsing of git output

The ratio of hidden functionality to interface complexity is excellent. Callers never need to know about `git status --porcelain`, `git rev-list @{upstream}..HEAD`, or timeout race conditions.

#### 2. Fail-Safe Error Handling

The error handling philosophy is correct:

```typescript
// From hasUncommittedChanges
} catch (error) {
  if (error instanceof GitTimeoutError) {
    throw error;
  }
  return true;  // Fail-safe: assume there are changes
}
```

**Why this is good**: This follows the principle of "defining errors out of existence" in a safety-critical context. When checking for uncommitted changes before a destructive operation, returning `true` (unsafe) on error is the conservative choice. The only exception is timeout errors, which should propagate because they indicate a systemic problem.

#### 3. Clean Abstraction Layering

The abstraction layers are well-separated:

1. **Low-level**: `git-operations.ts` - raw git commands
2. **Mid-level**: `claim-logic.ts` - safety orchestration with `checkClaimSafety()`
3. **High-level**: `done.ts`/`release.ts` - user-facing commands

Each layer provides a different abstraction:
- Low-level: "Does this worktree have uncommitted changes?"
- Mid-level: "Is it safe to cleanup this spec's worktree?"
- High-level: "Complete this spec with appropriate warnings"

This follows the "Different Layer, Different Abstraction" principle.

#### 4. `SafetyCheckResult` Interface

```typescript
export interface SafetyCheckResult {
  safe: boolean;
  issues: string[];
  worktreePath: string;
  branchName: string;
}
```

**Why this is good**: This pulls complexity downward. The calling commands don't need to:
1. Know how to compute the worktree path
2. Know how to compute the branch name
3. Aggregate issues from multiple checks

The interface is minimal but complete for the caller's needs.

#### 5. Idempotent Operations in `set.ts`

All set operations are idempotent:

```typescript
if (spec.priority === priority) {
  msgs.push(`Priority already ${priority}`);
  return;
}
```

**Why this is good**: This defines errors out of existence. Setting a property to its current value succeeds silently with an informative message. The caller never needs to check "is this already set?" before calling.

#### 6. PR Field Addition

The `pr: string | null` addition to `SpecFrontmatter` is minimal and clean:
- Simple nullable string type
- Consistent with existing patterns (`parent: string | null`)
- No over-engineering (no URL validation, PR status tracking, etc.)

---

## Minor Concerns (Suggestions, Not Blockers)

### Issue 1: Duplicated `parseForceFlag` Function

**Location**: `src/commands/done.ts` lines 11-24, `src/commands/release.ts` lines 11-24

```typescript
function parseForceFlag(args: string[]): { force: boolean; specId: string | undefined } {
  let force = false;
  let specId: string | undefined;
  // ... identical implementation
}
```

**Principle Violated**: Repetition (Red Flag #7)

**Why It Matters**: If the force flag parsing logic needs to change (e.g., adding `-F` as an alias), both files must be updated. This is a minor case since the logic is simple and stable, but it represents duplicated knowledge.

**Suggested Fix**: Extract to a shared parsing utility:

```typescript
// src/arg-parsing.ts
export function parseForceAndId(args: string[]): { force: boolean; id: string | undefined }
```

**Severity**: Low - The duplication is small and the functions are unlikely to diverge.

---

### Issue 2: Duplicated Safety Message Generation

**Location**: `src/commands/done.ts` lines 89-105, `src/commands/release.ts` lines 89-105

The error message generation for safety check failures is nearly identical:

```typescript
if (safety.issues.includes('uncommitted changes')) {
  console.error(`  cd ${safety.worktreePath}`);
  console.error('  git add . && git commit -m "your message"');
}
// ... more duplicated logic
```

**Principle Violated**: Repetition (Red Flag #7)

**Why It Matters**: If actionable recovery instructions change, both files must be updated.

**Suggested Fix**: Extract to a shared function:

```typescript
// In claim-logic.ts or a new file
export function printSafetyResolutionInstructions(
  result: SafetyCheckResult,
  specId: string
): void
```

This would also pull the "how to explain safety issues" knowledge into one place.

**Severity**: Low-Medium - More code is duplicated here than in Issue 1, but still manageable.

---

### Issue 3: `exitWithError` Uses `process.exit(1)`

**Location**: `src/commands/set.ts` line 16-19

```typescript
function exitWithError(message: string): never {
  console.error(message);
  process.exit(1);
}
```

**Principle**: Not strictly a design principle violation, but `process.exit()` in library code can make testing harder and prevents proper error aggregation.

**Observation**: The tests work around this by mocking `process.exit`. The execute function returns exit codes in other places, so there's inconsistency.

**Suggested Fix**: Consider returning early with error codes consistently, or throwing a custom error that the CLI entry point catches. This is a minor stylistic concern.

**Severity**: Low - Tests already handle this case adequately.

---

## Red Flag Assessment

| Red Flag | Present? | Assessment |
|----------|----------|------------|
| Shallow Module | No | All git-operations functions hide significant complexity |
| Information Leakage | No | Git command details stay in git-operations.ts |
| Temporal Decomposition | No | Code organized by information, not execution order |
| Pass-Through Method | No | Each layer adds value |
| Pass-Through Variables | No | `SafetyCheckResult` bundles related data appropriately |
| Repetition | Minor | `parseForceFlag` and safety messages duplicated |
| Conjoined Methods | No | Methods are independently understandable |

---

## Test Coverage Assessment

The tests are well-designed:

1. **Fail-safe behavior tested**: Both `hasUncommittedChanges` and `hasUnpushedCommits` are verified to return `true` for non-existent paths.

2. **Idempotency tested**: `set.test.ts` verifies that setting the same value twice succeeds.

3. **Cycle detection tested**: Parent and blocker cycle detection is thoroughly tested.

4. **PR field tested**: Complete coverage for set, clear, and idempotent operations.

---

## Final Assessment

### Strengths

1. **Excellent module depth** in git-operations.ts
2. **Proper fail-safe error handling** for safety-critical operations
3. **Clean abstraction layers** that each provide distinct value
4. **Idempotent operations** that define errors out of existence
5. **Comprehensive test coverage** including edge cases
6. **Actionable error messages** that guide users to resolution

### Areas for Future Improvement

1. Extract duplicated `parseForceFlag` function
2. Extract duplicated safety message generation
3. Consider consistency in error handling patterns across commands

### Verdict Rationale

This implementation demonstrates thoughtful application of design principles. The core abstractions are sound:

- `git-operations.ts` is genuinely deep
- `SafetyCheckResult` pulls complexity downward appropriately
- Error handling follows fail-safe principles
- The PR field addition is minimal and clean

The duplications noted are minor and don't affect the overall quality of the design. The code is readable, testable, and maintainable.

**Approved for merge.**
