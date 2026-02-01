import { describe, expect, test } from 'bun:test';
import {
  findSpecById,
  filterByStatus,
  findReadySpecs,
  findReadySpecsSorted,
  sortByPriority,
  getStatusSummary,
  parsePriorityFilter,
  getParentSpecIds,
} from './spec-query';
import type { Spec, Status, Priority } from './types';
import { DEFAULT_PRIORITY } from './types';

function makeSpec(
  id: string,
  status: Status = 'ready',
  blockedBy: string[] = [],
  priority: Priority = DEFAULT_PRIORITY,
  parent: string | null = null
): Spec {
  return {
    id,
    status,
    parent,
    blockedBy,
    priority,
    pr: null,
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

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(2);
    expect(result.specs.map((s) => s.id).sort()).toEqual(['a', 'c']);
    expect(result.excludedParentCount).toBe(0);
  });

  test('excludes specs blocked by in_progress specs', () => {
    const blockedSpec = makeSpec('a', 'ready');
    blockedSpec.blockedBy = ['b'];

    const blockerSpec = makeSpec('b', 'in_progress');

    const specs = [blockedSpec, blockerSpec];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(0);
  });

  test('includes specs when blocker is closed', () => {
    const blockedSpec = makeSpec('a', 'ready');
    blockedSpec.blockedBy = ['b'];

    const blockerSpec = makeSpec('b', 'closed');

    const specs = [blockedSpec, blockerSpec];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0]?.id).toBe('a');
  });

  test('returns empty array when all specs blocked', () => {
    const specs = [
      makeSpec('a', 'blocked'),
      makeSpec('b', 'in_progress'),
      makeSpec('c', 'closed'),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(0);
  });

  test('excludes parent specs from ready list', () => {
    const specs = [
      makeSpec('parent', 'ready'),
      makeSpec('child', 'ready', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0]?.id).toBe('child');
    expect(result.excludedParentCount).toBe(1);
  });

  test('includes leaf specs with ready status', () => {
    const specs = [
      makeSpec('leaf1', 'ready'),
      makeSpec('leaf2', 'ready'),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(2);
    expect(result.excludedParentCount).toBe(0);
  });

  test('excludedParentCount is correct', () => {
    const specs = [
      makeSpec('parent1', 'ready'),
      makeSpec('parent2', 'ready'),
      makeSpec('child1', 'ready', [], DEFAULT_PRIORITY, 'parent1'),
      makeSpec('child2', 'ready', [], DEFAULT_PRIORITY, 'parent2'),
      makeSpec('leaf', 'ready'),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(3);
    expect(result.excludedParentCount).toBe(2);
  });

  test('multi-level hierarchy: only leaf specs appear', () => {
    const specs = [
      makeSpec('root', 'ready'),
      makeSpec('mid', 'ready', [], DEFAULT_PRIORITY, 'root'),
      makeSpec('leaf', 'ready', [], DEFAULT_PRIORITY, 'mid'),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0]?.id).toBe('leaf');
    expect(result.excludedParentCount).toBe(2);
  });

  test('spec whose children were all removed appears in ready', () => {
    const specs = [
      makeSpec('former-parent', 'ready'),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0]?.id).toBe('former-parent');
    expect(result.excludedParentCount).toBe(0);
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
  test('sorts by priority (10 > 8 > 5 > 2) - higher number = higher priority', () => {
    const specs = [
      makeSpec('p2', 'ready', [], 2),
      makeSpec('p8', 'ready', [], 8),
      makeSpec('p5', 'ready', [], 5),
      makeSpec('p10', 'ready', [], 10),
    ];

    const sorted = sortByPriority(specs, { allSpecs: specs });

    expect(sorted.map((s) => s.id)).toEqual(['p10', 'p8', 'p5', 'p2']);
  });

  test('sorts by depth descending within same priority (leaves first)', () => {
    const root = makeSpec('root', 'ready', [], 5, null);
    const child = makeSpec('child', 'ready', [], 5, 'root');
    const grandchild = makeSpec('grandchild', 'ready', [], 5, 'child');

    const specs = [root, child, grandchild];
    const sorted = sortByPriority(specs, { allSpecs: specs });

    expect(sorted.map((s) => s.id)).toEqual(['grandchild', 'child', 'root']);
  });

  test('sorts alphabetically by title as tiebreaker', () => {
    const specA = makeSpec('a', 'ready', [], 5);
    specA.title = 'AAA Feature';
    const specB = makeSpec('b', 'ready', [], 5);
    specB.title = 'BBB Feature';
    const specC = makeSpec('c', 'ready', [], 5);
    specC.title = 'CCC Feature';

    const specs = [specC, specA, specB];
    const sorted = sortByPriority(specs, { allSpecs: specs });

    expect(sorted.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  test('combines priority, depth, and title sorting', () => {
    const highRoot = makeSpec('high-root', 'ready', [], 8, null);
    const highChild = makeSpec('high-child', 'ready', [], 8, 'high-root');
    const normalRoot = makeSpec('normal-root', 'ready', [], 5, null);

    const specs = [normalRoot, highRoot, highChild];
    const sorted = sortByPriority(specs, { allSpecs: specs });

    expect(sorted.map((s) => s.id)).toEqual(['high-child', 'high-root', 'normal-root']);
  });
});

describe('findReadySpecsSorted', () => {
  test('returns ready specs sorted by priority', () => {
    const specs = [
      makeSpec('low', 'ready', [], 2),
      makeSpec('high', 'ready', [], 8),
      makeSpec('blocked', 'blocked', [], 10),
    ];

    const result = findReadySpecsSorted(specs);

    expect(result.specs.map((s) => s.id)).toEqual(['high', 'low']);
  });

  test('limits results with limit option', () => {
    const specs = [
      makeSpec('a', 'ready', [], 10),
      makeSpec('b', 'ready', [], 8),
      makeSpec('c', 'ready', [], 5),
      makeSpec('d', 'ready', [], 2),
    ];

    const result = findReadySpecsSorted(specs, { limit: 2 });

    expect(result.specs).toHaveLength(2);
    expect(result.specs.map((s) => s.id)).toEqual(['a', 'b']);
  });

  test('filters by exact priority', () => {
    const specs = [
      makeSpec('a', 'ready', [], 8),
      makeSpec('b', 'ready', [], 8),
      makeSpec('c', 'ready', [], 5),
    ];

    const result = findReadySpecsSorted(specs, { priorityFilter: 8 });

    expect(result.specs).toHaveLength(2);
    expect(result.specs.every((s) => s.priority === 8)).toBe(true);
  });

  test('filters by priority range', () => {
    const specs = [
      makeSpec('a', 'ready', [], 10),
      makeSpec('b', 'ready', [], 8),
      makeSpec('c', 'ready', [], 5),
      makeSpec('d', 'ready', [], 2),
    ];

    const result = findReadySpecsSorted(specs, { priorityFilter: { min: 8, max: 10 } });

    expect(result.specs).toHaveLength(2);
    expect(result.specs.map((s) => s.id)).toEqual(['a', 'b']);
  });

  test('combines limit and priority filter', () => {
    const specs = [
      makeSpec('a', 'ready', [], 8),
      makeSpec('b', 'ready', [], 8),
      makeSpec('c', 'ready', [], 8),
      makeSpec('d', 'ready', [], 5),
    ];

    const result = findReadySpecsSorted(specs, { priorityFilter: 8, limit: 2 });

    expect(result.specs).toHaveLength(2);
  });

  test('returns empty array when no specs match filter', () => {
    const specs = [
      makeSpec('a', 'ready', [], 5),
      makeSpec('b', 'ready', [], 2),
    ];

    const result = findReadySpecsSorted(specs, { priorityFilter: 10 });

    expect(result.specs).toHaveLength(0);
  });
});

describe('parsePriorityFilter', () => {
  test('parses single valid priority', () => {
    expect(parsePriorityFilter('5')).toBe(5);
    expect(parsePriorityFilter('1')).toBe(1);
    expect(parsePriorityFilter('10')).toBe(10);
  });

  test('parses valid priority range', () => {
    expect(parsePriorityFilter('3-7')).toEqual({ min: 3, max: 7 });
    expect(parsePriorityFilter('1-10')).toEqual({ min: 1, max: 10 });
    expect(parsePriorityFilter('8-10')).toEqual({ min: 8, max: 10 });
  });

  test('returns null for invalid single priority', () => {
    expect(parsePriorityFilter('0')).toBeNull();
    expect(parsePriorityFilter('11')).toBeNull();
    expect(parsePriorityFilter('high')).toBeNull();
    expect(parsePriorityFilter('')).toBeNull();
  });

  test('returns null for invalid range', () => {
    expect(parsePriorityFilter('7-3')).toBeNull();
    expect(parsePriorityFilter('0-5')).toBeNull();
    expect(parsePriorityFilter('5-11')).toBeNull();
    expect(parsePriorityFilter('a-b')).toBeNull();
  });
});

describe('getParentSpecIds', () => {
  test('returns empty set when no specs have parents', () => {
    const specs = [makeSpec('a'), makeSpec('b'), makeSpec('c')];

    const result = getParentSpecIds(specs);

    expect(result.size).toBe(0);
  });

  test('returns correct IDs when specs reference parents', () => {
    const specs = [
      makeSpec('parent1'),
      makeSpec('child1', 'ready', [], DEFAULT_PRIORITY, 'parent1'),
      makeSpec('orphan'),
    ];

    const result = getParentSpecIds(specs);

    expect(result.size).toBe(1);
    expect(result.has('parent1')).toBe(true);
  });

  test('handles duplicate parent references from multiple children', () => {
    const specs = [
      makeSpec('parent1'),
      makeSpec('child1', 'ready', [], DEFAULT_PRIORITY, 'parent1'),
      makeSpec('child2', 'ready', [], DEFAULT_PRIORITY, 'parent1'),
      makeSpec('child3', 'ready', [], DEFAULT_PRIORITY, 'parent1'),
    ];

    const result = getParentSpecIds(specs);

    expect(result.size).toBe(1);
    expect(result.has('parent1')).toBe(true);
  });

  test('returns multiple parent IDs for multi-parent hierarchy', () => {
    const specs = [
      makeSpec('root'),
      makeSpec('mid1', 'ready', [], DEFAULT_PRIORITY, 'root'),
      makeSpec('mid2', 'ready', [], DEFAULT_PRIORITY, 'root'),
      makeSpec('leaf1', 'ready', [], DEFAULT_PRIORITY, 'mid1'),
      makeSpec('leaf2', 'ready', [], DEFAULT_PRIORITY, 'mid2'),
    ];

    const result = getParentSpecIds(specs);

    expect(result.size).toBe(3);
    expect(result.has('root')).toBe(true);
    expect(result.has('mid1')).toBe(true);
    expect(result.has('mid2')).toBe(true);
  });
});
