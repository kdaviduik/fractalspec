import { describe, it, expect, spyOn } from 'bun:test';
import { getUnfilledSections, printPostCommandHealth } from './post-command-health';
import { getSectionFlag, SECTION_HEADINGS } from './markdown-sections';

const FULL_BOILERPLATE = `# Spec: Test Feature

## Overview
[2-3 sentences: what this is and why it matters]

## Background & Context
[Why this is being built now. Business context, user pain points.]

## Goals
- [Specific, measurable objective]

## Requirements (EARS format)

### Feature Area
1. When [trigger], [component] shall [response].
2. [Component] shall [always-true constraint].

Example:
- When user submits form, the validator shall check all required fields within 50ms.
- The auth module shall hash passwords using bcrypt with cost factor 12.

Note: Use specific component names ("Tier 1", "the backend server") instead of generic "system".
Avoid vague responses like "shall work well" - use measurable, testable criteria.

## Tasks

### Inline Tasks
- [ ] First small task
- [ ] Second small task

### Child Specs
[None yet]

## Prerequisites
[What must be done first, if any]

## Open Questions
- [Unresolved items]
`;

const FULLY_FILLED = `# Spec: Real Feature

## Overview
This is a real overview of the feature we are building.

## Background & Context
We need this because of business reason X.

## Goals
- Increase user engagement by 20%

## Requirements (EARS format)

### Auth
1. When user logs in, the auth module shall create a session.

## Tasks

### Inline Tasks
- [ ] Implement login endpoint

### Child Specs
[None yet]

## Prerequisites
Complete the database migration first.

## Open Questions
- Should we support OAuth?
`;

const PARTIALLY_FILLED = `# Spec: Partial

## Overview
A real overview here.

## Background & Context
[Why this is being built now. Business context, user pain points.]

## Goals
- Real measurable goal

## Requirements (EARS format)

### Auth
1. When user logs in, the auth module shall create a session.

## Tasks

### Inline Tasks
- [ ] Real task

### Child Specs
[None yet]

## Prerequisites
[What must be done first, if any]

## Open Questions
- Real open question
`;

function assertNonNull<T>(value: T | null | undefined): asserts value is T {
  expect(value).not.toBeNull();
  expect(value).toBeDefined();
}

describe('getSectionFlag (reverse mapping)', () => {
  it('maps Overview → overview', () => {
    expect(getSectionFlag('Overview')).toBe('overview');
  });

  it('maps Requirements (EARS format) → requirements', () => {
    expect(getSectionFlag('Requirements (EARS format)')).toBe('requirements');
  });

  it('maps Background & Context → background', () => {
    expect(getSectionFlag('Background & Context')).toBe('background');
  });

  it('maps Inline Tasks → tasks', () => {
    expect(getSectionFlag('Inline Tasks')).toBe('tasks');
  });

  it('maps Open Questions → questions', () => {
    expect(getSectionFlag('Open Questions')).toBe('questions');
  });

  it('returns undefined for unknown headings', () => {
    expect(getSectionFlag('Unknown Section')).toBeUndefined();
  });

  it('every SECTION_HEADINGS entry has a valid reverse mapping', () => {
    for (const [flag, heading] of Object.entries(SECTION_HEADINGS)) {
      expect(getSectionFlag(heading)).toBe(flag);
    }
  });
});

describe('getUnfilledSections', () => {
  it('returns all 7 sections for full boilerplate, suggestion uses sc edit', () => {
    const result = getUnfilledSections('abc123', FULL_BOILERPLATE);
    assertNonNull(result);
    expect(result.sections).toHaveLength(7);
    expect(result.sections).toContain('Overview');
    expect(result.sections).toContain('Background & Context');
    expect(result.sections).toContain('Goals');
    expect(result.sections).toContain('Requirements (EARS format)');
    expect(result.sections).toContain('Inline Tasks');
    expect(result.sections).toContain('Prerequisites');
    expect(result.sections).toContain('Open Questions');
    expect(result.suggestion).toBe('sc edit abc123');
  });

  it('returns null for fully filled spec', () => {
    expect(getUnfilledSections('abc123', FULLY_FILLED)).toBeNull();
  });

  it('returns only unfilled sections for partially filled spec', () => {
    const result = getUnfilledSections('abc123', PARTIALLY_FILLED);
    assertNonNull(result);
    expect(result.sections).toContain('Background & Context');
    expect(result.sections).toContain('Prerequisites');
    expect(result.sections).not.toContain('Overview');
    expect(result.sections).not.toContain('Goals');
    expect(result.sections).not.toContain('Requirements (EARS format)');
    expect(result.sections).not.toContain('Open Questions');
  });

  it('uses sc set with correct flags for 1-3 unfilled sections', () => {
    const result = getUnfilledSections('abc123', PARTIALLY_FILLED);
    assertNonNull(result);
    expect(result.suggestion).toContain('sc set abc123');
    expect(result.suggestion).toContain('--background');
    expect(result.suggestion).toContain('--prerequisites');
  });

  it('uses sc edit for 4+ unfilled sections', () => {
    const fourUnfilled = PARTIALLY_FILLED
      .replace('A real overview here.', '[2-3 sentences: what this is and why it matters]')
      .replace('- Real open question', '- [Unresolved items]');
    const result = getUnfilledSections('abc123', fourUnfilled);
    assertNonNull(result);
    expect(result.sections.length).toBeGreaterThanOrEqual(4);
    expect(result.suggestion).toBe('sc edit abc123');
  });

  it('returns null for empty content', () => {
    expect(getUnfilledSections('abc123', '')).toBeNull();
  });

  it('returns null for content with sections but no boilerplate', () => {
    const custom = `# Spec: Custom

## Overview
Real content here.

## Goals
- Ship it
`;
    expect(getUnfilledSections('abc123', custom)).toBeNull();
  });
});

describe('printPostCommandHealth', () => {
  it('prints nothing for fully filled spec', () => {
    const spy = spyOn(console, 'log');
    printPostCommandHealth('abc123', FULLY_FILLED);
    const healthCalls = spy.mock.calls.filter(
      (call): call is [string, ...unknown[]] =>
        typeof call[0] === 'string' && call[0].includes('Unfilled'),
    );
    expect(healthCalls).toHaveLength(0);
    spy.mockRestore();
  });

  it('prints warning with section names and suggestion for unfilled sections', () => {
    const spy = spyOn(console, 'log');
    printPostCommandHealth('abc123', PARTIALLY_FILLED);
    const output = spy.mock.calls
      .map((c): string => (typeof c[0] === 'string' ? c[0] : ''))
      .join('\n');
    expect(output).toContain('Unfilled sections');
    expect(output).toContain('Background & Context');
    expect(output).toContain('Prerequisites');
    expect(output).toContain('sc set abc123');
    spy.mockRestore();
  });
});
