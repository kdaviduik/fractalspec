# Rule: Product Requirements Document (PRD) Generation & Modification

## Purpose

Guide the creation or modification of a PRD that is clear, actionable, and serves as the canonical reference for what to build and why. The PRD defines *what* and *why*—not *how*.

This is the complete source of truth for business logic and requirements.

## Behavior

### Detect Mode

First, determine the operating mode:

1. **Create Mode**: User describes a new product/feature with no existing PRD
2. **Modify Mode**: User references an existing PRD or asks to update/refine one

If unclear, ask: "Are we creating a new PRD or modifying an existing one?"

---

## Create Mode

### Step 1: Gather Context

Ask clarifying questions before writing. Focus on *what* and *why*, not *how*.

**Core questions to consider** (adapt based on prompt):

| Area | Example Questions |
|------|-------------------|
| Problem | What problem does this solve? Why now? |
| Background | What prior decisions or context led to this? |
| User | Who is the primary user? Any secondary users? |
| Functionality | What are the key actions a user can perform? |
| User Flows | Can you walk through a complete scenario end-to-end? |
| Success | How do we know this is successful? |
| Scope | What is explicitly *out of scope*? |
| Constraints | Any performance, compatibility, or compliance requirements? |
| Edge cases | What happens when things go wrong? |
| Terminology | Are there domain-specific terms I should define? |

**Determine scope early.** Ask: "Is this a self-contained feature (days of work) or a larger epic (weeks, multiple features)?" This determines the downstream workflow.

**Guidelines for questions:**
- Ask as many questions as needed to produce a thorough, unambiguous PRD
- Group related questions together for readability
- If the initial prompt is detailed, acknowledge what you understood and ask about gaps
- It's better to ask 20 questions and produce an excellent PRD than to ask 5 and produce a vague one
- Continue asking follow-up questions across multiple rounds if needed

### Step 2: Generate PRD

Use this structure:

```markdown
# PRD: [Product/Feature Name]

> **Status**: Draft | Active | Implemented | Archived
> **Scope**: Feature | Epic

## Overview
[2-3 sentences: what this is and why it matters]

## Background & Context
[Why this is being built now. Business context, user pain points, 
or prior decisions that led here. Helps implementers make good judgment 
calls when facing ambiguity.]

## Goals
- [Specific, measurable objective 1]
- [Specific, measurable objective 2]

## User Stories
- As a [user type], I want to [action] so that [benefit]
- ...

## Functional Requirements

### [Logical Grouping 1]
1. [Requirement]
   - Acceptance: [How to verify this is implemented correctly]
   - Example: [Concrete input/output or behavior example]
2. ...

### [Logical Grouping 2]
1. ...

## User Flows
[End-to-end scenarios with concrete data showing how a user 
accomplishes a task. Walk through the full sequence of actions.]

### Flow 1: [Scenario Name]
1. User does X with [concrete example data]
2. System responds with Y
3. User sees Z
4. ...

## Non-Goals
- [What this explicitly will NOT do]

## UI/UX Requirements
[What the user should experience. Focus on behavior, not implementation.
Examples: "Users must receive feedback within 200ms of clicking submit",
"Error messages must explain what went wrong and how to fix it",
"The form must work with keyboard navigation only".
Write "None specified" if not applicable.]

## Constraints
[Product-level constraints that affect what can be built. Examples:
- Performance: "Page must load in under 2 seconds on 3G"
- Compatibility: "Must work on iOS 14+ and Android 10+"
- Compliance: "Must meet WCAG 2.1 AA accessibility standards"
- Business: "Must not require users to create an account"
Write "None specified" if not applicable.]

## Success Metrics
- [How success will be measured]

## Glossary
[Define domain-specific terms, acronyms, or concepts that might be 
misinterpreted. Include terms even if they seem obvious.]

| Term | Definition |
|------|------------|
| [Term] | [Clear definition] |

## Open Questions
- [Unresolved items needing future clarification]

---
## Revision History
- [Date]: Initial draft
```

### Step 3: Save

Save to: `docs/prd.md` (for product-level PRD) or `docs/prd-[feature-name].md` (if multiple PRDs exist)

---

## Scope: Feature vs Epic

The Scope field determines the downstream workflow:

### Feature Scope

Use when:
- Work is small-medium (days, not weeks)
- Adding to an existing codebase (tech stack is implicit)
- Self-contained functionality
- PRD is small enough to feed directly to implementation LLM

**Downstream workflow:** PRD → Task List → Implementation

**Who reads this PRD:**
- Planning LLM (to generate tasks)
- Implementation LLM (as context during implementation)
- Humans (for full understanding)

### Epic Scope

Use when:
- Work is large (weeks)
- Greenfield project or major architectural changes
- Multiple interdependent features
- PRD is too large for implementation LLM context

**Downstream workflow:** PRD → SDD → Feature Specs → Task Lists → Implementation

**Who reads this PRD:**
- Planning LLM (to create SDD and Feature Specs)
- Humans (for full understanding)
- NOT implementation LLMs (they receive curated Feature Specs instead)

### When in Doubt

Start with Feature scope. You can always "upgrade" to Epic by creating an SDD later if the project grows.

---

## Modify Mode

### Step 1: Load & Understand

1. Read the existing PRD
2. Summarize your understanding of the current state in 2-3 sentences
3. Ask clarifying questions about the requested changes

**Questions to consider:**
- What specific sections need updating?
- Is this an expansion of scope, reduction, or pivot?
- Do existing requirements need revision or just additions?
- Should any requirements be removed or marked deprecated?
- Does the Scope need to change (Feature → Epic)?

### Step 2: Propose Changes

Before modifying, show a **change summary**:

```
## Proposed Changes

### Additions
- [New requirement or section]

### Modifications  
- [Section]: [Current] → [Proposed]

### Removals
- [What's being removed and why]

### Unchanged
- [Confirm what stays the same]
```

Ask: "Does this capture the intended changes?"

### Step 3: Apply & Save

After confirmation:
1. Apply changes to the PRD
2. Update the status if needed
3. Add a revision note at the bottom
4. Save the updated file

---

## Writing Guidelines

**Target audience depends on Scope:**

- **Feature scope**: Planning LLMs, implementation LLMs, and humans all read this
- **Epic scope**: Only planning LLMs and humans read this; implementation LLMs get Feature Specs

Write at a level a junior developer could follow, but optimize for completeness:

- **Be explicit**: State everything directly; don't rely on inference or "common sense"
- **Be unambiguous**: Each requirement should have exactly one interpretation
- **Be complete**: This is the source of truth—include all business logic
- **Use numbered requirements**: Enables precise referencing in Feature Specs
- **Include concrete examples**: Show expected inputs/outputs, sample data, edge case handling
- **Define all terms**: If a concept might be unclear, define it in the Glossary
- **Specify acceptance criteria**: Each requirement should state how to verify it's done correctly
- **Group logically**: Related requirements under descriptive headings

**Section-specific guidance:**

- **Background & Context**: Include business motivation, user research findings, or prior decisions. When an implementer faces an ambiguous choice, this section helps them decide correctly.
- **User Flows**: Use concrete, realistic data in walkthroughs. Instead of "User enters their information," write "User enters email: alice@example.com, selects plan: Pro ($29/mo)."
- **Glossary**: When in doubt, define it. Terms that seem obvious to domain experts often confuse LLMs or get interpreted inconsistently.

**Avoid:**

- Implementation details (the *how*)—these belong in the SDD or Feature Spec
- Vague requirements ("should be fast", "user-friendly")
- Scope creep: if something feels like a separate feature, note it as a non-goal
- **Estimated effort**: Do not include time/effort estimates unless explicitly requested
- Technical architecture decisions (database schemas, API designs, etc.)

**Assumptions and uncertainty:**

- State all assumptions explicitly in the relevant section
- If uncertain about something, say so directly rather than guessing
- Surface ambiguities as Open Questions rather than making silent decisions

---

## Status Values

- **Draft**: Initial creation, not yet reviewed/approved
- **Active**: Approved and currently being implemented
- **Implemented**: All requirements have been built
- **Archived**: No longer relevant (superseded or abandoned)

---

## Output

- **Format:** Markdown
- **Location:** `${PROJECT_ROOT}/docs/`
- **Filename:** `prd.md` or `prd-[feature-name].md`

---

## Important

1. **Do NOT implement** — stop after saving the document
2. **Always ask clarifying questions** — even for detailed prompts, confirm understanding
3. **Determine scope early** — Feature vs Epic affects downstream workflow
4. **Iterate with the user** — incorporate feedback before finalizing
5. **This is the source of truth** — be complete; Feature Specs will extract from this (Epic scope)
