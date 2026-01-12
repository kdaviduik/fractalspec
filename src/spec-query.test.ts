import { describe, expect, test } from 'bun:test';
import {
  findSpecById,
  filterByStatus,
  findReadySpecs,
  getStatusSummary,
} from './spec-query';
import type { Spec, Status } from './types';

function makeSpec(
  id: string,
  status: Status = 'ready',
  blocks: string[] = []
): Spec {
  return {
    id,
    status,
    parent: null,
    blocks,
    title: `Spec ${id}`,
    content: `# Spec: Spec ${id}`,
    filePath: `/path/${id}.md`,
  };
}

describe('findSpecById', () => {
  test('finds spec by exact ID', () => {
    const specs = [makeSpec('a1b2'), makeSpec('c3d4'), makeSpec('e5f6')];

    const result = findSpecById(specs, 'c3d4');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('c3d4');
  });

  test('finds spec by ID prefix', () => {
    const specs = [makeSpec('a1b2c3d4')];

    const result = findSpecById(specs, 'a1b2');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('a1b2c3d4');
  });

  test('returns null when ID not found', () => {
    const specs = [makeSpec('a1b2')];

    const result = findSpecById(specs, 'nonexistent');

    expect(result).toBeNull();
  });

  test('returns null for ambiguous prefix', () => {
    const specs = [makeSpec('a1b2c3'), makeSpec('a1b2d4')];

    const result = findSpecById(specs, 'a1b2');

    expect(result).toBeNull();
  });

  test('prefers exact match over prefix match', () => {
    const specs = [makeSpec('a1b2'), makeSpec('a1b2c3')];

    const result = findSpecById(specs, 'a1b2');

    expect(result?.id).toBe('a1b2');
  });
});

describe('filterByStatus', () => {
  test('filters specs by status', () => {
    const specs = [
      makeSpec('a', 'ready'),
      makeSpec('b', 'blocked'),
      makeSpec('c', 'ready'),
      makeSpec('d', 'closed'),
    ];

    const ready = filterByStatus(specs, 'ready');

    expect(ready).toHaveLength(2);
    expect(ready.map((s) => s.id).sort()).toEqual(['a', 'c']);
  });

  test('returns empty array when no matches', () => {
    const specs = [makeSpec('a', 'ready'), makeSpec('b', 'ready')];

    const blocked = filterByStatus(specs, 'blocked');

    expect(blocked).toHaveLength(0);
  });

  test('returns empty array for empty input', () => {
    const result = filterByStatus([], 'ready');
    expect(result).toEqual([]);
  });
});

describe('findReadySpecs', () => {
  test('returns specs with ready status and no blockers', () => {
    const specs = [
      makeSpec('a', 'ready'),
      makeSpec('b', 'blocked'),
      makeSpec('c', 'ready'),
    ];

    const ready = findReadySpecs(specs);

    expect(ready).toHaveLength(2);
    expect(ready.map((s) => s.id).sort()).toEqual(['a', 'c']);
  });

  test('excludes specs blocked by in_progress specs', () => {
    const blockedSpec = makeSpec('a', 'ready');
    blockedSpec.blocks = ['b'];

    const blockerSpec = makeSpec('b', 'in_progress');

    const specs = [blockedSpec, blockerSpec];

    const ready = findReadySpecs(specs);

    expect(ready).toHaveLength(0);
  });

  test('includes specs when blocker is closed', () => {
    const blockedSpec = makeSpec('a', 'ready');
    blockedSpec.blocks = ['b'];

    const blockerSpec = makeSpec('b', 'closed');

    const specs = [blockedSpec, blockerSpec];

    const ready = findReadySpecs(specs);

    expect(ready).toHaveLength(1);
    expect(ready[0]?.id).toBe('a');
  });

  test('returns empty array when all specs blocked', () => {
    const specs = [
      makeSpec('a', 'blocked'),
      makeSpec('b', 'in_progress'),
      makeSpec('c', 'closed'),
    ];

    const ready = findReadySpecs(specs);

    expect(ready).toHaveLength(0);
  });
});

describe('getStatusSummary', () => {
  test('counts specs by status', () => {
    const specs = [
      makeSpec('a', 'ready'),
      makeSpec('b', 'ready'),
      makeSpec('c', 'blocked'),
      makeSpec('d', 'in_progress'),
      makeSpec('e', 'closed'),
    ];

    const summary = getStatusSummary(specs);

    expect(summary.ready).toBe(2);
    expect(summary.blocked).toBe(1);
    expect(summary.in_progress).toBe(1);
    expect(summary.closed).toBe(1);
    expect(summary.deferred).toBe(0);
    expect(summary.not_planned).toBe(0);
  });

  test('returns zeros for empty input', () => {
    const summary = getStatusSummary([]);

    expect(summary.ready).toBe(0);
    expect(summary.blocked).toBe(0);
    expect(summary.in_progress).toBe(0);
    expect(summary.closed).toBe(0);
  });

  test('includes total count', () => {
    const specs = [
      makeSpec('a', 'ready'),
      makeSpec('b', 'blocked'),
      makeSpec('c', 'closed'),
    ];

    const summary = getStatusSummary(specs);

    expect(summary.total).toBe(3);
  });
});
