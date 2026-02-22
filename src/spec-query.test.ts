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
  computeEffectiveStatuses,
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

  test('includes blocked spec whose single blocker is closed', () => {
    const specs = [
      makeSpec('blocker', 'closed'),
      makeSpec('blocked', 'blocked', ['blocker']),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0]?.id).toBe('blocked');
  });

  test('includes blocked spec whose multiple blockers are all in COMPLETED_STATUSES', () => {
    const specs = [
      makeSpec('b1', 'closed'),
      makeSpec('b2', 'deferred'),
      makeSpec('b3', 'not_planned'),
      makeSpec('target', 'blocked', ['b1', 'b2', 'b3']),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0]?.id).toBe('target');
  });

  test('excludes blocked spec with at least one unresolved blocker', () => {
    const specs = [
      makeSpec('done', 'closed'),
      makeSpec('wip', 'in_progress'),
      makeSpec('target', 'blocked', ['done', 'wip']),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(0);
  });

  test('excludes manually-blocked spec (status=blocked, blockedBy=[])', () => {
    const specs = [
      makeSpec('manual', 'blocked', []),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(0);
  });

  test('excludes parent specs even if effectively ready via resolved blockers', () => {
    const specs = [
      makeSpec('blocker', 'closed'),
      makeSpec('parent', 'blocked', ['blocker']),
      makeSpec('child', 'ready', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = findReadySpecs(specs);

    expect(result.specs).toHaveLength(1);
    expect(result.specs[0]?.id).toBe('child');
    expect(result.excludedParentCount).toBe(1);
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

describe('computeEffectiveStatuses', () => {
  // Rule: Leaf specs return stored status
  test('leaf spec returns stored status', () => {
    const specs = [makeSpec('leaf', 'in_progress')];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('leaf')).toBe('in_progress');
  });

  test('root spec without children returns stored status', () => {
    const specs = [makeSpec('root', 'ready')];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('root')).toBe('ready');
  });

  // Rule 1: All terminal statuses
  test('parent with all children closed → closed', () => {
    const specs = [
      makeSpec('parent', 'ready'),
      makeSpec('child1', 'closed', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child2', 'closed', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('closed');
  });

  test('parent with all children not_planned → not_planned', () => {
    const specs = [
      makeSpec('parent', 'ready'),
      makeSpec('child1', 'not_planned', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child2', 'not_planned', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('not_planned');
  });

  test('parent with all children deferred → deferred', () => {
    const specs = [
      makeSpec('parent', 'ready'),
      makeSpec('child1', 'deferred', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child2', 'deferred', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('deferred');
  });

  test('parent with mixed terminal children → closed', () => {
    const specs = [
      makeSpec('parent', 'ready'),
      makeSpec('child1', 'closed', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child2', 'deferred', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child3', 'not_planned', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('closed');
  });

  // Rule 2: Any in_progress
  test('parent with any child in_progress → in_progress', () => {
    const specs = [
      makeSpec('parent', 'ready'),
      makeSpec('child1', 'ready', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child2', 'in_progress', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child3', 'blocked', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('in_progress');
  });

  // Rule 3: All non-terminal blocked
  test('parent with all non-terminal children blocked → blocked', () => {
    const specs = [
      makeSpec('parent', 'ready'),
      makeSpec('child1', 'blocked', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child2', 'blocked', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child3', 'closed', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('blocked');
  });

  test('parent with blocked + ready children → ready (not blocked)', () => {
    const specs = [
      makeSpec('parent', 'ready'),
      makeSpec('child1', 'blocked', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child2', 'ready', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('ready');
  });

  // Rule 4: Partial completion
  test('parent with some closed + some ready → in_progress (partial)', () => {
    const specs = [
      makeSpec('parent', 'ready'),
      makeSpec('child1', 'closed', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child2', 'ready', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('in_progress');
  });

  // Rule 5: Any ready
  test('parent with only ready children → ready', () => {
    const specs = [
      makeSpec('parent', 'blocked'),
      makeSpec('child1', 'ready', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child2', 'ready', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('ready');
  });

  // Recursive derivation
  test('grandparent status derived recursively from grandchildren', () => {
    const specs = [
      makeSpec('grandparent', 'ready'),
      makeSpec('parent', 'ready', [], DEFAULT_PRIORITY, 'grandparent'),
      makeSpec('child1', 'in_progress', [], DEFAULT_PRIORITY, 'parent'),
      makeSpec('child2', 'ready', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('in_progress');
    expect(result.get('grandparent')).toBe('in_progress');
  });

  test('deep hierarchy (10+ levels) computes correctly', () => {
    const specs: Spec[] = [];
    const depth = 12;

    // Create a chain: root → level1 → level2 → ... → leaf
    for (let i = 0; i < depth; i++) {
      const parent = i === 0 ? null : `level${i - 1}`;
      specs.push(makeSpec(`level${i}`, 'ready', [], DEFAULT_PRIORITY, parent));
    }
    // Make the deepest level in_progress
    const leaf = specs[specs.length - 1];
    if (leaf) {
      leaf.status = 'in_progress';
    }

    const result = computeEffectiveStatuses(specs);

    // All ancestors should be in_progress due to recursive derivation
    for (let i = 0; i < depth - 1; i++) {
      expect(result.get(`level${i}`)).toBe('in_progress');
    }
    expect(result.get(`level${depth - 1}`)).toBe('in_progress');
  });

  // Cycle detection
  test('circular parent references are handled (cycle detection)', () => {
    const specA = makeSpec('a', 'ready', [], DEFAULT_PRIORITY, 'b');
    const specB = makeSpec('b', 'ready', [], DEFAULT_PRIORITY, 'a');

    const specs = [specA, specB];

    // Should not throw or infinite loop
    const result = computeEffectiveStatuses(specs);

    // Both should have some status (breaks cycle with stored status)
    expect(result.has('a')).toBe(true);
    expect(result.has('b')).toBe(true);
  });

  // Orphaned children (parent ID doesn't exist)
  test('orphaned child (missing parent) treated as root', () => {
    const specs = [
      makeSpec('orphan', 'ready', [], DEFAULT_PRIORITY, 'nonexistent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('orphan')).toBe('ready');
  });

  // Multiple root specs
  test('multiple root specs computed independently', () => {
    const specs = [
      makeSpec('root1', 'ready'),
      makeSpec('child1', 'closed', [], DEFAULT_PRIORITY, 'root1'),
      makeSpec('root2', 'ready'),
      makeSpec('child2', 'in_progress', [], DEFAULT_PRIORITY, 'root2'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('root1')).toBe('closed');
    expect(result.get('root2')).toBe('in_progress');
  });

  // Edge case: Single child
  test('parent with single child inherits that child status', () => {
    const specs = [
      makeSpec('parent', 'ready'),
      makeSpec('child', 'blocked', [], DEFAULT_PRIORITY, 'parent'),
    ];

    const result = computeEffectiveStatuses(specs);

    expect(result.get('parent')).toBe('blocked');
  });

  // Edge case: Empty specs array
  test('empty specs returns empty map', () => {
    const result = computeEffectiveStatuses([]);

    expect(result.size).toBe(0);
  });
});
