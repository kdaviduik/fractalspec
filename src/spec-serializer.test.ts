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
      blocks: [],
      priority: 'normal',
      title: 'My Feature',
      content: '# Spec: My Feature\n\n## Overview\nSome content.',
      filePath: '/path/to/spec.md',
    };

    const result = serializeSpec(spec);

    expect(result).toContain('---');
    expect(result).toContain('id: a1b2');
    expect(result).toContain('status: ready');
    expect(result).toContain('parent: null');
    expect(result).toContain('blocks: []');
    expect(result).toContain('priority: normal');
    expect(result).toContain('# Spec: My Feature');
    expect(result).toContain('## Overview');
  });

  test('serializes spec with parent and blocks', () => {
    const spec: Spec = {
      id: 'c3d4',
      status: 'blocked',
      parent: 'a1b2',
      blocks: ['e5f6', 'g7h8'],
      priority: 'high',
      title: 'Child Feature',
      content: '# Spec: Child Feature\n\nChild content.',
      filePath: '/path/to/child.md',
    };

    const result = serializeSpec(spec);

    expect(result).toContain('parent: a1b2');
    expect(result).toContain('blocks:');
    expect(result).toContain('- e5f6');
    expect(result).toContain('- g7h8');
    expect(result).toContain('priority: high');
  });

  test('round-trip: parse -> serialize -> parse produces same data', () => {
    const originalContent = `---
id: a1b2
status: ready
parent: null
blocks: []
priority: high
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
    expect(reparsed.blocks).toEqual(parsed.blocks);
    expect(reparsed.priority).toBe(parsed.priority);
    expect(reparsed.title).toBe(parsed.title);
  });

  test('ends with newline', () => {
    const spec: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blocks: [],
      priority: 'normal',
      title: 'Test',
      content: '# Spec: Test',
      filePath: '/path/spec.md',
    };

    const result = serializeSpec(spec);
    expect(result.endsWith('\n')).toBe(true);
  });

  test('handles empty blocks array', () => {
    const spec: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blocks: [],
      priority: 'normal',
      title: 'Test',
      content: '# Spec: Test',
      filePath: '/path/spec.md',
    };

    const result = serializeSpec(spec);
    expect(result).toContain('blocks: []');
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
        blocks: [],
        priority: 'normal',
        title: 'Test',
        content: '# Test',
        filePath: '/path.md',
      };

      const result = serializeSpec(spec);
      expect(result).toContain(`status: ${status}`);
    }
  });

  test('handles all priority levels', () => {
    const priorities = ['critical', 'high', 'normal', 'low'] as const;

    for (const priority of priorities) {
      const spec: Spec = {
        id: 'test',
        status: 'ready',
        parent: null,
        blocks: [],
        priority,
        title: 'Test',
        content: '# Test',
        filePath: '/path.md',
      };

      const result = serializeSpec(spec);
      expect(result).toContain(`priority: ${priority}`);
    }
  });
});
