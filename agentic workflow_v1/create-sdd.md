# Rule: System Design Document (SDD) Generation & Modification

## Purpose

Guide the creation or modification of a System Design Document that establishes the technical foundation for a project. The SDD defines system-wide technical decisions that span all features.

This document is read by ALL LLMs (planning and implementation) and humans. Keep it concise and focused on decisions that affect the entire system.

## Prerequisites

A PRD should exist before creating an SDD. The SDD translates product requirements into technical foundation.

## Behavior

### Detect Mode

First, determine the operating mode:

1. **Create Mode**: User requests an SDD for a new project
2. **Modify Mode**: User references an existing SDD or asks to update it

If unclear, ask: "Are we creating a new SDD or modifying an existing one?"

---

## Create Mode

### Step 1: Load PRD & Gather Context

1. Read the referenced PRD completely
2. Summarize your understanding in 2-3 sentences
3. Ask clarifying questions about technical approach

**Core questions to consider** (adapt based on PRD):

| Area | Example Questions |
|------|-------------------|
| Tech Stack | Any preferences for language, framework, database? |
| Existing Code | Is this greenfield or extending an existing system? |
| Deployment | Where will this run? (Vercel, AWS, self-hosted, etc.) |
| Auth | How should users authenticate? (OAuth, email/password, SSO) |
| External Services | Any third-party APIs or services to integrate? |
| Scale | Expected number of users/requests? (affects architecture choices) |
| Team | Who will maintain this? (affects complexity decisions) |
| Constraints | Any technical constraints from the organization? |

**Guidelines for questions:**
- Ask as many questions as needed to make informed technical decisions
- Group related questions together for readability
- If the user has strong preferences, confirm and ask about gaps
- Continue asking follow-up questions across multiple rounds if needed

### Step 2: Generate SDD

Use this structure:

```markdown
# System Design Document: [Project Name]

> **Status**: Draft | Active | Implemented | Archived
> **PRD**: [link to prd.md]

## Overview
[2-3 sentences: high-level technical approach and key architectural decisions]

## Tech Stack

| Layer | Choice | Justification |
|-------|--------|---------------|
| Language | [e.g., TypeScript] | [Why this choice] |
| Framework | [e.g., Next.js 14] | [Why this choice] |
| Database | [e.g., PostgreSQL] | [Why this choice] |
| ORM | [e.g., Prisma] | [Why this choice] |
| Auth | [e.g., NextAuth] | [Why this choice] |
| Hosting | [e.g., Vercel] | [Why this choice] |
| [Other] | [Choice] | [Justification] |

## Architecture Overview
[High-level description of how the system is structured. 
Include a simple diagram if helpful.]

```
[Simple ASCII diagram showing main components and their relationships]
```

## Database Schema

[Tables and key fields only. Actual indexes, constraints, and full 
field definitions live in migration files.]

### [table_name]
```
id              -- primary key
[key_field]     -- [brief description]
[key_field]     -- [brief description]
created_at      -- timestamp
updated_at      -- timestamp
```

### [table_name]
```
id              -- primary key
[foreign_key]   -- references [other_table]
[key_field]     -- [brief description]
```

### Relationships
- [table_a] has many [table_b]
- [table_b] belongs to [table_a]
- [table_c] has many [table_d] through [join_table]

## API Conventions

### URL Structure
[e.g., REST: /api/[resource], GraphQL: /graphql]

### Authentication
[How requests are authenticated - e.g., Bearer token, session cookie]

### Request/Response Format
[e.g., JSON, content-type expectations]

### Error Format
```json
{
  "error": {
    "code": "[ERROR_CODE]",
    "message": "[Human-readable message]"
  }
}
```

### Common Status Codes
| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 500 | Server error |

## Authentication & Authorization

### Auth Flow
[Describe how users authenticate - OAuth flow, email/password, etc.]

### Authorization Model
[How permissions work - role-based, resource-based, etc.]

### Roles
| Role | Permissions |
|------|-------------|
| [role] | [what they can do] |

## Folder Structure

[High-level only. Don't enumerate every file.]

```
[root]/
  [src/app/]        -- [purpose, e.g., "Next.js app router pages"]
  [src/components/] -- [purpose, e.g., "React components"]
  [src/lib/]        -- [purpose, e.g., "Shared utilities and helpers"]
  [src/services/]   -- [purpose, e.g., "Business logic and external API clients"]
  [tests/]          -- [purpose, e.g., "Test files mirroring src structure"]
  [docs/]           -- [purpose, e.g., "Documentation including PRD, SDD, specs"]
```

## Shared Patterns

### [Pattern Name, e.g., "Service Objects"]
[When to use this pattern and why]

**Example:**
```[language]
// Brief code example showing the pattern
```

### [Pattern Name, e.g., "Error Handling"]
[How errors should be handled consistently]

**Example:**
```[language]
// Brief code example
```

## External Services

| Service | Purpose | Auth Method |
|---------|---------|-------------|
| [e.g., Stripe] | [Payments] | [API key] |
| [e.g., SendGrid] | [Email] | [API key] |

## Testing Strategy

### Test Types
| Type | Tool | Location | Purpose |
|------|------|----------|---------|
| Unit | [e.g., Jest] | [tests/unit/] | [Isolated function/component tests] |
| Integration | [e.g., Jest] | [tests/integration/] | [Service interaction tests] |
| E2E | [e.g., Playwright] | [tests/e2e/] | [Full user flow tests] |

### Test Conventions
- [e.g., "Test files mirror source structure"]
- [e.g., "Use factories for test data"]
- [e.g., "Mock external services, not internal modules"]

## Environment Configuration

### Required Environment Variables
| Variable | Purpose | Example |
|----------|---------|---------|
| DATABASE_URL | Database connection | postgresql://... |
| [VAR_NAME] | [Purpose] | [Example value] |

### Environments
| Environment | Purpose | URL |
|-------------|---------|-----|
| Development | Local development | localhost:3000 |
| Staging | Pre-production testing | [staging URL] |
| Production | Live application | [production URL] |

## Glossary

[System-wide technical terms. Feature-specific terms go in Feature Specs.]

| Term | Definition |
|------|------------|
| [Term] | [Definition] |

## Open Questions
- [Unresolved technical decisions]

---
## Revision History
- [Date]: Initial draft
```

### Step 3: Save

Save to: `docs/sdd.md`

---

## Modify Mode

### Step 1: Load & Understand

1. Read the existing SDD
2. Summarize your understanding of the current design in 2-3 sentences
3. Ask clarifying questions about the requested changes

**Common modification triggers:**
- New feature requires schema changes → update Database Schema section
- Adding external service → update External Services section
- Changing conventions → update relevant Patterns section
- Tech stack change → update Tech Stack with justification

### Step 2: Propose Changes

Before modifying, show a **change summary**:

```
## Proposed Changes

### Additions
- [New table, service, or pattern]

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
1. Apply changes to the SDD
2. Update the status if needed
3. Add a revision note at the bottom
4. Save the updated file

---

## Writing Guidelines

**Target audience:** This SDD is read by:

1. **All LLMs**: Both planning (Opus) and implementation (smaller models)
2. **Humans**: Developers needing technical reference

Optimize for conciseness—this goes in every implementation context:

- **Be concise**: Every word should earn its place
- **Be definitive**: Make decisions, don't present options
- **Be consistent**: Use the same terminology throughout
- **Show, don't tell**: Brief code examples beat lengthy explanations
- **Stay high-level**: Implementation details go in Feature Specs

**Section-specific guidance:**

- **Tech Stack**: Justify choices briefly. "PostgreSQL - relational data, team familiarity" is enough.
- **Database Schema**: Tables and key fields only. Full schema lives in migrations.
- **Folder Structure**: Top-level directories only. Don't enumerate files.
- **Patterns**: One clear example per pattern. Link to detailed docs if they exist.

**Avoid:**

- Exhaustive file listings (they go stale immediately)
- Index/constraint definitions (those live in migrations)
- Feature-specific details (those go in Feature Specs)
- **Estimated effort**: Do not include unless explicitly requested
- Over-engineering for hypothetical future needs

**When SDD should be updated:**

- After any migration that adds/removes/renames tables
- When adding new external services
- When establishing new patterns
- When tech stack changes
- After Feature Specs reveal missing conventions

---

## Status Values

- **Draft**: Initial creation, not yet reviewed
- **Active**: Approved and in use as reference
- **Implemented**: System is built and stable
- **Archived**: Project discontinued or replaced

---

## Output

- **Format:** Markdown
- **Location:** `${PROJECT_ROOT}/docs/`
- **Filename:** `sdd.md`

---

## Important

1. **Do NOT implement** — stop after saving the document
2. **Read the PRD first** — technical decisions should satisfy product requirements
3. **Keep it concise** — this doc goes in every LLM context
4. **Update it** — stale SDDs cause implementation bugs
5. **Decide, don't defer** — make technical choices, note uncertainty in Open Questions
