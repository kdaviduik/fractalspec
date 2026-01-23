# Documentation Dependencies

Quick lookup: "I changed X, what docs do I update?"

## Worktree & Repository Structure

**Code**:
- src/commands/claim.ts
- src/commands/done.ts
- src/commands/release.ts
- src/git-operations.ts
- src/spec-filesystem.ts
- src/commands/create.ts

**Docs to Update**:
- CLAUDE.md
  - Installation & Setup section (line ~58) - worktree path description
  - Worktree Convention section (lines 176-185) - location and cleanup
  - Agent Workflow section (lines 254-294) - workflow examples
  - Configuration section (line 58) - specs root path
  - Help System Standards section (lines 550, 587) - cleanup requirement references
- .claude/skills/sc-spec-workflow.md
  - Claim workflow section (lines 18-22)
  - Complete workflow section (lines 51-56)
  - Common Pitfalls section (lines 111-112)
  - Worktree Convention section (lines 132-134)
- src/commands/claim.ts - getHelp() description and examples
- src/commands/done.ts - getHelp() description and examples
- src/commands/release.ts - getHelp() description and examples
- src/command-router.ts - WORKTREE WORKFLOW section (lines 77-90)
- README.md - if it contains worktree-related documentation
- src/commands/create.ts - template spec content if it shows path examples
- .docs/dependencies.md - this file (update after implementation)

## CLI Commands & Help System

**Code**:
- src/commands/*.ts (any new or modified command)
- src/help.ts (help infrastructure)
- src/command-router.ts (global help)

**Docs to Update**:
- CLAUDE.md - Help System Standards section (comprehensive help docs)
- .claude/skills/sc-help-system-guide.md - if it exists
- Command getHelp() methods when behavior changes

## Spec Validation & EARS Patterns

**Code**:
- src/ears/validation.ts
- src/commands/validate.ts

**Docs to Update**:
- CLAUDE.md - EARS Patterns section
- src/commands/validate.ts - getHelp() description
- .claude/skills/sc-validation-guide.md - if it exists

## Status Values & Workflow States

**Code**:
- src/types.ts (Status type definition)
- src/commands/claim.ts, done.ts, release.ts (status changes)

**Docs to Update**:
- CLAUDE.md - Spec Format section (status values table)
- CLAUDE.md - Agent Workflow section (status state descriptions)
- .claude/skills/sc-spec-workflow.md (workflow state machine)

## Git Operations & Worktree Management

**Code**:
- src/git-operations.ts (git command execution)
- src/commands/claim.ts (worktree creation)
- src/commands/done.ts (worktree cleanup)
- src/commands/release.ts (worktree cleanup)

**Docs to Update**:
- CLAUDE.md - Worktree Convention section (locations and behavior)
- CLAUDE.md - Agent Workflow section (when and how to use worktrees)
- .claude/skills/sc-spec-workflow.md (worktree lifecycle)
- Command help (getHelp()) for claim, done, release

## File Structure & Naming Conventions

**Code**:
- src/spec-filesystem.ts (file path construction)
- src/commands/create.ts (spec creation and template)

**Docs to Update**:
- CLAUDE.md - File Structure section
- CLAUDE.md - Spec Format section
- .claude/skills/sc-spec-workflow.md (if it shows file examples)

## Spec Removal (remove command)

**Code**:
- src/commands/remove.ts
- src/spec-filesystem.ts (deleteSpec function)
- src/claim-logic.ts (uses isSpecClaimed)

**Docs to Update**:
- CLAUDE.md - Commands Reference table (Maintenance section)
- CLAUDE.md - "Removing Specs" workflow section
- src/commands/remove.ts - getHelp() documentation
- src/command-router.ts - Global help printHelp() function (Maintenance section)
- .docs/dependencies.md - this file (update after implementation)

**Related Commands** (users should consult before removal):
- `sc show <id>` - Check what specs block this one (shows blockers in details)
- `sc list --tree` - Visualize parent-child hierarchy
- `sc doctor --fix` - Recover from partial deletion failures
