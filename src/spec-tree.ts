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

/**
 * Computes hierarchy depth for each spec (distance from root).
 * Root specs have depth 0, their children have depth 1, etc.
 * Orphan specs (with missing parent) are treated as roots (depth 0).
 * Returns a Map from spec ID to depth.
 */
export function computeDepths(specs: Spec[]): Map<string, number> {
  const depths = new Map<string, number>();
  const specMap = new Map(specs.map((s) => [s.id, s]));

  function getDepth(specId: string, visited: Set<string>): number {
    if (visited.has(specId)) {
      return 0;
    }

    const cached = depths.get(specId);
    if (cached !== undefined) {
      return cached;
    }

    const spec = specMap.get(specId);
    if (!spec) {
      return 0;
    }

    if (spec.parent === null) {
      depths.set(specId, 0);
      return 0;
    }

    const parentExists = specMap.has(spec.parent);
    if (!parentExists) {
      depths.set(specId, 0);
      return 0;
    }

    visited.add(specId);
    const parentDepth = getDepth(spec.parent, visited);
    const depth = parentDepth + 1;
    depths.set(specId, depth);
    return depth;
  }

  for (const spec of specs) {
    getDepth(spec.id, new Set());
  }

  return depths;
}
