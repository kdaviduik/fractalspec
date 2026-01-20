import { describe, expect, test } from 'bun:test';
import {
  findSpecById,
  filterByStatus,
  findReadySpecs,
  findReadySpecsSorted,
  sortByPriority,
  getStatusSummary,
} from './spec-query';
import type { Spec, Status, Priority } from './types';

function makeSpec(
  id: string,
  status: Status = 'ready',
  blocks: string[] = [],
  priority: Priority = 'normal',
  parent: string | null = null
): Spec {
  return {
    id,
    status,
    parent,
    blocks,
    priority,
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

describe('sortByPriority', () => {
  test('sorts by priority (critical > high > normal > low)', () => {
    const specs = [
      makeSpec('low', 'ready', [], 'low'),
      makeSpec('high', 'ready', [], 'high'),
      makeSpec('normal', 'ready', [], 'normal'),
      makeSpec('critical', 'ready', [], 'critical'),
    ];

    const sorted = sortByPriority(specs, { allSpecs: specs });

    expect(sorted.map((s) => s.id)).toEqual(['critical', 'high', 'normal', 'low']);
  });

  test('sorts by depth descending within same priority (leaves first)', () => {
    const root = makeSpec('root', 'ready', [], 'normal', null);
    const child = makeSpec('child', 'ready', [], 'normal', 'root');
    const grandchild = makeSpec('grandchild', 'ready', [], 'normal', 'child');

    const specs = [root, child, grandchild];
    const sorted = sortByPriority(specs, { allSpecs: specs });

    expect(sorted.map((s) => s.id)).toEqual(['grandchild', 'child', 'root']);
  });

  test('sorts alphabetically by title as tiebreaker', () => {
    const specA = makeSpec('a', 'ready', [], 'normal');
    specA.title = 'AAA Feature';
    const specB = makeSpec('b', 'ready', [], 'normal');
    specB.title = 'BBB Feature';
    const specC = makeSpec('c', 'ready', [], 'normal');
    specC.title = 'CCC Feature';

    const specs = [specC, specA, specB];
    const sorted = sortByPriority(specs, { allSpecs: specs });

    expect(sorted.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  test('combines priority, depth, and title sorting', () => {
    const highRoot = makeSpec('high-root', 'ready', [], 'high', null);
    const highChild = makeSpec('high-child', 'ready', [], 'high', 'high-root');
    const normalRoot = makeSpec('normal-root', 'ready', [], 'normal', null);

    const specs = [normalRoot, highRoot, highChild];
    const sorted = sortByPriority(specs, { allSpecs: specs });

    expect(sorted.map((s) => s.id)).toEqual(['high-child', 'high-root', 'normal-root']);
  });
});

describe('findReadySpecsSorted', () => {
  test('returns ready specs sorted by priority', () => {
    const specs = [
      makeSpec('low', 'ready', [], 'low'),
      makeSpec('high', 'ready', [], 'high'),
      makeSpec('blocked', 'blocked', [], 'critical'),
    ];

    const ready = findReadySpecsSorted(specs);

    expect(ready.map((s) => s.id)).toEqual(['high', 'low']);
  });

  test('limits results with limit option', () => {
    const specs = [
      makeSpec('a', 'ready', [], 'critical'),
      makeSpec('b', 'ready', [], 'high'),
      makeSpec('c', 'ready', [], 'normal'),
      makeSpec('d', 'ready', [], 'low'),
    ];

    const limited = findReadySpecsSorted(specs, { limit: 2 });

    expect(limited).toHaveLength(2);
    expect(limited.map((s) => s.id)).toEqual(['a', 'b']);
  });

  test('filters by priority level', () => {
    const specs = [
      makeSpec('a', 'ready', [], 'high'),
      makeSpec('b', 'ready', [], 'high'),
      makeSpec('c', 'ready', [], 'normal'),
    ];

    const highOnly = findReadySpecsSorted(specs, { priorityFilter: 'high' });

    expect(highOnly).toHaveLength(2);
    expect(highOnly.every((s) => s.priority === 'high')).toBe(true);
  });

  test('combines limit and priority filter', () => {
    const specs = [
      makeSpec('a', 'ready', [], 'high'),
      makeSpec('b', 'ready', [], 'high'),
      makeSpec('c', 'ready', [], 'high'),
      makeSpec('d', 'ready', [], 'normal'),
    ];

    const result = findReadySpecsSorted(specs, { priorityFilter: 'high', limit: 2 });

    expect(result).toHaveLength(2);
  });

  test('returns empty array when no specs match filter', () => {
    const specs = [
      makeSpec('a', 'ready', [], 'normal'),
      makeSpec('b', 'ready', [], 'low'),
    ];

    const critical = findReadySpecsSorted(specs, { priorityFilter: 'critical' });

    expect(critical).toHaveLength(0);
  });
});
