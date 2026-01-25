# Verification Report: Spec CLI Workflow Safety Plan

**Claim Under Review**: Plan claims to solve data loss in spec CLI via safety checks, new status, and PR tracking
**Verdict**: **INCOMPLETE** - Plan is partially testable but has significant verification gaps

---

## Evidence Gathered

| Item | Expected | Actual | Status |
|------|----------|--------|--------|
| Existing test infrastructure | Tests exist for claim-logic, git-operations | Tests exist at `/src/claim-logic.test.ts`, `/src/git-operations.test.ts` | OK |
| Test files for done/release commands | Plan mentions updating `done.test.ts`, `release.test.ts` | **Files do not exist** - no `done.test.ts` or `release.test.ts` found | GAP |
| Existing safety check functions | Functions to be added per plan | None exist - no `hasUncommittedChanges` or `hasUnpushedCommits` in codebase | OK (expected) |
| Spec for `pr` field parsing | Plan says parser handles `pr` with null default | Parser currently only handles: `id`, `status`, `parent`, `blocks`, `priority` | OK (expected) |
| Current `done.ts` implementation | Needs safety checks added | Currently has NO safety checks - calls `completeSpec()` directly | OK (expected) |

---

## Verification Details

### 1. Claim: "Detecting uncommitted changes via `git status --porcelain`"

**Verifiability Assessment**: TESTABLE

- The git command is well-documented and deterministic
- Can be tested by creating fixtures with:
  - Clean worktree (no output from `git status --porcelain`)
  - Modified tracked file (M flag in output)
  - Untracked file (?? flag in output)
  - Staged but uncommitted changes (A/M flags)

**Test Strategy Required**:
```typescript
// Needs tests that:
// 1. Create temp git repo
// 2. Add a worktree
// 3. Modify files in worktree
// 4. Verify hasUncommittedChanges() returns true
// 5. Commit changes
// 6. Verify hasUncommittedChanges() returns false
```

**Evidence**: Existing `git-operations.test.ts` shows this testing pattern is established (lines 46-58 show temp branch creation/cleanup pattern).

---

### 2. Claim: "Detecting unpushed commits by checking remote tracking branch"

**Verifiability Assessment**: PARTIALLY TESTABLE - EDGE CASES UNADDRESSED

**What's testable**:
- Local commits ahead of remote (`git rev-list @{upstream}..HEAD`)
- Branch with no upstream tracking

**Edge cases NOT addressed in plan**:
1. **Worktree doesn't exist (manually deleted)**: Plan doesn't specify behavior
2. **Git remote unreachable (network down)**: No timeout/error handling specified
3. **Remote tracking broken**: Branch exists locally but upstream reference is stale
4. **Force-pushed remote**: Local thinks it's ahead but remote has diverged

**Required Specification**:
The plan should explicitly define:
- What happens when `git rev-list` fails?
- What's the timeout for remote operations?
- Should safety checks work offline-only (comparing local refs)?

---

### 3. Claim: "Blocking `sc done` and `sc release` when unsafe"

**Verifiability Assessment**: TESTABLE but MISSING TEST FILES

**Critical Gap**: Plan lists `done.test.ts` and `release.test.ts` in test files to update, but **these files do not exist**.

**Evidence**:
```
$ bun test src/commands/done.test.ts
# Would fail - file doesn't exist

Glob results for **/*.test.ts show:
- src/commands/create.test.ts (exists)
- src/commands/set.test.ts (exists)
- NO done.test.ts
- NO release.test.ts
```

**Plan should specify**: Create these test files from scratch, not "update" non-existent files.

---

### 4. Claim: "Adding `in_review` status"

**Verifiability Assessment**: TESTABLE

- `STATUSES` array in `types.ts` (line 8-15) is the single source of truth
- Existing `types.test.ts` tests status validity
- Can verify by:
  1. Adding `in_review` to STATUSES
  2. Testing `isValidStatus('in_review')` returns true
  3. Testing status count changes from 6 to 7

**Evidence**: Current STATUSES array contains 6 values (ready, in_progress, blocked, closed, deferred, not_planned). Adding `in_review` makes 7.

---

### 5. Claim: "Adding `pr` field to track PR URL"

**Verifiability Assessment**: TESTABLE

**Backward Compatibility Claim**: "pr defaults to null for existing specs"

**Verification Strategy**:
1. Create spec without `pr` field in frontmatter
2. Parse spec
3. Verify `spec.pr === null` (not `undefined`)

**Current Parser Evidence** (`spec-parser.ts` lines 50-51):
```typescript
const rawPriority = parsed.data['priority'];
const priority: Priority = isValidPriority(rawPriority) ? rawPriority : DEFAULT_PRIORITY;
```

This pattern (check existence, provide default) should be replicated for `pr` field.

**Serializer Concern**: `spec-serializer.ts` must also be updated to write `pr: null` vs omitting the field entirely. Plan doesn't specify which behavior is intended.

---

### 6. Claim: "Test coverage catches bug scenarios"

**Verifiability Assessment**: UNVERIFIED - SPECIFIC TEST CASES NOT ENUMERATED

**Plan states**:
> "Add tests for all safety functions"

**What's missing**:
The plan should enumerate specific test cases:

| Scenario | Test Name | Expected Behavior |
|----------|-----------|-------------------|
| Clean worktree, all pushed | `done succeeds when safe` | Exit 0 |
| Uncommitted changes | `done blocks with dirty worktree` | Exit 1, error message |
| Committed but not pushed | `done blocks with unpushed commits` | Exit 1, error message |
| No upstream branch | `done blocks when no remote tracking` | Exit 1, error message (or allow?) |
| --force with uncommitted | `done --force bypasses checks` | Exit 0, warning message |
| Worktree manually deleted | `done handles missing worktree` | ??? (undefined in plan) |

---

### 7. Claim: "Documentation accuracy verified"

**Verifiability Assessment**: TESTABLE but NOT AUTOMATED

**Plan specifies**:
- Update CLAUDE.md with workflow
- Update command help text

**Verification Gap**: No mechanism to verify docs match behavior. Should add:
- Help output test (run `sc done --help`, verify contains `--force`)
- Integration test that exercises documented workflow

---

## Workaround Scan

Searched for suppression patterns in current codebase:

| Pattern | Count | Concern |
|---------|-------|---------|
| `@ts-expect-error` | 0 | None |
| `@ts-ignore` | 0 | None |
| `eslint-disable` | 0 | None |
| `.skip(` | 0 | None |
| `.only(` | 0 | None |
| `expect.anything()` | 0 | None |

**Assessment**: Current codebase has no workarounds. Plan must maintain this standard.

---

## Issues Found

### BLOCKING (must address before considering plan complete):

1. **Test files don't exist**: Plan says "update" `done.test.ts` and `release.test.ts` but these files don't exist. Plan should say "create" and provide expected test case coverage.

2. **Edge cases undefined**: Plan doesn't specify behavior for:
   - Worktree manually deleted before `sc done`
   - Remote unreachable during push check
   - Branch has no upstream tracking configured

3. **Specific test cases missing**: Plan lists test files but doesn't enumerate the specific test scenarios needed to verify safety checks work.

### WARNING (should address):

1. **Serializer behavior unspecified**: Does `pr: null` get written to file, or omitted? Plan should specify for backward compatibility.

2. **Timeout handling**: What happens if `git rev-list` hangs? Plan should specify timeout.

3. **Error messages**: Plan should specify exact error messages for each failure mode so tests can verify them.

4. **Manual testing unclear**: "Make changes without committing" - what kind of changes? The manual test script should be more specific.

---

## Conclusion

**Verdict: INCOMPLETE**

The plan is directionally sound and most claims are testable, but:

1. **Critical omission**: Test files claimed to be "updated" don't exist - this is a factual error in the plan
2. **Edge cases undefined**: Several failure scenarios have no specified behavior
3. **Test coverage claims are vague**: "Add tests for all safety functions" is not verifiable without specific test cases enumerated

**What's needed to reach VERIFIED**:

1. Change "update done.test.ts/release.test.ts" to "create done.test.ts/release.test.ts with the following test cases: [list]"

2. Add explicit behavior specifications for edge cases:
   - Missing worktree: `{ behavior: "error", message: "Worktree not found at {path}" }`
   - Remote unreachable: `{ behavior: "block", message: "Cannot verify remote status" }`
   - No upstream: `{ behavior: "block" | "allow", message: "..." }`

3. Enumerate specific test cases with expected outcomes in a table

4. Specify serializer behavior for `pr` field explicitly

---

## Recommendation

The implementing agent should address the BLOCKING issues above before proceeding. Specifically:

1. Verify test file existence and correct plan language
2. Make explicit decisions about edge case behavior
3. Create a test case enumeration table

Once these are addressed, the plan becomes VERIFIED and implementation can proceed with clear acceptance criteria.
