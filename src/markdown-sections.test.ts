import { describe, it, expect } from 'bun:test';
import {
  getSection,
  setSection,
  appendToSection,
  isSectionBoilerplate,
  findBoilerplateSections,
  SECTION_HEADINGS,
} from './markdown-sections';

const SAMPLE_SPEC = `# Spec: Test Feature

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

describe('SECTION_HEADINGS', () => {
  it('maps flag names to heading text', () => {
    expect(SECTION_HEADINGS['overview']).toBe('Overview');
    expect(SECTION_HEADINGS['background']).toBe('Background & Context');
    expect(SECTION_HEADINGS['goals']).toBe('Goals');
    expect(SECTION_HEADINGS['requirements']).toBe('Requirements (EARS format)');
    expect(SECTION_HEADINGS['tasks']).toBe('Inline Tasks');
    expect(SECTION_HEADINGS['prerequisites']).toBe('Prerequisites');
    expect(SECTION_HEADINGS['questions']).toBe('Open Questions');
  });
});

describe('getSection', () => {
  it('returns section body for existing section', () => {
    const body = getSection(SAMPLE_SPEC, 'Overview');
    expect(body).toBe('[2-3 sentences: what this is and why it matters]\n');
  });

  it('returns null for non-existent section', () => {
    expect(getSection(SAMPLE_SPEC, 'Nonexistent')).toBeNull();
  });

  it('is case-insensitive', () => {
    const body = getSection(SAMPLE_SPEC, 'overview');
    expect(body).toBe('[2-3 sentences: what this is and why it matters]\n');
  });

  it('returns multi-line section body', () => {
    const body = getSection(SAMPLE_SPEC, 'Goals');
    expect(body).toBe('- [Specific, measurable objective]\n');
  });

  it('handles ### level heading (Inline Tasks)', () => {
    const body = getSection(SAMPLE_SPEC, 'Inline Tasks');
    expect(body).toBe('- [ ] First small task\n- [ ] Second small task\n');
  });

  it('does not include next section at same or higher level', () => {
    const body = getSection(SAMPLE_SPEC, 'Inline Tasks');
    expect(body).not.toContain('Child Specs');
    expect(body).not.toContain('[None yet]');
  });

  it('handles section at end of document', () => {
    const body = getSection(SAMPLE_SPEC, 'Open Questions');
    expect(body).toBe('- [Unresolved items]\n');
  });

  it('returns section with subsections for Requirements', () => {
    const body = getSection(SAMPLE_SPEC, 'Requirements (EARS format)');
    expect(body).toContain('### Feature Area');
    expect(body).toContain('When [trigger]');
  });

  it('handles section with empty body', () => {
    const content = '# Title\n\n## Empty\n\n## Next\nContent\n';
    const body = getSection(content, 'Empty');
    expect(body).toBe('');
  });
});

describe('setSection', () => {
  it('replaces section body, preserving heading', () => {
    const result = setSection(SAMPLE_SPEC, 'Overview', 'A real overview of the feature.\n');
    expect(result).toContain('## Overview\nA real overview of the feature.\n');
    expect(result).not.toContain('[2-3 sentences');
  });

  it('preserves other sections unchanged', () => {
    const result = setSection(SAMPLE_SPEC, 'Overview', 'New overview.\n');
    expect(result).toContain('## Goals');
    expect(result).toContain('- [Specific, measurable objective]');
  });

  it('appends missing section at end with ## level', () => {
    const content = '# Title\n\n## Overview\nSome text.\n';
    const result = setSection(content, 'New Section', 'New content.\n');
    expect(result).toContain('## New Section\nNew content.\n');
    expect(result).toContain('## Overview\nSome text.');
  });

  it('replaces ### section body correctly', () => {
    const result = setSection(SAMPLE_SPEC, 'Inline Tasks', '- [ ] Real task 1\n- [ ] Real task 2\n');
    expect(result).toContain('### Inline Tasks\n- [ ] Real task 1\n- [ ] Real task 2\n');
    expect(result).not.toContain('First small task');
  });

  it('does not clobber sibling sections', () => {
    const result = setSection(SAMPLE_SPEC, 'Inline Tasks', '- [ ] New task\n');
    expect(result).toContain('### Child Specs');
    expect(result).toContain('[None yet]');
  });

  it('handles Requirements section with subsections', () => {
    const newReqs = '### Auth\n1. When user logs in, the auth module shall create a session.\n';
    const result = setSection(SAMPLE_SPEC, 'Requirements (EARS format)', newReqs);
    expect(result).toContain('## Requirements (EARS format)\n### Auth');
    expect(result).not.toContain('Feature Area');
  });
});

describe('isSectionBoilerplate', () => {
  it('detects bracket placeholder', () => {
    expect(isSectionBoilerplate('[2-3 sentences: what this is and why it matters]\n')).toBe(true);
  });

  it('detects template task items', () => {
    expect(isSectionBoilerplate('- [ ] First small task\n- [ ] Second small task\n')).toBe(true);
  });

  it('detects [None yet]', () => {
    expect(isSectionBoilerplate('[None yet]\n')).toBe(true);
  });

  it('detects bracket placeholder for prerequisites', () => {
    expect(isSectionBoilerplate('[What must be done first, if any]\n')).toBe(true);
  });

  it('detects bracket placeholder for questions', () => {
    expect(isSectionBoilerplate('- [Unresolved items]\n')).toBe(true);
  });

  it('detects goals boilerplate', () => {
    expect(isSectionBoilerplate('- [Specific, measurable objective]\n')).toBe(true);
  });

  it('returns false for completed checkbox [X]', () => {
    expect(isSectionBoilerplate('- [X] Completed task\n')).toBe(false);
    expect(isSectionBoilerplate('- [x] Also completed\n')).toBe(false);
  });

  it('returns false for unchecked checkbox [ ]', () => {
    expect(isSectionBoilerplate('- [ ] Real user task\n')).toBe(false);
  });

  it('returns false for real content', () => {
    expect(isSectionBoilerplate('This is a real overview of our feature.\n')).toBe(false);
  });

  it('returns false for mixed real and boilerplate', () => {
    expect(isSectionBoilerplate('Real content here.\n[2-3 sentences: what this is]\n')).toBe(false);
  });

  it('returns true for empty/whitespace-only body', () => {
    expect(isSectionBoilerplate('\n')).toBe(true);
    expect(isSectionBoilerplate('  \n')).toBe(true);
  });

  it('detects EARS example boilerplate', () => {
    const earsBody = `### Feature Area
1. When [trigger], [component] shall [response].
2. [Component] shall [always-true constraint].

Example:
- When user submits form, the validator shall check all required fields within 50ms.
- The auth module shall hash passwords using bcrypt with cost factor 12.

Note: Use specific component names ("Tier 1", "the backend server") instead of generic "system".
Avoid vague responses like "shall work well" - use measurable, testable criteria.
`;
    expect(isSectionBoilerplate(earsBody)).toBe(true);
  });
});

describe('appendToSection', () => {
  it('replaces boilerplate with new content', () => {
    const result = appendToSection(SAMPLE_SPEC, 'Overview', 'A real overview.\n');
    expect(result).toContain('## Overview\nA real overview.\n');
    expect(result).not.toContain('[2-3 sentences');
  });

  it('appends to real content', () => {
    const content = '# Title\n\n## Overview\nExisting overview.\n\n## Goals\nGoals here.\n';
    const result = appendToSection(content, 'Overview', 'Additional context.\n');
    expect(result).toContain('## Overview\nExisting overview.\n\nAdditional context.\n');
  });

  it('creates missing section', () => {
    const content = '# Title\n\n## Overview\nSome text.\n';
    const result = appendToSection(content, 'Prerequisites', 'Need X first.\n');
    expect(result).toContain('## Prerequisites\nNeed X first.\n');
  });
});

describe('findBoilerplateSections', () => {
  it('finds all boilerplate sections in template spec', () => {
    const sections = findBoilerplateSections(SAMPLE_SPEC);
    expect(sections).toContain('Overview');
    expect(sections).toContain('Background & Context');
    expect(sections).toContain('Goals');
    expect(sections).toContain('Requirements (EARS format)');
    expect(sections).toContain('Inline Tasks');
    expect(sections).toContain('Prerequisites');
    expect(sections).toContain('Open Questions');
  });

  it('returns empty array for filled-in spec', () => {
    const content = `# Spec: Real Feature

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
    const sections = findBoilerplateSections(content);
    // Child Specs [None yet] is acceptable boilerplate
    expect(sections).not.toContain('Overview');
    expect(sections).not.toContain('Goals');
    expect(sections).not.toContain('Requirements (EARS format)');
    expect(sections).not.toContain('Prerequisites');
  });
});
