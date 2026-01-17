# Agentic Development Workflow

A structured approach to building features with LLM agents using documentation that flows from product requirements to implementation tasks.

## Document Types

| Document | Purpose | Size | Location |
|----------|---------|------|----------|
| **PRD** | Complete source of truth for *what* and *why* | Small-Large | `docs/prd.md` |
| **SDD** | Tech foundation: stack, schema, conventions | Medium (keep concise) | `docs/sdd.md` |
| **Feature Spec** | Self-contained *what* + *how* for one feature | Small-medium | `docs/specs/[feature].md` |
| **Task List** | TDD-ordered implementation steps | Medium | `docs/tasks/tasks-[feature].md` |

## Scope: Feature vs Epic

The PRD declares its scope, which determines the workflow:

```markdown
> **Status**: Draft | Active | Implemented | Archived
> **Scope**: Feature | Epic
```

| Scope | When to Use | Workflow |
|-------|-------------|----------|
| **Feature** | Small-medium work (days), existing codebase, self-contained | PRD → Tasks |
| **Epic** | Large work (weeks), greenfield, multiple features | PRD → SDD → Feature Specs → Tasks |

---

## Feature Workflow (Simplified)

For smaller, self-contained work where full documentation is overkill.

```
PRD (Feature scope)
 |
 |  [Complete what/why, small enough for implementation LLM]
 v
Task List
 |
 |  [Tech decisions captured in Notes section]
 v
Implementation
```

### Step 1: Create PRD

**Prompt:** `create-prd.md`

**LLM:** Planning (smart) - e.g., Claude Opus 4.5

**Context given to LLM:**
- The prompt
- User's feature description

**Output:** `docs/prd.md` (with `Scope: Feature`)

**Human action:** Review, iterate until complete

---

### Step 2: Generate Task List

**Prompt:** `create-tasks.md`

**LLM:** Planning (smart) - e.g., Claude Opus 4.5

**Context given to LLM:**
- The prompt
- PRD (`docs/prd.md`)
- Existing codebase (if applicable)

**Output:** `docs/tasks/tasks-[feature-name].md`

**Key behavior:** Since no SDD exists, the task list Notes section includes relevant tech stack decisions and conventions.

**Human action:**
1. Review parent tasks when LLM pauses
2. Say "Go" to generate sub-tasks
3. Review complete task list

---

### Step 3: Implement Tasks

**LLM:** Implementation (can be smaller) - e.g., Claude Sonnet, Qwen Coder 7B

**Context given to LLM:**
- PRD (`docs/prd.md`)
- Task List (`docs/tasks/tasks-[feature-name].md`)
- Relevant source code files

**Human action:**
- Run tests as LLM requests
- Provide test output back to LLM
- Review and commit code when tests pass

---

### Feature Context Summary

| Step | Planning LLM Gets | Implementation LLM Gets |
|------|-------------------|------------------------|
| 1. PRD | prompt + user input | — |
| 2. Task List | prompt + PRD + codebase | — |
| 3. Implement | — | PRD + Task List + code |

---

## Epic Workflow (Full)

For larger products with multiple features requiring shared technical foundation.

```
PRD (Epic scope)
 |
 |  [Created once per product]
 v
SDD (system-level)
 |
 |  [Created once, updated as system evolves]
 v
Feature Spec (feature-level)  ─────>  Task List
 |                                         |
 |  [One per feature]                      |  [One per feature]
 v                                         v
Implementation
```

### Step 1: Create PRD

**Prompt:** `create-prd.md`

**LLM:** Planning (smart) - e.g., Claude Opus 4.5

**Context given to LLM:**
- The prompt
- User's product description

**Output:** `docs/prd.md` (with `Scope: Epic`)

**Human action:** Review, iterate until complete

---

### Step 2: Create SDD

**Prompt:** `create-sdd.md`

**LLM:** Planning (smart) - e.g., Claude Opus 4.5

**Context given to LLM:**
- The prompt
- PRD (`docs/prd.md`)

**Output:** `docs/sdd.md`

**Human action:** Review tech choices, iterate until satisfied

---

### Step 3: Create Feature Spec

**Prompt:** `create-feature-spec.md`

**LLM:** Planning (smart) - e.g., Claude Opus 4.5

**Context given to LLM:**
- The prompt
- PRD (`docs/prd.md`)
- SDD (`docs/sdd.md`)

**Output:** `docs/specs/[feature-name].md`

**Human action:** Review, ensure all relevant PRD requirements are extracted

**Key behavior:** LLM extracts relevant PRD sections *verbatim* with section references, so the Feature Spec is self-contained.

---

### Step 4: Generate Task List

**Prompt:** `create-tasks.md`

**LLM:** Planning (smart) - e.g., Claude Opus 4.5

**Context given to LLM:**
- The prompt
- PRD (`docs/prd.md`)
- SDD (`docs/sdd.md`)
- Feature Spec (`docs/specs/[feature-name].md`)

**Output:** `docs/tasks/tasks-[feature-name].md`

**Human action:**
1. Review parent tasks when LLM pauses
2. Say "Go" to generate sub-tasks
3. Review complete task list

---

### Step 5: Implement Tasks

**LLM:** Implementation (can be smaller) - e.g., Claude Sonnet, Qwen Coder 7B

**Context given to LLM:**
- SDD (`docs/sdd.md`)
- Feature Spec (`docs/specs/[feature-name].md`)
- Task List (`docs/tasks/tasks-[feature-name].md`)
- Relevant source code files

**NOT given:**
- Full PRD (too large, not needed)

**Human action:**
- Run tests as LLM requests
- Provide test output back to LLM
- Review and commit code when tests pass

---

### Epic Context Summary

| Step | Planning LLM Gets | Implementation LLM Gets |
|------|-------------------|------------------------|
| 1. PRD | prompt + user input | — |
| 2. SDD | prompt + PRD | — |
| 3. Feature Spec | prompt + PRD + SDD | — |
| 4. Task List | prompt + PRD + SDD + Feature Spec | — |
| 5. Implement | — | SDD + Feature Spec + Task List + code |

**Key insight:** The PRD is only used by the planning LLM. Implementation LLMs receive the curated Feature Spec instead.

---

## Choosing Scope

| Factor | Feature | Epic |
|--------|---------|------|
| Timeline | Days | Weeks |
| Codebase | Existing (tech implicit) | Greenfield or major changes |
| PRD size | Small enough for implementation LLM | Too large for implementation context |
| Team | Solo or small | Multiple contributors |
| Features | Single, self-contained | Multiple interdependent features |

**When in doubt:** Start with Feature scope. You can always "upgrade" to Epic by creating an SDD later if the project grows.

---

## Updating Documents

### When PRD Changes (Feature Scope)

1. Update PRD
2. Regenerate Task List

### When PRD Changes (Epic Scope)

1. Update PRD
2. Check if SDD needs updates (rarely)
3. Update affected Feature Specs (re-extract relevant sections)
4. Regenerate affected Task Lists

### When SDD Changes (Epic Only)

1. Update SDD
2. Review existing Feature Specs for compatibility
3. Update Task Lists if conventions changed

### After Implementation

1. Mark PRD/Feature Spec status: `Implemented`
2. Mark Task List status: `Complete`
3. Update SDD if schema or patterns changed (Epic only)

---

## Status Values

All documents use consistent status values:

| Status | Meaning |
|--------|---------|
| `Draft` | Created, not yet reviewed/approved |
| `Active` | Approved and in use |
| `Implemented` / `Complete` | Work is done |
| `Archived` | No longer relevant |

---

## File Structure

### Feature Scope
```
docs/
  prd.md                    # Product requirements
  tasks/
    tasks-[feature].md      # Task list
```

### Epic Scope
```
docs/
  prd.md                    # Product requirements
  sdd.md                    # System design
  specs/
    user-auth.md            # Feature spec
    dashboard.md            # Feature spec
    notifications.md        # Feature spec
  tasks/
    tasks-user-auth.md      # Task list
    tasks-dashboard.md      # Task list
    tasks-notifications.md  # Task list
```

---

## Quick Reference: Which Prompt When?

| I want to... | Use prompt | Scope |
|--------------|------------|-------|
| Define a new product/feature | `create-prd.md` | Both |
| Set up technical foundation | `create-sdd.md` | Epic only |
| Plan a specific feature within an epic | `create-feature-spec.md` | Epic only |
| Generate implementation steps | `create-tasks.md` | Both |

---

## TDD Enforcement

All task lists follow outside-in TDD:

1. **Test first**: Every implementation task is preceded by a test task
2. **One test at a time**: Write test → fail → implement → pass → next
3. **Verification steps**: Each parent task ends with test verification
4. **Behavior is authoritative**: Tests define correctness, not implementation

This prevents LLM-generated code from drifting and makes review easier.

---

## Tips for Success

1. **Start with Feature scope when unsure** - You can always upgrade to Epic if the project grows.

2. **Invest time in the PRD** - Garbage in, garbage out. A thorough PRD makes everything downstream better.

3. **Keep SDD concise** (Epic) - It goes in every implementation context. Every word should earn its place.

4. **Feature Specs should be self-contained** (Epic) - If the implementation LLM needs to ask "but what about X?", the spec is incomplete.

5. **Trust the TDD process** - It feels slower but catches bugs early and keeps LLMs honest.

6. **Update docs when things change** - Stale docs cause implementation bugs. Add revision notes.
