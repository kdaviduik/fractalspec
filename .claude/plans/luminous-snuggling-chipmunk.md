# Plan: Review `sc set` Implementation Completeness

## Context

The user previously worked on adding the ability to edit spec properties programmatically via the CLI. They recall wanting to:
1. Edit **priority** of existing specs
2. Edit **title** of existing specs
3. Remove `sc deps` command
4. Allow setting **dependencies** (blocks/unblocks) programmatically
5. Allow setting **status** programmatically
6. **NOT** allow editing messages after creation

## Current State Analysis

### What's Implemented ✅

**`sc set` command** (`src/commands/set.ts` - 248 lines) provides:
- `--priority <1-10>` - Set priority (10 = highest)
- `--status <status>` - Set status (ready, in_progress, blocked, closed, deferred, not_planned)
- `--parent <id>` - Reparent to another spec
- `--parent none` - Make root spec (remove parent)
- `--block <id>` - Add blocking dependency
- `--unblock <id>` - Remove blocking dependency

**Features:**
- Idempotent operations (setting same value twice succeeds silently)
- Cycle detection for parent and blocker relationships
- Atomic writes (no temp files remain)
- Comprehensive validation (range checks, existence checks)
- Combined operations (multiple flags in single command)

**Test coverage** (`src/commands/set.test.ts` - 469 lines):
- 31 test cases covering all functionality
- Help documentation tests
- Validation error tests
- Priority, status, parent, block, unblock tests
- Cycle detection tests
- Idempotency tests
- Atomic write verification

**`sc deps` removal:**
- File deleted from disk (`src/commands/deps.ts` does not exist)
- Command NOT registered in `command-router.ts`
- NOT documented in global help
- NOT referenced in CLAUDE.md

### What's Missing ❌

**Title editing is NOT implemented:**
- `sc set` does NOT support a `--title` flag
- Grepping for "title" in `set.ts` returns zero matches
- The only way to change a spec's title is via `sc edit` (opens $EDITOR)

### Git Status

The following changes are **uncommitted**:
```
 M .claude/skills/sc-spec-workflow.md
 M .docs/dependencies.md
 M CLAUDE.md
 M src/claim-logic.test.ts
 M src/cli.ts
 M src/command-router.ts
 M src/commands/create.test.ts
 M src/commands/create.ts
 D src/commands/deps.ts
 M src/commands/doctor.ts
 M src/commands/list.ts
 M src/commands/remove.ts
 M src/ears/validation.test.ts
 M src/spec-filesystem.test.ts
 M src/spec-filesystem.ts
 M src/spec-parser.test.ts
 M src/spec-parser.ts
 M src/spec-query.test.ts
 M src/spec-query.ts
 M src/spec-serializer.test.ts
 M src/spec-tree.test.ts
 M src/types.test.ts
 M src/types.ts
?? docs/specs/
?? src/commands/set.test.ts
?? src/commands/set.ts
```

Key observations:
- `set.ts` and `set.test.ts` are **untracked** (new files)
- `deps.ts` is **deleted** but not yet committed
- Many other files have modifications

## Gap Analysis

| Feature | Implemented? | Notes |
|---------|--------------|-------|
| Edit priority | ✅ Yes | `sc set <id> --priority <1-10>` |
| Edit status | ✅ Yes | `sc set <id> --status <status>` |
| Edit dependencies (blocks) | ✅ Yes | `sc set <id> --block <id>` / `--unblock <id>` |
| Edit parent | ✅ Yes | `sc set <id> --parent <id>` / `--parent none` |
| Edit title | ❌ No | Not implemented - requires `sc edit` |
| Remove `sc deps` | ✅ Yes | Deleted but uncommitted |
| Message editing | N/A | Correctly NOT implemented (per user's stated preference) |

## Questions for User

1. **Title editing**: You mentioned wanting to edit "priority and title." The `--title` flag is not implemented. Do you want this added, or is using `sc edit` acceptable for title changes?

---

## Agent Plan Review Gate

**Reviewing Agents** (must all approve before presenting to user):

| Agent | Full Name | Model | Approval Criteria |
|-------|-----------|-------|-------------------|
| John | `john-ousterhout` | opus | Design quality, module depth, interface simplicity |
| Donna | `donna-docs-guardian` | opus | Documentation completeness, no stale references |
| Sheldon | `sheldon-code-guardian` | opus | Code quality, production reliability |
| Gray | `gray-verification-guardian` | opus | Claims verified with evidence |

### Review Summary

| Agent | Verdict | Summary |
|-------|---------|---------|
| John | ✅ APPROVE | Deep module, good separation of `sc set` vs `sc edit`; no `--title` is correct design |
| Donna | ⚠️ NEEDS ATTENTION | Main docs correct; skill file has stale priority terminology |
| Sheldon | ✅ COMPLETE | All flags tested, registered, documented, error paths covered |
| Gray | ✅ VERIFIED | 4/5 claims verified; minor test count discrepancy (36 tests, not 31) |

---

## Agent Findings Summary

### John's Design Review
- `sc set` is a **deep module** with good functionality-to-interface ratio
- **Correct separation**: `sc set` (programmatic metadata) vs `sc edit` ($EDITOR for content)
- **No `--title` flag is correct**: Title changes involve file/directory renaming, making `sc edit` the appropriate mechanism
- Minor suggestion: Refactor `parseArgs` to return result type instead of `process.exit`

### Donna's Documentation Audit
- ✅ CLAUDE.md is complete and accurate
- ✅ command-router.ts global help is accurate
- ✅ set.ts `getHelp()` is complete
- ⚠️ **Stale priority terminology** in `.claude/skills/sc-spec-workflow.md`:
  - Uses `--priority critical/high/normal/low` instead of numeric `1-10`
  - Would cause command failures if followed
  - Lines 18-21, 69-79 need updating

### Sheldon's Completeness Audit
- ✅ Test coverage comprehensive (36 tests across all flags, edge cases, cycles)
- ✅ Command registered in command-router.ts
- ✅ Help documentation complete with all flags
- ✅ All error paths covered

### Gray's Verification
- ✅ `sc deps` removed (file deleted, not in router)
- ✅ `sc set` supports all 5 flags (verified in code)
- ✅ `sc set` does NOT support title (grep confirms)
- ✅ Changes uncommitted (git status confirms)
- No suppression workarounds found (`@ts-ignore`, `eslint-disable`, etc.)

---

## Gap Analysis (Updated)

| Feature | Status | Notes |
|---------|--------|-------|
| Edit priority | ✅ Complete | `sc set <id> --priority <1-10>` |
| Edit status | ✅ Complete | `sc set <id> --status <status>` |
| Edit dependencies | ✅ Complete | `sc set <id> --block/--unblock <id>` |
| Edit parent | ✅ Complete | `sc set <id> --parent <id>/none` |
| Edit title | ❌ Not implemented | **John recommends keeping it this way** |
| Remove `sc deps` | ✅ Complete | Deleted but uncommitted |
| Documentation | ⚠️ One file stale | Skill file needs priority terminology update |

---

## Remaining Work

### Required
1. **Fix stale documentation** in `.claude/skills/sc-spec-workflow.md`
   - Replace `--priority critical/high/normal/low` with numeric `1-10`
   - Update sorting description

2. **Commit all changes** (currently uncommitted):
   - `src/commands/set.ts` (new)
   - `src/commands/set.test.ts` (new)
   - `src/commands/deps.ts` (deleted)
   - Various modified files

### User Decision: Title Editing
- **Decision**: No `--title` flag needed
- **Rationale**: Title changes affect file paths; `sc edit` is appropriate

---

## Implementation Plan

### Step 1: Fix stale documentation
**File**: `.claude/skills/sc-spec-workflow.md`

Replace named priority levels with numeric:
- `--priority critical` → `--priority 10`
- `--priority high` → `--priority 8`
- `--priority normal` → `--priority 5`
- `--priority low` → `--priority 2`
- Update sorting description to use numeric ranges

### Step 2: Implementation Review Gate (BLOCKING)

**INSTRUCTION FOR EXECUTING AGENT**: This is a BLOCKING gate. Before proceeding to commit, invoke the following agents for final review using the Task tool. Do not proceed until all agents approve.

**Agents to Invoke**:

| Agent | Full Name (use this) | Approval Criteria | Status |
|-------|---------------------|-------------------|--------|
| John | `john-ousterhout` | Design quality approved | [ ] Pending |
| Donna | `donna-docs-guardian` | Documentation complete, no stale refs | [ ] Pending |
| Sheldon | `sheldon-code-guardian` | Code quality, tests pass | [ ] Pending |
| Gray | `gray-verification-guardian` | All claims verified | [ ] Pending |

**Re-approval Rule**: If ANY agent requests changes, make the changes, then re-invoke ALL agents above.

### Step 3: Commit all changes
```bash
git add src/commands/set.ts src/commands/set.test.ts .claude/skills/sc-spec-workflow.md
git add -u  # Stage deletions and modifications
git commit -m "feat: add sc set command for programmatic spec property editing" \
  -m "Adds sc set command with flags:" \
  -m "- --priority <1-10>: Set priority level" \
  -m "- --status <status>: Set spec status" \
  -m "- --parent <id>|none: Set or remove parent" \
  -m "- --block <id>: Add blocking dependency" \
  -m "- --unblock <id>: Remove blocking dependency" \
  -m "" \
  -m "Also:" \
  -m "- Removes sc deps command (functionality now in sc set)" \
  -m "- Updates skill documentation with numeric priority format"
```

## Verification Plan

```bash
# 1. Verify skill file updated correctly
grep -n "priority" .claude/skills/sc-spec-workflow.md | head -20

# 2. Run tests
bun run test

# 3. Verify lint passes
bun run lint

# 4. Verify command works
bun run src/cli.ts set --help
```

## Summary

**Status**: Implementation is COMPLETE. Only documentation cleanup and commit remain.

**What's done**:
- ✅ `sc set` command with 5 flags (priority, status, parent, block, unblock)
- ✅ Comprehensive tests (36 test cases)
- ✅ Help documentation
- ✅ `sc deps` removed
- ✅ User confirmed no `--title` flag needed

**What remains**:
- ⏳ Fix skill file priority terminology
- ⏳ Commit changes
