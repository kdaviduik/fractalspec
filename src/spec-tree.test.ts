import { describe, expect, test } from 'bun:test';
import { buildSpecTree, renderTree, computeDepths } from './spec-tree';
import type { Spec, SpecNode } from './types';

function makeSpec(id: string, parent: string | null = null): Spec {
  return {
    id,
    status: 'ready',
    parent,
    blocks: [],
    priority: 5,
    pr: null,
    workstream: null,
    title: `Spec ${id}`,
    content: `# Spec: Spec ${id}`,
    filePath: `/path/${id}.md`,
  };
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
    const result = renderTree([]);
    expect(result).toBe('');
  });

  test('renders flat list', () => {
    const tree: SpecNode[] = [
      { spec: makeSpec('a1b2'), children: [] },
      { spec: makeSpec('c3d4'), children: [] },
    ];

    const result = renderTree(tree);

    expect(result).toContain('Spec a1b2');
    expect(result).toContain('Spec c3d4');
  });

  test('renders nested tree with indentation', () => {
    const tree: SpecNode[] = [
      {
        spec: makeSpec('root'),
        children: [
          {
            spec: makeSpec('child'),
            children: [{ spec: makeSpec('grandchild'), children: [] }],
          },
        ],
      },
    ];

    const result = renderTree(tree);
    const lines = result.split('\n');

    expect(lines.some((l) => l.includes('Spec root'))).toBe(true);
    expect(lines.some((l) => l.includes('  ') && l.includes('Spec child'))).toBe(
      true
    );
    expect(
      lines.some((l) => l.includes('    ') && l.includes('Spec grandchild'))
    ).toBe(true);
  });

  test('includes status in output', () => {
    const spec = makeSpec('a1b2');
    spec.status = 'blocked';
    const tree: SpecNode[] = [{ spec, children: [] }];

    const result = renderTree(tree);

    expect(result).toContain('blocked');
  });

  test('includes ID in output', () => {
    const tree: SpecNode[] = [{ spec: makeSpec('xyz123'), children: [] }];

    const result = renderTree(tree);

    expect(result).toContain('xyz123');
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
