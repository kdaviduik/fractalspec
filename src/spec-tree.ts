/**
 * Builds a tree structure from flat spec list.
 * Tree hierarchy is determined by parent references.
 */

import type { Spec, SpecNode } from './types';

export function buildSpecTree(specs: Spec[]): SpecNode[] {
  const nodeMap = new Map<string, SpecNode>();
  const roots: SpecNode[] = [];

  for (const spec of specs) {
    nodeMap.set(spec.id, { spec, children: [] });
  }

  for (const spec of specs) {
    const node = nodeMap.get(spec.id);
    if (!node) {
      continue;
    }

    if (spec.parent === null) {
      roots.push(node);
      continue;
    }

    const parentNode = nodeMap.get(spec.parent);
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function renderNode(node: SpecNode, depth: number): string[] {
  const indent = '  '.repeat(depth);
  const { spec } = node;
  const line = `${indent}├─ ${spec.title} [${spec.id}] (${spec.status})`;

  const childLines = node.children.flatMap((child) =>
    renderNode(child, depth + 1)
  );

  return [line, ...childLines];
}

export function renderTree(tree: SpecNode[]): string {
  if (tree.length === 0) {
    return '';
  }

  const lines = tree.flatMap((root) => renderNode(root, 0));
  return lines.join('\n');
}
