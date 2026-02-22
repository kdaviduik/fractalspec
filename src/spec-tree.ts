/**
 * Builds a tree structure from flat spec list.
 * Tree hierarchy is determined by parent references.
 */

import type { Spec, SpecNode, Status } from './types';
import { getStatusIcon } from './types';
import { isNoColorSet } from './help.js';
import { computeEffectiveStatuses } from './spec-query';

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

  sortTree(roots);
  return roots;
}

function compareByPriorityThenTitle(a: SpecNode, b: SpecNode): number {
  if (a.spec.priority !== b.spec.priority) {
    return b.spec.priority - a.spec.priority;
  }
  return a.spec.title.localeCompare(b.spec.title);
}

function sortTree(nodes: SpecNode[]): void {
  nodes.sort(compareByPriorityThenTitle);
  for (const node of nodes) {
    sortTree(node.children);
  }
}

function renderNode(
  node: SpecNode,
  prefix: string,
  isLast: boolean,
  effectiveStatuses: Map<string, Status>
): string[] {
  const accessible = isNoColorSet();

  // Use ASCII tree characters for better screen reader compatibility
  const connector = accessible
    ? (isLast ? 'L ' : '+ ')
    : (isLast ? '└─' : '├─');

  const effectiveStatus = effectiveStatuses.get(node.spec.id) ?? node.spec.status;
  // Omit icons in accessible mode, status text is always present
  const icon = accessible ? '' : `${getStatusIcon(effectiveStatus)} `;
  const line = `${prefix}${connector}${icon}[${effectiveStatus}, P${node.spec.priority}] ${node.spec.title} [${node.spec.id}]`;

  const childPrefix = prefix + (isLast
    ? (accessible ? '  ' : '   ')
    : (accessible ? '| ' : '│  ')
  );
  const childLines = node.children.flatMap((child, i) =>
    renderNode(child, childPrefix, i === node.children.length - 1, effectiveStatuses)
  );

  return [line, ...childLines];
}

/**
 * Renders the spec tree to a string.
 *
 * Parent specs show their "effective status" derived from children's states,
 * not their stored status. This helps users understand the actual state of
 * a subtree at a glance.
 *
 * When NO_COLOR is set, uses ASCII characters for accessibility.
 */
export function renderTree(tree: SpecNode[], allSpecs: Spec[]): string {
  if (tree.length === 0) {
    return '';
  }

  const effectiveStatuses = computeEffectiveStatuses(allSpecs);

  const lines = tree.flatMap((root, i) =>
    renderNode(root, '', i === tree.length - 1, effectiveStatuses)
  );
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
