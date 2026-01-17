# Rule: Task List Generation

## Purpose

Guide the creation of a detailed, step-by-step task list for implementation. The task list guides implementation using **outside-in TDD practices** where tests define behavior before code is written.

## Detect Workflow

First, determine which documents are available:

**Feature Scope** (simplified workflow):
- PRD exists with `Scope: Feature`
- No SDD or Feature Spec
- PRD is the primary input

**Epic Scope** (full workflow):
- PRD exists with `Scope: Epic`
- SDD exists
- Feature Spec exists for this specific feature

If unclear, ask: "Is there an SDD and Feature Spec for this feature, or just the PRD?"

---

## Input Documents

### Feature Scope
- **PRD** - Requirements and context (primary input)
- **Existing codebase** - Tech stack is implicit in code (if applicable)

### Epic Scope
- **PRD** - Product context and full requirements
- **SDD** - Tech stack, conventions, patterns
- **Feature Spec** - Specific feature requirements and design

## Output

- **Format:** Markdown (`.md`)
- **Location:** `${PROJECT_ROOT}/docs/tasks/`
- **Filename:** `tasks-[feature-name].md`

---

## Outside-In TDD for AI Agents

### Core Principles

**Behavior stays authoritative**: Tests exist before code. The implementation must satisfy the test spec, not the other way around. This prevents AI-generated code from drifting.

**Safe iteration**: One failing test at a time. Write test → run (fails) → write minimal code → run (passes) → next test. Small diffs are easier to review and fix.

**Better design**: Test-first forces clean interfaces and discourages tight coupling.

**External services are easy to fake**: Stub external calls early with contract tests before any real API integration.

### TDD Workflow (Framework-Agnostic)

1. **Start with the user's perspective**: Write E2E/integration tests describing what the user experiences
2. **Work inward**: Write tests for each layer before implementing
3. **Minimal implementation**: Only write enough code to make the current test pass
4. **Refactor on green**: Only refactor when all tests pass

```
E2E Test (user flow)
    |
    v
Integration Test (components working together)
    |
    v
Unit Test (individual functions/methods)
    |
    v
Implementation (minimal code to pass)
```

---

## Process

### Phase 1: Generate Parent Tasks

1. Read all available input documents
2. If Feature Scope: identify tech stack from codebase or ask user
3. Identify the major implementation milestones
4. Generate 4-8 parent tasks (adapt based on feature complexity)
5. Present to user and wait for confirmation

Output after Phase 1:
```
I've generated the high-level tasks based on the [PRD / Feature Spec]:

1. [Parent Task 1]
2. [Parent Task 2]
...

Ready to generate sub-tasks? Respond with 'Go' to proceed.
```

### Phase 2: Generate Sub-Tasks

After user confirms with "Go":

1. Break each parent task into specific, actionable sub-tasks
2. Follow outside-in TDD ordering (tests before implementation)
3. End each parent task with a verification step
4. Generate the Relevant Files section
5. Generate the Notes section (include tech stack for Feature Scope)
6. Save the complete task list

---

## Task Structure

### Parent Tasks

Parent tasks represent major milestones. Typical progression:

1. **Project Setup** (if greenfield) or **Dependencies** (if adding to existing)
2. **Database/Schema** changes
3. **Core Logic** (services, business rules)
4. **API Layer** (endpoints, controllers)
5. **UI Layer** (components, pages)
6. **Integration & Polish** (error handling, edge cases)

Adapt based on the feature—not all features need all layers.

### Sub-Tasks

Each sub-task should be:
- **Atomic**: One clear action
- **Testable**: Can verify it's done
- **TDD-ordered**: Test files created before implementation files

### Verification Steps

Each parent task ends with a verification sub-task:
```markdown
- [ ] X.N. Verify: Run `[test command]` and confirm all tests pass
```

If verification fails, the implementer must fix issues before proceeding.

---

## Output Format

### Feature Scope (No SDD)

When no SDD exists, include tech stack decisions in the Notes section:

```markdown
# Tasks: [Feature Name]

> **Status**: Draft | Active | Complete | Blocked
> **PRD**: [link to prd.md]

## Relevant Files

[List files that will be created or modified, organized by type]

### Test Files (create first)
- `[path/to/test_file]` - [Purpose]

### Implementation Files
- `[path/to/file]` - [Purpose]

### Configuration Files
- `[path/to/config]` - [Purpose]

## Notes

### Tech Stack
[Determined from codebase or user input - document here for implementation LLM]

- **Language**: [language and version]
- **Framework**: [framework and version]
- **Database**: [database]
- **Testing**: [test framework]
- **Other**: [relevant tools]

### Project Conventions
[Document any conventions observed in the codebase or specified by user]

- [Convention 1]
- [Convention 2]

### Testing Commands
```bash
# Run all tests
[command]

# Run specific test file
[command]

# Run single test
[command]
```

### TDD Workflow
1. Write a failing test that describes expected behavior
2. Run the test - confirm it fails with a clear message
3. Write minimal code to make it pass
4. Run the test - confirm it passes
5. Refactor if needed (only when green)
6. Commit and move to next test

### Implementation Guidelines
- [Guideline based on codebase patterns]
- Ask for clarification rather than guessing
- Keep implementations simple - optimize later

## Tasks

- [ ] 1. [Parent Task Title]

  - [ ] 1.1. [Sub-task: Write test for X]

  - [ ] 1.2. [Sub-task: Implement X to pass test]

  - [ ] 1.3. Verify: Run `[test command]` and confirm all tests pass

[Continue for all parent tasks...]

---
## Revision History
- [Date]: Initial draft
```

### Epic Scope (With SDD and Feature Spec)

When SDD exists, reference it rather than duplicating:

```markdown
# Tasks: [Feature Name]

> **Status**: Draft | Active | Complete | Blocked
> **Feature Spec**: [link to spec]
> **SDD**: [link to sdd.md]

## Relevant Files

[List files that will be created or modified, organized by type]

### Test Files (create first)
- `[path/to/test_file]` - [Purpose]

### Implementation Files
- `[path/to/file]` - [Purpose]

### Configuration Files
- `[path/to/config]` - [Purpose]

## Notes

### Tech Stack Reference
See SDD for full tech stack. Key points for this feature:

- **Testing**: [from SDD]
- **Patterns**: [relevant patterns from SDD]

### Testing Commands
```bash
# Run all tests
[command from SDD]

# Run specific test file
[command from SDD]
```

### TDD Workflow
1. Write a failing test that describes expected behavior
2. Run the test - confirm it fails with a clear message
3. Write minimal code to make it pass
4. Run the test - confirm it passes
5. Refactor if needed (only when green)
6. Commit and move to next test

### Implementation Guidelines
- Follow patterns defined in SDD
- Reference Feature Spec for acceptance criteria
- Ask for clarification rather than guessing
- Keep implementations simple - optimize later

## Tasks

- [ ] 1. [Parent Task Title]

  - [ ] 1.1. [Sub-task: Write test for X]

  - [ ] 1.2. [Sub-task: Implement X to pass test]

  - [ ] 1.3. Verify: Run `[test command]` and confirm all tests pass

[Continue for all parent tasks...]

---
## Revision History
- [Date]: Initial draft
```

**Formatting rules:**
- Empty line between all task items (for readability)
- Checkboxes for all tasks and sub-tasks
- Parent tasks numbered: 1, 2, 3...
- Sub-tasks numbered: 1.1, 1.2, 2.1, 2.2...

---

## TDD Task Ordering

### Correct Order (Outside-In)

```
X.1 Write failing E2E/integration test for user flow
X.2 Run test, confirm it fails with clear error
X.3 Write failing unit test for [component]
X.4 Implement [component] to pass unit test
X.5 Run E2E test, observe next failure
X.6 Continue until E2E test passes
X.7 Verify: Run full test suite
```

### Anti-Pattern (Never Do)

```
X.1 Implement [component]                    ← WRONG: code before test
X.2 Write tests to verify implementation     ← Tests become rubber stamps
```

### Layer-Specific Patterns

**Database/Schema:**
```
1. Write migration test (if framework supports) or schema validation test
2. Create migration file
3. Run migration
4. Verify schema matches expectation
```

**Service/Business Logic:**
```
1. Write unit test defining expected interface and behavior
2. Run test (fails - no implementation)
3. Create service with method stubs
4. Implement method to pass test
5. Add edge case tests, then implementation
```

**API Endpoints:**
```
1. Write integration test for endpoint (request/response)
2. Run test (fails - no route/handler)
3. Add route
4. Create handler with stub
5. Implement handler to pass test
6. Add error case tests, then implementation
```

**UI Components:**
```
1. Write E2E test for user interaction
2. Run test (fails - no UI)
3. Create component with minimal markup
4. Add interactivity to pass test
5. Add accessibility tests, then implementation
```

**External Services:**
```
1. Write contract test defining expected interface
2. Create service wrapper with stubbed methods
3. Write integration test with mocked HTTP
4. Implement service to pass tests
5. (Optional) Verify against real API in development
```

---

## Adapting to Tech Stack

Read the SDD (Epic) or infer from codebase (Feature) and adapt:

| Tech Stack | Task Adaptations |
|------------|------------------|
| Jest/Vitest | Use `describe`/`it` blocks, `npm test` commands |
| Pytest | Use `test_` prefix, `pytest` commands |
| RSpec | Use `describe`/`it` blocks, `rspec` commands |
| Minitest | Use `test_` methods, `rails test` commands |
| Go | Use `_test.go` files, `go test` commands |

**Examples by stack:**

*JavaScript/TypeScript (Jest):*
```markdown
- [ ] 1.1. Create `src/services/__tests__/user.test.ts` with test for `createUser`
- [ ] 1.2. Run `npm test src/services/__tests__/user.test.ts` - confirm fails
- [ ] 1.3. Create `src/services/user.ts` with `createUser` function
- [ ] 1.4. Run test - confirm passes
```

*Python (Pytest):*
```markdown
- [ ] 1.1. Create `tests/services/test_user.py` with test for `create_user`
- [ ] 1.2. Run `pytest tests/services/test_user.py` - confirm fails
- [ ] 1.3. Create `src/services/user.py` with `create_user` function
- [ ] 1.4. Run test - confirm passes
```

*Ruby (RSpec):*
```markdown
- [ ] 1.1. Create `spec/services/user_service_spec.rb` with test for `#create`
- [ ] 1.2. Run `rspec spec/services/user_service_spec.rb` - confirm fails
- [ ] 1.3. Create `app/services/user_service.rb` with `create` method
- [ ] 1.4. Run test - confirm passes
```

---

## Task Generation Best Practices

### Complete User Experience
- Include navigation/routing to new features
- Include error states and messages
- Include loading states where appropriate
- Include accessibility requirements

### Test Coverage
- Unit tests for business logic
- Integration tests for component interaction
- E2E tests for critical user paths
- Error scenario tests

### Simplicity First
- Start with simplest working solution
- Add complexity only when tests require it
- Prefer standard browser behavior over custom JS

### Clear Boundaries
- Each sub-task is one logical action
- Test and implementation are separate sub-tasks
- Verification is always the final sub-task of a parent

---

## Quality Checks

Before saving, verify:

1. **TDD Order**: Every implementation sub-task is preceded by a test sub-task
2. **Verification Steps**: Every parent task ends with a verification sub-task
3. **Tech Stack Alignment**: Commands and file paths match conventions
4. **Requirement Coverage**: All requirements from PRD/Feature Spec are addressed
5. **Relevant Files Complete**: All files to be created/modified are listed
6. **Notes Section Complete**: Tech stack (Feature) or SDD reference (Epic) included
7. **Atomic Sub-tasks**: Each sub-task is one clear action
8. **Clear Language**: Junior developer or small LLM can understand each task

---

## AI Implementation Guidelines

Include this section in every generated task list:

```markdown
### For Implementers (Human or AI)

**TDD is mandatory:**
1. Never write implementation before its test exists
2. Run tests after each change
3. If a test fails unexpectedly, fix the issue before continuing
4. Only refactor when all tests pass

**When stuck:**
- Re-read the PRD/Feature Spec for acceptance criteria
- Check SDD for conventions and patterns (if Epic scope)
- Ask for clarification rather than guessing

**Verification protocol:**
- Run verification command at end of each parent task
- If verification fails: stop, review, fix, re-verify
- Only mark parent task complete when verification passes

**Keep it simple:**
- Implement the minimum to pass the test
- Don't add features not required by tests
- Optimization comes after correctness
```

---

## Status Values

- **Draft**: Task list created, not yet started
- **Active**: Implementation in progress
- **Complete**: All tasks done and verified
- **Blocked**: Waiting on dependency or clarification

---

## Important

1. **Do NOT implement** — stop after saving the task list
2. **Detect scope first** — Feature (PRD only) vs Epic (PRD + SDD + Feature Spec)
3. **Feature scope**: Include tech stack in Notes section
4. **Epic scope**: Reference SDD, don't duplicate
5. **Adapt to tech stack** — use conventions from SDD or codebase
6. **TDD is non-negotiable** — tests before implementation, always
7. **Wait for "Go"** — confirm parent tasks before generating sub-tasks
