import { describe, expect, test } from 'bun:test';
import { serializeSpec } from './spec-serializer';
import { parseSpec } from './spec-parser';
import type { Spec } from './types';

describe('serializeSpec', () => {
  test('serializes spec with all fields', () => {
    const spec: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'My Feature',
      content: '# Spec: My Feature\n\n## Overview\nSome content.',
      filePath: '/path/to/spec.md',
    };

    const result = serializeSpec(spec);

    expect(result).toContain('---');
    expect(result).toContain('id: a1b2');
    expect(result).toContain('status: ready');
    expect(result).toContain('parent: null');
    expect(result).toContain('blockedBy: []');
    expect(result).toContain('priority: 5');
    expect(result).toContain('pr: null');
    expect(result).toContain('# Spec: My Feature');
    expect(result).toContain('## Overview');
  });

  test('serializes pr field with URL value', () => {
    const spec: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: 'https://github.com/org/repo/pull/123',
      title: 'My Feature',
      content: '# Spec: My Feature',
      filePath: '/path/to/spec.md',
    };

    const result = serializeSpec(spec);

    expect(result).toContain('pr: https://github.com/org/repo/pull/123');
  });

  test('serializes spec with parent and blockedBy', () => {
    const spec: Spec = {
      id: 'c3d4',
      status: 'blocked',
      parent: 'a1b2',
      blockedBy: ['e5f6', 'g7h8'],
      priority: 8,
      pr: null,
      title: 'Child Feature',
      content: '# Spec: Child Feature\n\nChild content.',
      filePath: '/path/to/child.md',
    };

    const result = serializeSpec(spec);

    expect(result).toContain('parent: a1b2');
    expect(result).toContain('blockedBy:');
    expect(result).toContain('- e5f6');
    expect(result).toContain('- g7h8');
    expect(result).toContain('priority: 8');
  });

  test('round-trip: parse -> serialize -> parse produces same data', () => {
    const originalContent = `---
id: a1b2
status: ready
parent: null
blockedBy: []
priority: 8
---

# Spec: Round Trip Test

## Overview
Testing round-trip conversion.

## Requirements
1. When the user submits, the system shall save.
`;

    const parsed = parseSpec('/test/path.md', originalContent);
    const serialized = serializeSpec(parsed);
    const reparsed = parseSpec('/test/path.md', serialized);

    expect(reparsed.id).toBe(parsed.id);
    expect(reparsed.status).toBe(parsed.status);
    expect(reparsed.parent).toBe(parsed.parent);
    expect(reparsed.blockedBy).toEqual(parsed.blockedBy);
    expect(reparsed.priority).toBe(parsed.priority);
    expect(reparsed.title).toBe(parsed.title);
  });

  test('round-trip: migration from deprecated blocks field', () => {
    // Test backward compatibility: old "blocks" field should be parsed and re-serialized as "blockedBy"
    const oldFormatContent = `---
id: a1b2
status: ready
parent: null
blocks: []
priority: 8
---

# Spec: Migration Test
`;

    const parsed = parseSpec('/test/path.md', oldFormatContent);
    const serialized = serializeSpec(parsed);

    expect(serialized).toContain('blockedBy: []');
    expect(serialized).not.toContain('blocks:');
  });

  test('ends with newline', () => {
    const spec: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Test',
      content: '# Spec: Test',
      filePath: '/path/spec.md',
    };

    const result = serializeSpec(spec);
    expect(result.endsWith('\n')).toBe(true);
  });

  test('handles empty blockedBy array', () => {
    const spec: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Test',
      content: '# Spec: Test',
      filePath: '/path/spec.md',
    };

    const result = serializeSpec(spec);
    expect(result).toContain('blockedBy: []');
  });

  test('handles all status types', () => {
    const statuses = [
      'ready',
      'in_progress',
      'blocked',
      'closed',
      'deferred',
      'not_planned',
    ] as const;

    for (const status of statuses) {
      const spec: Spec = {
        id: 'test',
        status,
        parent: null,
        blockedBy: [],
        priority: 5,
        pr: null,
        title: 'Test',
        content: '# Test',
        filePath: '/path.md',
      };

      const result = serializeSpec(spec);
      expect(result).toContain(`status: ${status}`);
    }
  });

  test('handles all priority levels (1-10)', () => {
    for (let priority = 1; priority <= 10; priority++) {
      const spec: Spec = {
        id: 'test',
        status: 'ready',
        parent: null,
        blockedBy: [],
        priority,
        pr: null,
        title: 'Test',
        content: '# Test',
        filePath: '/path.md',
      };

      const result = serializeSpec(spec);
      expect(result).toContain(`priority: ${priority}`);
    }
  });
});
