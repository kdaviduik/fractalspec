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

**Code**: src/types.ts Status type

**Docs to Update**:
- CLAUDE.md - Status Values table
- src/command-router.ts - Status descriptions in help
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
