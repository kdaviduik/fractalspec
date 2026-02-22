import { describe, expect, test } from 'bun:test';
import { buildSpecTree, renderTree, computeDepths } from './spec-tree';
import type { Spec, SpecNode } from './types';

function makeSpec(
  id: string,
  parent: string | null = null,
  overrides: Partial<Pick<Spec, 'priority' | 'status' | 'title'>> = {}
): Spec {
  return {
    id,
    status: overrides.status ?? 'ready',
    parent,
    blockedBy: [],
    priority: overrides.priority ?? 5,
    pr: null,
    title: overrides.title ?? `Spec ${id}`,
    content: `# Spec: Spec ${id}`,
    filePath: `/path/${id}.md`,
  };
}

/**
 * Extracts all specs from a tree structure for passing to renderTree.
 */
function extractSpecsFromTree(nodes: SpecNode[]): Spec[] {
  const specs: Spec[] = [];
  function collect(node: SpecNode): void {
    specs.push(node.spec);
    node.children.forEach(collect);
  }
  nodes.forEach(collect);
  return specs;
}

describe('buildSpecTree', () => {
  test('returns empty array for empty input', () => {
    const tree = buildSpecTree([]);
    expect(tree).toEqual([]);
  });

  test('builds flat tree from specs without parents', () => {
    const specs = [makeSpec('a1b2'), makeSpec('c3d4'), makeSpec('e5f6')];

    const tree = buildSpecTree(specs);

    expect(tree).toHaveLength(3);
    expect(tree.every((node) => node.children.length === 0)).toBe(true);
  });

  test('nests children under parent', () => {
    const specs = [
      makeSpec('parent'),
      makeSpec('child1', 'parent'),
      makeSpec('child2', 'parent'),
    ];

    const tree = buildSpecTree(specs);

    expect(tree).toHaveLength(1);

    const parentNode = tree[0];
    expect(parentNode).toBeDefined();
    expect(parentNode?.spec.id).toBe('parent');
    expect(parentNode?.children).toHaveLength(2);

    const childIds = parentNode?.children.map((c) => c.spec.id).sort();
    expect(childIds).toEqual(['child1', 'child2']);
  });

  test('builds multi-level tree', () => {
    const specs = [
      makeSpec('root'),
      makeSpec('child', 'root'),
      makeSpec('grandchild', 'child'),
    ];

    const tree = buildSpecTree(specs);

    expect(tree).toHaveLength(1);

    const root = tree[0];
    expect(root?.spec.id).toBe('root');
    expect(root?.children).toHaveLength(1);

    const child = root?.children[0];
    expect(child?.spec.id).toBe('child');
    expect(child?.children).toHaveLength(1);

    const grandchild = child?.children[0];
    expect(grandchild?.spec.id).toBe('grandchild');
    expect(grandchild?.children).toHaveLength(0);
  });

  test('handles orphan specs (parent not found)', () => {
    const specs = [makeSpec('orphan', 'missing-parent')];

    const tree = buildSpecTree(specs);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.spec.id).toBe('orphan');
  });

  test('handles multiple root specs', () => {
    const specs = [
      makeSpec('root1'),
      makeSpec('root2'),
      makeSpec('child1', 'root1'),
      makeSpec('child2', 'root2'),
    ];

    const tree = buildSpecTree(specs);

    expect(tree).toHaveLength(2);
    const rootIds = tree.map((n) => n.spec.id).sort();
    expect(rootIds).toEqual(['root1', 'root2']);
  });
});

describe('renderTree', () => {
  test('renders empty tree', () => {
    const result = renderTree([], []);
    expect(result).toBe('');
  });

  test('renders flat list', () => {
    const tree: SpecNode[] = [
      { spec: makeSpec('a1b2'), children: [] },
      { spec: makeSpec('c3d4'), children: [] },
    ];

    const result = renderTree(tree, extractSpecsFromTree(tree));

    expect(result).toContain('Spec a1b2');
    expect(result).toContain('Spec c3d4');
  });

  test('renders nested tree with proper connectors', () => {
    const tree: SpecNode[] = [
      {
        spec: makeSpec('root'),
        children: [
          {
            spec: makeSpec('child', 'root'),
            children: [{ spec: makeSpec('grandchild', 'child'), children: [] }],
          },
        ],
      },
    ];

    const result = renderTree(tree, extractSpecsFromTree(tree));
    const lines = result.split('\n');

    expect(lines[0]).toContain('Spec root');
    expect(lines[1]).toContain('└─');
    expect(lines[1]).toContain('Spec child');
    expect(lines[2]).toContain('└─');
    expect(lines[2]).toContain('Spec grandchild');
  });

  test('shows status icon and text label', () => {
    const spec = makeSpec('a1b2', null, { status: 'blocked' });
    const tree: SpecNode[] = [{ spec, children: [] }];

    const result = renderTree(tree, extractSpecsFromTree(tree));

    expect(result).toContain('⊘');
    expect(result).toContain('[blocked, P5]');
  });

  test('shows bracketed status and priority format', () => {
    const spec = makeSpec('x1y2', null, { status: 'ready', priority: 8 });
    const tree: SpecNode[] = [{ spec, children: [] }];

    const result = renderTree(tree, extractSpecsFromTree(tree));

    expect(result).toContain('[ready, P8]');
  });

  test('shows bracketed format for in_progress with high priority', () => {
    const spec = makeSpec('z9w8', null, { status: 'in_progress', priority: 10 });
    const tree: SpecNode[] = [{ spec, children: [] }];

    const result = renderTree(tree, extractSpecsFromTree(tree));

    expect(result).toContain('[in_progress, P10]');
  });

  test('includes ID in output', () => {
    const tree: SpecNode[] = [{ spec: makeSpec('xyz123'), children: [] }];

    const result = renderTree(tree, extractSpecsFromTree(tree));

    expect(result).toContain('xyz123');
  });

  test('uses ├─ for non-last children and └─ for last child', () => {
    const tree: SpecNode[] = [
      {
        spec: makeSpec('root'),
        children: [
          { spec: makeSpec('child1', 'root'), children: [] },
          { spec: makeSpec('child2', 'root'), children: [] },
          { spec: makeSpec('child3', 'root'), children: [] },
        ],
      },
    ];

    const result = renderTree(tree, extractSpecsFromTree(tree));
    const lines = result.split('\n');

    const child1Line = lines.find((l) => l.includes('child1'));
    const child2Line = lines.find((l) => l.includes('child2'));
    const child3Line = lines.find((l) => l.includes('child3'));

    expect(child1Line).toContain('├─');
    expect(child2Line).toContain('├─');
    expect(child3Line).toContain('└─');
  });

  test('uses │ continuation lines for non-last parent branches', () => {
    const tree: SpecNode[] = [
      {
        spec: makeSpec('root'),
        children: [
          {
            spec: makeSpec('branch1', 'root'),
            children: [{ spec: makeSpec('leaf1', 'branch1'), children: [] }],
          },
          {
            spec: makeSpec('branch2', 'root'),
            children: [{ spec: makeSpec('leaf2', 'branch2'), children: [] }],
          },
        ],
      },
    ];

    const result = renderTree(tree, extractSpecsFromTree(tree));
    const lines = result.split('\n');

    const leaf1Line = lines.find((l) => l.includes('leaf1'));
    const leaf2Line = lines.find((l) => l.includes('leaf2'));

    expect(leaf1Line).toContain('│');
    expect(leaf2Line).not.toContain('│');
  });

  test('shows correct status icons for each status', () => {
    const readySpec = makeSpec('s1');
    readySpec.status = 'ready';
    const ipSpec = makeSpec('s2');
    ipSpec.status = 'in_progress';
    const closedSpec = makeSpec('s3');
    closedSpec.status = 'closed';

    const tree: SpecNode[] = [
      { spec: readySpec, children: [] },
      { spec: ipSpec, children: [] },
      { spec: closedSpec, children: [] },
    ];

    const result = renderTree(tree, extractSpecsFromTree(tree));

    expect(result).toContain('○');
    expect(result).toContain('◐');
    expect(result).toContain('●');
  });
});

describe('computeDepths', () => {
  test('returns empty map for empty input', () => {
    const depths = computeDepths([]);
    expect(depths.size).toBe(0);
  });

  test('root specs have depth 0', () => {
    const specs = [makeSpec('a'), makeSpec('b'), makeSpec('c')];

    const depths = computeDepths(specs);

    expect(depths.get('a')).toBe(0);
    expect(depths.get('b')).toBe(0);
    expect(depths.get('c')).toBe(0);
  });

  test('child specs have depth 1', () => {
    const specs = [
      makeSpec('root'),
      makeSpec('child1', 'root'),
      makeSpec('child2', 'root'),
    ];

    const depths = computeDepths(specs);

    expect(depths.get('root')).toBe(0);
    expect(depths.get('child1')).toBe(1);
    expect(depths.get('child2')).toBe(1);
  });

  test('grandchild specs have depth 2', () => {
    const specs = [
      makeSpec('root'),
      makeSpec('child', 'root'),
      makeSpec('grandchild', 'child'),
    ];

    const depths = computeDepths(specs);

    expect(depths.get('root')).toBe(0);
    expect(depths.get('child')).toBe(1);
    expect(depths.get('grandchild')).toBe(2);
  });

  test('orphan specs have depth 0', () => {
    const specs = [makeSpec('orphan', 'nonexistent')];

    const depths = computeDepths(specs);

    expect(depths.get('orphan')).toBe(0);
  });

  test('handles multiple independent trees', () => {
    const specs = [
      makeSpec('root1'),
      makeSpec('child1', 'root1'),
      makeSpec('root2'),
      makeSpec('child2', 'root2'),
      makeSpec('grandchild2', 'child2'),
    ];

    const depths = computeDepths(specs);

    expect(depths.get('root1')).toBe(0);
    expect(depths.get('child1')).toBe(1);
    expect(depths.get('root2')).toBe(0);
    expect(depths.get('child2')).toBe(1);
    expect(depths.get('grandchild2')).toBe(2);
  });

  test('handles circular parent references without infinite loop', () => {
    const specs = [makeSpec('a', 'b'), makeSpec('b', 'a')];

    // Should complete without infinite recursion
    const depths = computeDepths(specs);

    // The implementation processes specs in order:
    // - 'a' visits 'b' (not cached), 'b' visits 'a' (in visited set, returns 0), so b=1, a=2
    // - 'b' is already cached with depth 1
    expect(depths.get('a')).toBe(2);
    expect(depths.get('b')).toBe(1);
  });

  test('handles self-referential parent without infinite loop', () => {
    const specs = [makeSpec('self', 'self')];

    // Should complete without infinite recursion
    const depths = computeDepths(specs);

    // Self-reference: visits self, adds to visited, tries parent (self), which is in visited, returns 0
    // So depth = 0 + 1 = 1
    expect(depths.get('self')).toBe(1);
  });
});

describe('tree sorting', () => {
  test('roots sorted by priority descending', () => {
    const specs = [
      makeSpec('low', null, { priority: 2, title: 'Low Priority' }),
      makeSpec('mid', null, { priority: 5, title: 'Mid Priority' }),
      makeSpec('high', null, { priority: 9, title: 'High Priority' }),
    ];

    const tree = buildSpecTree(specs);
    const result = renderTree(tree, specs);
    const lines = result.split('\n');

    const highIdx = lines.findIndex((l) => l.includes('High Priority'));
    const midIdx = lines.findIndex((l) => l.includes('Mid Priority'));
    const lowIdx = lines.findIndex((l) => l.includes('Low Priority'));

    expect(highIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lowIdx);
  });

  test('children sorted by priority descending', () => {
    const specs = [
      makeSpec('parent', null, { priority: 5, title: 'Parent' }),
      makeSpec('c-low', 'parent', { priority: 3, title: 'Child Low' }),
      makeSpec('c-high', 'parent', { priority: 8, title: 'Child High' }),
      makeSpec('c-mid', 'parent', { priority: 5, title: 'Child Mid' }),
    ];

    const tree = buildSpecTree(specs);
    const result = renderTree(tree, specs);
    const lines = result.split('\n');

    const highIdx = lines.findIndex((l) => l.includes('Child High'));
    const midIdx = lines.findIndex((l) => l.includes('Child Mid'));
    const lowIdx = lines.findIndex((l) => l.includes('Child Low'));

    expect(highIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lowIdx);
  });

  test('priority ties broken by alphabetical title', () => {
    const specs = [
      makeSpec('z', null, { priority: 5, title: 'Zebra' }),
      makeSpec('a', null, { priority: 5, title: 'Apple' }),
      makeSpec('m', null, { priority: 5, title: 'Mango' }),
    ];

    const tree = buildSpecTree(specs);
    const result = renderTree(tree, specs);
    const lines = result.split('\n');

    const appleIdx = lines.findIndex((l) => l.includes('Apple'));
    const mangoIdx = lines.findIndex((l) => l.includes('Mango'));
    const zebraIdx = lines.findIndex((l) => l.includes('Zebra'));

    expect(appleIdx).toBeLessThan(mangoIdx);
    expect(mangoIdx).toBeLessThan(zebraIdx);
  });

  test('grandchildren also sorted by priority descending', () => {
    const specs = [
      makeSpec('root', null, { priority: 5, title: 'Root' }),
      makeSpec('child', 'root', { priority: 5, title: 'Child' }),
      makeSpec('gc-low', 'child', { priority: 2, title: 'GC Low' }),
      makeSpec('gc-high', 'child', { priority: 9, title: 'GC High' }),
    ];

    const tree = buildSpecTree(specs);
    const result = renderTree(tree, specs);
    const lines = result.split('\n');

    const highIdx = lines.findIndex((l) => l.includes('GC High'));
    const lowIdx = lines.findIndex((l) => l.includes('GC Low'));

    expect(highIdx).toBeLessThan(lowIdx);
  });

  test('all children at same priority sorted alphabetically', () => {
    const specs = [
      makeSpec('parent', null, { priority: 5, title: 'Parent' }),
      makeSpec('c', 'parent', { priority: 7, title: 'Charlie' }),
      makeSpec('a', 'parent', { priority: 7, title: 'Alpha' }),
      makeSpec('b', 'parent', { priority: 7, title: 'Bravo' }),
    ];

    const tree = buildSpecTree(specs);
    const result = renderTree(tree, specs);
    const lines = result.split('\n');

    const alphaIdx = lines.findIndex((l) => l.includes('Alpha'));
    const bravoIdx = lines.findIndex((l) => l.includes('Bravo'));
    const charlieIdx = lines.findIndex((l) => l.includes('Charlie'));

    expect(alphaIdx).toBeLessThan(bravoIdx);
    expect(bravoIdx).toBeLessThan(charlieIdx);
  });
});
