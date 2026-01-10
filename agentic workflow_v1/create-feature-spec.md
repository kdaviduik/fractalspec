# Rule: Feature Spec Generation & Modification

## Purpose

Guide the creation or modification of a Feature Spec that combines *what* and *how* for a single feature. The Feature Spec extracts relevant requirements from the PRD and adds implementation details, creating a self-contained document for implementation.

This document is fed to implementation LLMs along with the SDD. It must be complete enough that the implementer never needs to reference the full PRD.

## Prerequisites

Both a PRD and SDD must exist before creating a Feature Spec.

## Behavior

### Detect Mode

First, determine the operating mode:

1. **Create Mode**: User requests a Feature Spec for a specific feature
2. **Modify Mode**: User references an existing Feature Spec or asks to update it

If unclear, ask: "Are we creating a new Feature Spec or modifying an existing one?"

---

## Create Mode

### Step 1: Load PRD & SDD

1. Read the PRD completely
2. Read the SDD completely
3. Identify which PRD sections are relevant to this feature
4. Summarize your understanding in 2-3 sentences

### Step 2: Gather Implementation Context

Ask clarifying questions about this specific feature's implementation.

**Core questions to consider** (adapt based on feature):

| Area | Example Questions |
|------|-------------------|
| Scope | Which PRD requirements does this feature cover? |
| Boundaries | What's explicitly NOT part of this feature? |
| UI/UX | Any wireframes or specific UI requirements? |
| Data | What new or modified data does this feature need? |
| APIs | What endpoints does this feature require? |
| Dependencies | Does this depend on other features being complete? |
| Edge Cases | What error conditions should be handled? |
| Testing | Any specific test scenarios to cover? |

**Guidelines for questions:**
- Ask as many questions as needed to produce a complete, implementable spec
- Focus on feature-specific details (system-wide patterns are in SDD)
- If PRD requirements are ambiguous for this feature, clarify
- Continue asking follow-up questions across multiple rounds if needed

### Step 3: Generate Feature Spec

Use this structure:

```markdown
# Feature Spec: [Feature Name]

> **Status**: Draft | Active | Implemented | Archived
> **PRD**: [link to prd.md]
> **SDD**: [link to sdd.md]

## Overview
[2-3 sentences: what this feature does and why it matters]

## Relevant PRD Requirements

[Extract verbatim the PRD requirements this feature implements. 
Include the section reference so updates can be traced back.]

### From PRD Section: [Section Name]
> [Quoted requirement 1]
> - Acceptance: [criteria]
> - Example: [example]

> [Quoted requirement 2]
> - Acceptance: [criteria]

### From PRD Section: [Section Name]
> [Quoted requirements...]

## User Stories
[Feature-specific user stories, can be subset of PRD or refined]

- As a [user type], I want to [action] so that [benefit]

## Scope

### In Scope
- [What this feature includes]

### Out of Scope
- [What this feature explicitly excludes - may be other features]

## Dependencies
[Other features or components that must exist first]

- [Dependency]: [Why it's needed]

## Schema Changes

[Changes to the database for this feature. Reference SDD for existing schema.]

### New Tables
#### [table_name]
```
id              -- primary key
[field]         -- [description]
[foreign_key]   -- references [existing_table]
created_at      -- timestamp
updated_at      -- timestamp
```

### Modified Tables
#### [existing_table_name]
- Add: `[field_name]` ([type]) -- [reason]
- Remove: `[field_name]` -- [reason]

### Migrations Needed
1. [Description of migration]
2. [Description of migration]

## API Design

[New or modified endpoints for this feature. Follow conventions in SDD.]

### [HTTP Method] [Path]
- **Purpose**: [What this endpoint does]
- **Auth**: [Required role/permission per SDD auth model]
- **Request**:
  ```json
  {
    "field": "type -- description"
  }
  ```
- **Response (success)**:
  ```json
  {
    "field": "type -- description"
  }
  ```
- **Errors**:
  | Code | Condition |
  |------|-----------|
  | 400 | [When this occurs] |
  | 404 | [When this occurs] |

## UI Components

[New UI components needed for this feature]

### [Component Name]
- **Purpose**: [What it does]
- **Props/Inputs**: [What data it receives]
- **Behavior**: [How it responds to interaction]
- **States**: [Loading, error, empty, populated]

## Logic & Algorithms

[Complex business logic that needs explanation]

### [Process Name]
**Input**: [What it receives]
**Output**: [What it produces]
**Steps**:
1. [Step]
2. [Step]

**Edge Cases**:
- [Condition]: [How handled]

## Error Handling

[How errors specific to this feature should be handled]

| Error Condition | User Message | Technical Handling |
|-----------------|--------------|-------------------|
| [Condition] | [What user sees] | [What system does] |

## Testing Requirements

[Specific test cases for this feature]

### Unit Tests
- [ ] [Test case description]
- [ ] [Test case description]

### Integration Tests
- [ ] [Test case description]

### E2E Tests
- [ ] [User flow to test]

## Implementation Notes

[Guidance for the implementer - patterns to use, pitfalls to avoid]

### Recommended Approach
- [Suggestion with reasoning]

### Pitfalls to Avoid
- [What not to do]: [Why]

## Open Questions
- [Unresolved items for this feature]

---
## Revision History
- [Date]: Initial draft
```

### Step 4: Save

Save to: `docs/specs/[feature-name].md`

---

## Modify Mode

### Step 1: Load & Understand

1. Read the existing Feature Spec
2. Check if PRD or SDD have changed since spec was written
3. Summarize your understanding in 2-3 sentences
4. Ask clarifying questions about the requested changes

**Common modification triggers:**
- PRD requirements changed → update Relevant PRD Requirements section
- Scope clarification → update Scope section
- Implementation learning → update Implementation Notes
- Bug discovered → update Error Handling or Testing Requirements

### Step 2: Propose Changes

Before modifying, show a **change summary**:

```
## Proposed Changes

### Additions
- [New endpoint, component, or requirement]

### Modifications  
- [Section]: [Current] → [Proposed]

### Removals
- [What's being removed and why]

### PRD Sync Status
- [Note if PRD has changed and spec needs to reflect that]

### Unchanged
- [Confirm what stays the same]
```

Ask: "Does this capture the intended changes?"

### Step 3: Apply & Save

After confirmation:
1. Apply changes to the Feature Spec
2. Update the status if needed
3. Add a revision note at the bottom
4. Save the updated file

---

## Writing Guidelines

**Target audience:** This Feature Spec is read by:

1. **Implementation LLMs**: Smaller models implementing tasks
2. **Humans**: Developers working on this feature

The spec must be self-contained—implementers should not need to reference the PRD.

**Key principles:**

- **Extract, don't summarize**: Copy PRD requirements verbatim with section references
- **Be specific**: Vague specs produce buggy implementations
- **Include examples**: Sample data, expected outputs, error messages
- **Reference SDD, don't repeat**: Say "per SDD auth model" not "using NextAuth with..."
- **Think through edge cases**: Implementers will encounter them

**Section-specific guidance:**

- **Relevant PRD Requirements**: Quote verbatim. Include section reference (e.g., "From PRD Section: Visibility Rules"). This enables traceability when PRD changes.
- **Schema Changes**: Only changes for this feature. Existing schema is in SDD.
- **API Design**: Follow SDD conventions. Include all error codes, not just success.
- **Testing Requirements**: Specific test cases, not generic "test the feature."
- **Implementation Notes**: Things you'd tell a junior dev to save them time.

**Avoid:**

- Paraphrasing PRD requirements (quote verbatim to avoid drift)
- Repeating SDD content (reference it instead)
- Scope creep (if something is a separate feature, put it in Out of Scope)
- **Estimated effort**: Do not include unless explicitly requested
- Vague acceptance criteria ("works correctly" → "returns 200 with updated record")

**Self-containment check:**

Before finalizing, verify: "Could an implementer build this feature using only this spec and the SDD, without reading the PRD?" If not, add the missing context.

---

## Status Values

- **Draft**: Initial creation, not yet reviewed
- **Active**: Approved and being implemented
- **Implemented**: Feature is complete
- **Archived**: Feature removed or superseded

---

## Output

- **Format:** Markdown
- **Location:** `${PROJECT_ROOT}/docs/specs/`
- **Filename:** `[feature-name].md`

---

## Important

1. **Do NOT implement** — stop after saving the document
2. **Read PRD and SDD first** — spec must align with both
3. **Quote PRD verbatim** — paraphrasing causes drift
4. **Be self-contained** — implementer shouldn't need to read PRD
5. **Include section references** — enables updates when PRD changes
