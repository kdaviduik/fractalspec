# Documentation Dependency Reference

Quick lookup: "I changed X, what docs do I update?"

## EARS Validation

**Code**: src/ears/patterns.ts, src/ears/validation.ts, src/ears/semantic-validator.ts

**Docs to Update**:
- CLAUDE.md - EARS Patterns section
- .claude/skills/sc-spec-workflow.md - Pattern quick reference, examples
- src/commands/ears.ts - Pattern suggestions, help text
- src/commands/validate.ts - Help text
- src/commands/create.ts - Template examples
- src/command-router.ts - Global help EARS section

## CLI Commands

**Code**: src/commands/*.ts

**Docs to Update**:
- Command's own `getHelp()` method (mandatory)
- src/command-router.ts - Global help COMMANDS section
- CLAUDE.md - Commands Reference section if workflow-related
- .claude/skills/sc-spec-workflow.md - If affects agent workflow

## Workflows

**Code**: src/claim-logic.ts, src/release-logic.ts, worktree operations

**Docs to Update**:
- CLAUDE.md - Agent Workflow section, Worktree Convention section
- .claude/skills/sc-spec-workflow.md - Workflow steps

## Validation Rules

**Code**: src/ears/validation.ts, src/ears/semantic-validator.ts, src/doctor.ts

**Docs to Update**:
- CLAUDE.md - Validation sections
- Related command help (validate, doctor, ears)
- .claude/skills/sc-spec-workflow.md - Good vs Bad examples

## Templates

**Code**: src/commands/create.ts template content

**Docs to Update**:
- CLAUDE.md - Examples sections (ensure consistency)
- Template itself must match current validation rules

## Status Values

**Code**: src/types.ts Status type, src/commands/list.ts getStatusIcon() function

**Docs to Update**:
- CLAUDE.md - Status Values table
- src/command-router.ts - Status descriptions in help
- src/commands/list.ts - Help text icon legend, getStatusIcon() mapping
- .claude/skills/sc-spec-workflow.md - Status-related workflow steps

## Help System

**Code**: src/help.ts, src/cli.ts help detection

**Docs to Update**:
- CLAUDE.md - Help System Standards section
- All command `getHelp()` implementations

## File Structure Conventions

**Code**: src/spec-filesystem.ts, src/id-generation.ts

**Docs to Update**:
- CLAUDE.md - File Structure section
- CLAUDE.md - Spec Format section

## ID Generation

**Code**: src/id-generation.ts

**Docs to Update**:
- CLAUDE.md - Spec Format section (6-character alphanumeric reference)
- CLAUDE.md - File Structure section (references to ID format)
- src/commands/create.ts - Help notes about ID generation

## Git Operations & Worktree Management

**Code**: src/git-operations.ts, src/claim-logic.ts, src/release-logic.ts

**Docs to Update**:
- CLAUDE.md - Worktree Convention section
- CLAUDE.md - Agent Workflow section (Claiming & Working, Completing Work, Abandoning Work)
- .claude/skills/sc-spec-workflow.md - Workflow steps
- src/commands/claim.ts - Help text about worktree creation
- src/commands/done.ts - Help text about cleanup
- src/commands/release.ts - Help text about cleanup
- src/command-router.ts - Global help WORKTREE WORKFLOW section

## Spec Frontmatter Schema

**Code**: src/types.ts - SpecFrontmatter interface

**Docs to Update**:
- CLAUDE.md - Spec Format section (Frontmatter Schema table)
- .claude/skills/sc-spec-workflow.md - Any references to frontmatter fields

## Archive Directory

**Location**: docs/archive/

**Status**: Historical design documents, not actively maintained.

**Note**: Content in docs/archive/ is kept for reference but not updated with code changes.
