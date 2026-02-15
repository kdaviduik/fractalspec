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
  - "Installation & Setup" section - worktree path description
  - "Claim Modes" section - location and cleanup
  - "Agent Workflow" section - workflow examples
  - "Configuration" note - specs root path
  - "Help System Standards" section - cleanup requirement references
- .claude/skills/sc-spec-workflow.md
  - "Claim the Spec" section
  - "Complete" section
  - "Common Pitfalls" section
  - "Claim Modes" section
- src/commands/claim.ts - getHelp() description and examples
- src/commands/done.ts - getHelp() description and examples
- src/commands/release.ts - getHelp() description and examples
- src/command-router.ts - BRANCH & WORKTREE WORKFLOW section in printHelp()
- README.md - if it contains worktree-related documentation
- src/commands/create.ts - template spec content if it shows path examples
- .docs/dependencies.md - this file (update after implementation)

## CLI Commands & Help System

**Code**:
- src/commands/*.ts (any new or modified command)
- src/help.ts (help infrastructure)
- src/command-router.ts (global help)

**Docs to Update**:
- CLAUDE.md - "Help System Standards" section
- Command getHelp() methods when behavior changes

## Spec Validation & EARS Patterns

**Code**:
- src/ears/validation.ts
- src/commands/validate.ts

**Docs to Update**:
- CLAUDE.md - "EARS Patterns" section
- src/commands/validate.ts - getHelp() description

## Status Values & Workflow States

**Code**:
- src/types.ts (Status type definition, COMPLETED_STATUSES constant)
- src/commands/claim.ts, done.ts, release.ts (status changes)
- src/spec-query.ts (blocker resolution uses COMPLETED_STATUSES)
- src/commands/doctor.ts (parent auto-close uses COMPLETED_STATUSES)

**Docs to Update**:
- CLAUDE.md - "Spec Format" section (status values table)
- CLAUDE.md - "Critical Type Definitions" section (COMPLETED_STATUSES)
- CLAUDE.md - "Agent Workflow" section (status state descriptions)
- .claude/skills/sc-spec-workflow.md (workflow state machine)

## Git Operations & Worktree Management

**Code**:
- src/git-operations.ts (git command execution, safety checks)
- src/commands/claim.ts (worktree creation)
- src/commands/done.ts (worktree cleanup, safety checks)
- src/commands/release.ts (worktree cleanup, safety checks)
- src/claim-logic.ts (checkClaimSafety function)

**Docs to Update**:
- CLAUDE.md - "Claim Modes" section (locations and behavior)
- CLAUDE.md - "Agent Workflow" section (when and how to use worktrees)
- CLAUDE.md - "Workflow" command table (safety checks, --force flag)
- .claude/skills/sc-spec-workflow.md (worktree lifecycle, safety checks)
- Command help (getHelp()) for claim, done, release
- src/command-router.ts - Workflow section in printHelp()

## PR Tracking

**Code**:
- src/types.ts (pr field in SpecFrontmatter)
- src/spec-parser.ts (parsing pr field)
- src/spec-serializer.ts (serializing pr field)
- src/commands/set.ts (--pr flag)
- src/commands/show.ts (displaying pr field)

**Docs to Update**:
- CLAUDE.md - "Frontmatter Schema" table (pr field)
- CLAUDE.md - "Spec Format" example (add pr: null)
- CLAUDE.md - "Critical Type Definitions" section (SpecFrontmatter interface)
- CLAUDE.md - "Property Modification" table (--pr flag)
- .claude/skills/sc-spec-workflow.md (PR tracking section)
- src/commands/set.ts - getHelp() (--pr flag)
- src/commands/show.ts - getHelp() (pr field in output)
- src/command-router.ts - Property Modification section in printHelp()

## File Structure & Naming Conventions

**Code**:
- src/spec-filesystem.ts (file path construction)
- src/commands/create.ts (spec creation and template)

**Docs to Update**:
- CLAUDE.md - "File Structure" section
- CLAUDE.md - "Spec Format" section
- .claude/skills/sc-spec-workflow.md (if it shows file examples)

## Spec Removal (remove command)

**Code**:
- src/commands/remove.ts
- src/spec-filesystem.ts (deleteSpec function)
- src/claim-logic.ts (uses isSpecClaimed)

**Docs to Update**:
- CLAUDE.md - "Commands Reference" table (Maintenance section)
- CLAUDE.md - "Removing Specs" workflow section
- src/commands/remove.ts - getHelp() documentation
- src/command-router.ts - Maintenance section in printHelp()
- .docs/dependencies.md - this file (update after implementation)

**Related Commands** (users should consult before removal):
- `sc show <id>` - Check what specs block this one (shows blockers in details)
- `sc list --tree` - Visualize parent-child hierarchy
- `sc doctor --fix` - Recover from partial deletion failures

## Shell Integration (init command)

**Code**:
- src/commands/init.ts (shell function generation)
- src/commands/claim.ts (--cd flag behavior, hint for non-init users)

**Docs to Update**:
- CLAUDE.md - "Installation & Setup" section (sc init setup step), "Quick Start", "Commands Reference" (Setup section), "Claim Modes", "Agent Workflow" claiming section
- .claude/skills/sc-spec-workflow.md - "Claim the Spec" section (sc init as primary approach)
- src/commands/claim.ts - getHelp() examples and notes (sc init references)
- src/command-router.ts - BRANCH & WORKTREE WORKFLOW section, Setup section in COMMANDS, EXAMPLES section
- README.md - Quick Start section (sc init mention)
- .docs/dependencies.md - this file

## Blocker Resolution & Stale Blocked Detection

**Code**:
- src/spec-query.ts (isEffectivelyReady logic in findReadySpecs)
- src/commands/doctor.ts (findStaleBlocked, fixStaleBlocked)

**Docs to Update**:
- CLAUDE.md - "Discovery & Viewing" commands table (--ready description), "Sorting behavior" paragraph
- src/commands/list.ts - getHelp() --ready flag description
- src/commands/doctor.ts - getHelp() detects list and notes
- src/command-router.ts - --ready description in COMMANDS section
- .claude/skills/sc-spec-workflow.md - "Find Available Work" section, "Health Checks" section
- .docs/dependencies.md - this file

## Tree View & Sorting

**Code**:
- src/spec-tree.ts (tree building, sorting, rendering)
- src/spec-query.ts (ready list sorting, computeDepths usage)

**Docs to Update**:
- CLAUDE.md - "Discovery & Viewing" commands table (--tree description)
- CLAUDE.md - "Sorting behavior" paragraph under Priority Values
- src/commands/list.ts - getHelp() --tree and --ready flag descriptions
- src/command-router.ts - --tree flag in COMMANDS section, --ready description in COMMANDS section
- .docs/dependencies.md - this file

## Parent Spec Handling

**Code**:
- src/spec-query.ts (getParentSpecIds, findReadySpecs parent filtering)
- src/commands/claim.ts (parent spec claim guard)
- src/commands/set.ts (in_progress parent guard)
- src/commands/doctor.ts (unclosed parent detection, smart status matching, cascade fix)
- src/commands/list.ts (exclusion footer in --ready output)
- src/types.ts (COMPLETED_STATUSES constant)

**Docs to Update**:
- CLAUDE.md - "Commands Reference" tables (list --ready description, claim description, doctor description)
- CLAUDE.md - "Property Modification" table (in_progress restriction for parent specs)
- CLAUDE.md - Sorting behavior note (parent exclusion)
- .claude/skills/sc-spec-workflow.md - "Find Available Work" section, "Health Checks" section
- src/commands/list.ts - getHelp() --ready flag description
- src/commands/claim.ts - getHelp() notes section
- src/commands/set.ts - getHelp() notes section
- src/commands/doctor.ts - getHelp() detects list and notes
- src/command-router.ts - doctor description in printHelp()
- .docs/dependencies.md - this file

## Parse Failure Detection

**Code**:
- src/types.ts (validateSpecFrontmatter, FrontmatterValidationError)
- src/spec-parser.ts (ParseError with field/actualValue)
- src/spec-filesystem.ts (readAllSpecs returns failures, SpecParseFailure type)
- src/commands/doctor.ts (parse_failure detection, STATUS_ALIASES, --fix auto-repair)
- src/commands/list.ts (one-line warning when failures exist)
- src/commands/show.ts (parse error details for broken specs)

**Docs to Update**:
- CLAUDE.md - "Validation & Health" section (doctor description)
- src/commands/doctor.ts - getHelp() detects list and notes
- src/command-router.ts - doctor description in printHelp()
- .claude/skills/sc-spec-workflow.md - "Health Checks" section
- .docs/dependencies.md - this file

## Spec Content Editing (Section Overrides)

**Code**:
- src/markdown-sections.ts (core section parsing, boilerplate detection)
- src/commands/create.ts (--overview, --goals, --tasks, etc. content flags)
- src/commands/set.ts (--overview, --goals, --tasks, etc. smart-append flags)
- src/commands/doctor.ts (boilerplate_content health check)

**Docs to Update**:
- CLAUDE.md - "Creation & Editing" table (content flags for create)
- CLAUDE.md - "Property Modification" table (content flags for set)
- CLAUDE.md - "Validation & Health" table (boilerplate detection in doctor)
- .claude/skills/sc-spec-workflow.md - "Creating Specs" section, "Health Checks" section
- src/commands/create.ts - getHelp() (content flags)
- src/commands/set.ts - getHelp() (content flags with smart-append)
- src/commands/doctor.ts - getHelp() (boilerplate detection)
- src/command-router.ts - create, set, and doctor sections in printHelp()
- .docs/dependencies.md - this file
