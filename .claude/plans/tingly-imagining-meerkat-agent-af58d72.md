# Documentation Audit Results

**Mode**: Plan Review
**Status**: NEEDS ATTENTION

---

## Summary

Reviewing the plan to add `--cd` flag to `sc claim` command. The plan identifies most documentation touchpoints but misses a few, and the existing `.docs/dependencies.md` should be consulted and updated.

---

## Findings

### BLOCKING

None.

### ADVISORY

**1. Missing Documentation Update: `.claude/skills/sc-spec-workflow.md`**
- **File**: `/Users/karadaviduik/src/tries/2026-01-16-fractalspec/main/.claude/skills/sc-spec-workflow.md`
- **Lines affected**: 25-29
- **Why it matters**: The skill file shows the claim workflow with an explicit manual `cd` step:
  ```bash
  sc claim <spec-id>
  cd ../work-<slug>-<spec-id>
  ```
  After adding `--cd`, this section should mention the shell function pattern as an alternative approach.
- **Fix**: Add a note about the `--cd` flag as an alternative after the manual cd example, or add a dedicated "Shell Integration" subsection.

**2. Missing Documentation Update: `.docs/dependencies.md`**
- **File**: `/Users/karadaviduik/src/tries/2026-01-16-fractalspec/main/.docs/dependencies.md`
- **Why it matters**: This file exists and maps `src/commands/claim.ts` to documentation dependencies. After adding the `--cd` flag, this dependency map should be verified as still accurate (it already is) and the file should be updated if any new documentation touchpoints are identified.
- **Fix**: Verify the entry at lines 8-33 covers this change (it does). No changes needed unless you add new docs.

**3. README.md Shows `sc claim` Without Flag**
- **File**: `/Users/karadaviduik/src/tries/2026-01-16-fractalspec/main/README.md`
- **Line**: 32
- **Current content**: `sc claim <spec-id>`
- **Why it matters**: This is the Quick Start section. While not technically wrong (the basic command still works), consider whether users should see the shell function pattern here for better UX.
- **Fix**: Advisory only - the existing example remains valid. Consider adding a one-liner comment about the `--cd` flag option, OR keep it simple since README links to CLAUDE.md for comprehensive docs.

**4. CLAUDE.md Agent Workflow Section**
- **File**: `/Users/karadaviduik/src/tries/2026-01-16-fractalspec/main/CLAUDE.md`
- **Lines**: 303-307 (Claiming & Working section)
- **Current content**:
  ```bash
  # 1. Claim the spec (creates worktree as sibling to repository root)
  sc claim ABC123

  # 2. Switch to the work worktree (example: spec titled "Feature Name")
  cd ../work-feature-name-ABC123
  ```
- **Why it matters**: This workflow example should mention the `--cd` alternative for completeness.
- **Fix**: Add a note like "Alternatively, use `eval \"$(sc claim --cd ABC123)\"` to claim and cd in one step."

**5. CLAUDE.md Worktree Workflow Section (Global Help Mirror)**
- **File**: `/Users/karadaviduik/src/tries/2026-01-16-fractalspec/main/CLAUDE.md`
- **Lines**: 223-231 (Worktree Convention section)
- **Why it matters**: Documents worktree behavior but doesn't mention the cd workflow. While accurate, adding the `--cd` option here would be contextually appropriate.
- **Fix**: Consider adding a brief note about `--cd` flag in the context of worktree usage.

**6. command-router.ts Global Help - Multiple Locations**
- **File**: `/Users/karadaviduik/src/tries/2026-01-16-fractalspec/main/src/command-router.ts`
- **Lines affected**:
  - Line 83: Workflow diagram shows `sc claim <id>`
  - Line 103-106: Command synopsis `claim <id>` without flags
  - Line 186: Example shows `sc claim a1b2c3`
- **Why it matters**: Plan mentions updating synopsis but there are 3 places where claim appears.
- **Fix**: Update all three locations:
  1. Line 83: `sc claim <id> [--cd]`
  2. Line 103: Add `--cd` flag documentation
  3. Line 186: Optionally show the `--cd` variant in examples

### NOTE

**1. Existing Plan File**
- **File**: `/Users/karadaviduik/src/tries/2026-01-16-fractalspec/main/.claude/plans/tingly-imagining-meerkat.md`
- **Observation**: There's already a detailed plan file for this feature. The plan shows good awareness of documentation needs.
- **Suggestion**: Ensure this audit is referenced in the plan or the plan is updated with the additional documentation touchpoints identified here.

**2. claim.ts getHelp() Already Identified**
- The plan correctly identifies updating `getHelp()` in `claim.ts`. The current examples (lines 28-34) show manual cd workflow. New examples should include the `--cd` pattern.

---

## Checklist: All Documentation Touchpoints

Your plan should update these files:

| File | Section | Update Needed |
|------|---------|--------------|
| `src/commands/claim.ts` | `getHelp()` - flags array | Add `--cd, -C` flag definition |
| `src/commands/claim.ts` | `getHelp()` - examples | Add eval/shell function examples |
| `src/command-router.ts` | Line 83 (workflow diagram) | Add `[--cd]` to claim step |
| `src/command-router.ts` | Line 103-106 (Workflow section) | Add `--cd` flag documentation |
| `src/command-router.ts` | Line 186 (Examples section) | Consider `--cd` example |
| `CLAUDE.md` | Commands Reference table (line 107) | Add `--cd` flag description |
| `CLAUDE.md` | Worktree Convention (lines 223-231) | Consider `--cd` mention |
| `CLAUDE.md` | Agent Workflow - Claiming (lines 303-307) | Add `--cd` alternative example |
| `.claude/skills/sc-spec-workflow.md` | Claim section (lines 24-29) | Add `--cd` alternative |
| `README.md` | Quick Start (line 32) | Optional: keep simple or add brief note |
| `.docs/dependencies.md` | Verify coverage | Already covers claim.ts (no change needed) |

---

## What's Done Well

1. **Plan identifies key files**: `claim.ts`, `command-router.ts`, and `CLAUDE.md` are correctly identified
2. **Dependency map exists**: The project has `.docs/dependencies.md` which maps claim.ts to documentation
3. **Help system pattern understood**: Plan mentions updating `getHelp()` per project standards
4. **Test file included**: `claim.test.ts` is in the plan

---

## Recommended Actions

1. **Add `.claude/skills/sc-spec-workflow.md` to plan** - This skill file shows claim workflow and should mention `--cd`

2. **Expand CLAUDE.md updates** - Plan mentions "Update Commands Reference table" but should also note:
   - Worktree Convention section (optional)
   - Agent Workflow section (recommended)

3. **Detail command-router.ts updates** - Plan says "Add `--cd` flag to claim command synopsis" but there are 3 locations to update

4. **Consider README.md** - Decide whether to update or leave simple (advisory only)

5. **Commit message should mention docs** - Per project standards, format like: `feat(claim): add --cd flag for shell evaluation + update docs`

---

## Grep Patterns for Post-Implementation Verification

After implementing, run these to verify no stale references:

```bash
# Find any remaining "cd ../work-" patterns that might need updating
grep -rn "cd \.\./work-" --include="*.md" .

# Find all claim command examples
grep -rn "sc claim" --include="*.md" .

# Verify all documentation mentioning claim workflow
grep -rn "claim.*worktree\|worktree.*claim" --include="*.md" .
```

---

## Verdict

**NEEDS ATTENTION** - The plan is solid but misses the skill file (`.claude/skills/sc-spec-workflow.md`) which is a key documentation touchpoint for agent workflows. Adding this file and expanding the CLAUDE.md update scope will ensure no documentation becomes stale when the feature ships.

The `.docs/dependencies.md` file was consulted and confirms the documentation touchpoints. No blocking issues found.
