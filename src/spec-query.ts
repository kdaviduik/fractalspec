/**
 * Query and filter functions for specs.
 */

import type { Spec, Status, Priority } from './types';
import { COMPLETED_STATUSES, isValidPriority } from './types';
import { computeDepths } from './spec-tree';

/**
 * Computes effective status for all specs.
 *
 * For leaf specs, returns the stored status.
 * For parent specs, derives status from children using these priority rules:
 *
 * 1. All children in COMPLETED_STATUSES:
 *    - All `closed` → `closed`
 *    - All `not_planned` → `not_planned`
 *    - All `deferred` → `deferred`
 *    - Mixed terminal → `closed`
 * 2. Any child effectively `in_progress` → `in_progress`
 * 3. ALL non-terminal children are `blocked` → `blocked`
 * 4. Any child `closed` AND any `ready` → `in_progress` (partial completion)
 * 5. Any child effectively `ready` → `ready`
 * 6. Fallback → `in_progress`
 *
 * Note: For parent specs, `in_progress` means "this subtree has active or partial work"
 * — different from a leaf spec's `in_progress` meaning "someone claimed this."
 *
 * @returns Map from spec ID to effective status
 */
export function computeEffectiveStatuses(allSpecs: Spec[]): Map<string, Status> {
  const effectiveStatuses = new Map<string, Status>();
  const childrenByParent = new Map<string, Spec[]>();

  // Build parent → children lookup (O(N) once)
  for (const spec of allSpecs) {
    if (spec.parent !== null) {
      const siblings = childrenByParent.get(spec.parent) ?? [];
      siblings.push(spec);
      childrenByParent.set(spec.parent, siblings);
    }
  }

  function compute(spec: Spec, visited: Set<string>): Status {
    // Cycle detection: break cycle by using stored status
    if (visited.has(spec.id)) {
      return spec.status;
    }

    // Memoization: return cached result if already computed
    const cached = effectiveStatuses.get(spec.id);
    if (cached !== undefined) {
      return cached;
    }

    const children = childrenByParent.get(spec.id) ?? [];

    // Leaf spec: use stored status
    if (children.length === 0) {
      effectiveStatuses.set(spec.id, spec.status);
      return spec.status;
    }

    // Parent spec: derive from children
    visited.add(spec.id);
    const childStatuses = children.map(c => compute(c, visited));
    visited.delete(spec.id);

    const result = deriveParentStatus(childStatuses);
    effectiveStatuses.set(spec.id, result);
    return result;
  }

  // Compute effective status for all specs
  for (const spec of allSpecs) {
    compute(spec, new Set());
  }

  return effectiveStatuses;
}

/**
 * Derives parent status from child statuses using priority-ordered rules.
 */
function deriveParentStatus(childStatuses: Status[]): Status {
  // Rule 1: All children in terminal statuses
  const allTerminal = childStatuses.every(s => COMPLETED_STATUSES.includes(s));
  if (allTerminal) {
    if (childStatuses.every(s => s === 'closed')) return 'closed';
    if (childStatuses.every(s => s === 'not_planned')) return 'not_planned';
    if (childStatuses.every(s => s === 'deferred')) return 'deferred';
    return 'closed'; // Mixed terminal
  }

  // Rule 2: Any in_progress → in_progress
  if (childStatuses.some(s => s === 'in_progress')) {
    return 'in_progress';
  }

  // Rule 3: ALL non-terminal children are blocked → blocked
  const nonTerminalChildren = childStatuses.filter(
    s => !COMPLETED_STATUSES.includes(s)
  );
  const allNonTerminalBlocked = nonTerminalChildren.length > 0 &&
    nonTerminalChildren.every(s => s === 'blocked');
  if (allNonTerminalBlocked) {
    return 'blocked';
  }

  // Rule 4: Partial completion (some closed + some ready)
  const hasClosed = childStatuses.some(s => s === 'closed');
  const hasReady = childStatuses.some(s => s === 'ready');
  if (hasClosed && hasReady) {
    return 'in_progress';
  }

  // Rule 5: Any ready → ready
  if (hasReady) {
    return 'ready';
  }

  // Rule 6: Fallback
  return 'in_progress';
}

export interface StatusSummary {
  ready: number;
  in_progress: number;
  blocked: number;
  closed: number;
  deferred: number;
  not_planned: number;
  total: number;
}

export function findSpecById(specs: Spec[], idPrefix: string): Spec | null {
  const exactMatch = specs.find((s) => s.id === idPrefix);
  if (exactMatch) {
    return exactMatch;
  }

  const prefixMatches = specs.filter((s) => s.id.startsWith(idPrefix));
  if (prefixMatches.length === 1 && prefixMatches[0]) {
    return prefixMatches[0];
  }

  return null;
}

export function getParentSpecIds(specs: Spec[]): Set<string> {
  const parentIds = new Set<string>();
  for (const spec of specs) {
    if (spec.parent !== null) parentIds.add(spec.parent);
  }
  return parentIds;
}

export function filterByStatus(specs: Spec[], status: Status): Spec[] {
  return specs.filter((s) => s.status === status);
}

export function isBlocked(spec: Spec, allSpecs: Spec[]): boolean {
  if (spec.blockedBy.length === 0) {
    return false;
  }

  for (const blockerId of spec.blockedBy) {
    const blocker = allSpecs.find((s) => s.id === blockerId);
    if (!blocker) {
      continue;
    }
    if (!COMPLETED_STATUSES.includes(blocker.status)) {
      return true;
    }
  }

  return false;
}

export interface ReadySpecsResult {
  specs: Spec[];
  excludedParentCount: number;
}

export function findReadySpecs(specs: Spec[]): ReadySpecsResult {
  const parentIds = getParentSpecIds(specs);
  let excludedParentCount = 0;

  const ready = specs.filter((spec) => {
    const isReadyAndUnblocked = spec.status === 'ready'
      && !isBlocked(spec, specs);
    const isEffectivelyReady = spec.status === 'blocked'
      && spec.blockedBy.length > 0
      && !isBlocked(spec, specs);

    if (!isReadyAndUnblocked && !isEffectivelyReady) return false;
    if (parentIds.has(spec.id)) {
      excludedParentCount++;
      return false;
    }
    return true;
  });

  return { specs: ready, excludedParentCount };
}

export function getStatusSummary(specs: Spec[]): StatusSummary {
  const summary: StatusSummary = {
    ready: 0,
    in_progress: 0,
    blocked: 0,
    closed: 0,
    deferred: 0,
    not_planned: 0,
    total: specs.length,
  };

  for (const spec of specs) {
    summary[spec.status]++;
  }

  return summary;
}

export interface SortOptions {
  allSpecs: Spec[];
}

/**
 * Sorts specs by priority (highest first), then depth (deepest first), then title alphabetically.
 * Sort order: priority (10 first, descending to 1), depth descending, title alphabetically.
 */
export function sortByPriority(specs: Spec[], options: SortOptions): Spec[] {
  const depths = computeDepths(options.allSpecs);

  return [...specs].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }

    const depthA = depths.get(a.id) ?? 0;
    const depthB = depths.get(b.id) ?? 0;
    if (depthA !== depthB) {
      return depthB - depthA;
    }

    return a.title.localeCompare(b.title);
  });
}

export interface PriorityRange {
  min: Priority;
  max: Priority;
}

export interface FindReadyOptions {
  priorityFilter?: Priority | PriorityRange | undefined;
  limit?: number | undefined;
}

function matchesPriorityFilter(
  priority: Priority,
  filter: Priority | PriorityRange
): boolean {
  if (typeof filter === 'number') {
    return priority === filter;
  }
  return priority >= filter.min && priority <= filter.max;
}

/**
 * Parses a priority filter string into a Priority or PriorityRange.
 * Supports: "5" (exact), "3-7" (range)
 * Returns null for invalid input.
 */
export function parsePriorityFilter(
  input: string
): Priority | PriorityRange | null {
  const rangeMatch = input.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1] as string, 10);
    const max = parseInt(rangeMatch[2] as string, 10);
    if (!isValidPriority(min) || !isValidPriority(max) || min > max) {
      return null;
    }
    return { min, max };
  }

  const exact = parseInt(input, 10);
  if (isValidPriority(exact)) {
    return exact;
  }

  return null;
}

/**
 * Finds specs that are ready for work, optionally filtered and limited.
 * Returns specs sorted by priority (highest first), then depth (deepest first), then title,
 * along with the count of excluded parent specs.
 */
export function findReadySpecsSorted(
  specs: Spec[],
  options: FindReadyOptions = {}
): ReadySpecsResult {
  const result = findReadySpecs(specs);
  let ready = result.specs;

  if (options.priorityFilter !== undefined) {
    ready = ready.filter((s) => matchesPriorityFilter(s.priority, options.priorityFilter as Priority | PriorityRange));
  }

  const sorted = sortByPriority(ready, { allSpecs: specs });

  if (options.limit !== undefined && options.limit > 0) {
    return { specs: sorted.slice(0, options.limit), excludedParentCount: result.excludedParentCount };
  }

  return { specs: sorted, excludedParentCount: result.excludedParentCount };
}
