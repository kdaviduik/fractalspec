import { describe, expect, test } from 'bun:test';
import { parseSpec, ParseError } from './spec-parser';

const VALID_SPEC = `---
id: a1b2
status: ready
parent: null
blocks: []
---

# Spec: My Feature

## Overview
This is a test spec.

## Requirements
1. When the user clicks submit, the system shall save the data.
`;

const SPEC_WITH_PARENT = `---
id: c3d4
status: blocked
parent: a1b2
blocks:
  - e5f6
  - g7h8
---

# Spec: Child Feature

Some content here.
`;

const SPEC_WITHOUT_FRONTMATTER = `# Spec: No Frontmatter

This spec has no YAML frontmatter.
`;

const SPEC_WITH_INVALID_STATUS = `---
id: x1y2
status: invalid_status
parent: null
blocks: []
---

# Spec: Invalid Status
`;

describe('parseSpec', () => {
  test('parses valid spec with all fields', () => {
    const result = parseSpec('/path/to/spec.md', VALID_SPEC);

    expect(result.id).toBe('a1b2');
    expect(result.status).toBe('ready');
    expect(result.parent).toBeNull();
    expect(result.blocks).toEqual([]);
    expect(result.title).toBe('My Feature');
    expect(result.filePath).toBe('/path/to/spec.md');
    expect(result.content).toContain('## Overview');
    expect(result.content).toContain('## Requirements');
  });

  test('parses spec with parent and blocks', () => {
    const result = parseSpec('/path/to/child.md', SPEC_WITH_PARENT);

    expect(result.id).toBe('c3d4');
    expect(result.status).toBe('blocked');
    expect(result.parent).toBe('a1b2');
    expect(result.blocks).toEqual(['e5f6', 'g7h8']);
    expect(result.title).toBe('Child Feature');
  });

  test('throws ParseError for spec without frontmatter', () => {
    expect(() => parseSpec('/path/to/spec.md', SPEC_WITHOUT_FRONTMATTER)).toThrow(
      ParseError
    );
  });

  test('throws ParseError for spec with invalid status', () => {
    expect(() => parseSpec('/path/to/spec.md', SPEC_WITH_INVALID_STATUS)).toThrow(
      ParseError
    );
  });

  test('extracts title from "# Spec: Title" format', () => {
    const result = parseSpec('/path/to/spec.md', VALID_SPEC);
    expect(result.title).toBe('My Feature');
  });

  test('extracts title from plain "# Title" format', () => {
    const specWithPlainTitle = `---
id: a1b2
status: ready
parent: null
blocks: []
---

# Plain Title

Content here.
`;
    const result = parseSpec('/path/to/spec.md', specWithPlainTitle);
    expect(result.title).toBe('Plain Title');
  });

  test('uses "Untitled" when no heading found', () => {
    const specWithoutTitle = `---
id: a1b2
status: ready
parent: null
blocks: []
---

No heading here, just content.
`;
    const result = parseSpec('/path/to/spec.md', specWithoutTitle);
    expect(result.title).toBe('Untitled');
  });

  test('content excludes frontmatter', () => {
    const result = parseSpec('/path/to/spec.md', VALID_SPEC);
    expect(result.content).not.toContain('---');
    expect(result.content).not.toContain('id: a1b2');
  });

  test('trims content whitespace', () => {
    const result = parseSpec('/path/to/spec.md', VALID_SPEC);
    expect(result.content.startsWith('\n')).toBe(false);
    expect(result.content.endsWith('\n')).toBe(false);
  });
});
