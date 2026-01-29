/**
 * Query and filter functions for specs.
 */

import type { Spec, Status, Priority } from './types';
import { MIN_PRIORITY, MAX_PRIORITY, isValidPriority } from './types';
import { computeDepths } from './spec-tree';

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

export function filterByStatus(specs: Spec[], status: Status): Spec[] {
  return specs.filter((s) => s.status === status);
}

const COMPLETED_STATUSES: Status[] = ['closed', 'deferred', 'not_planned'];

function isBlocked(spec: Spec, allSpecs: Spec[]): boolean {
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

export function findReadySpecs(specs: Spec[]): Spec[] {
  return specs.filter((spec) => {
    if (spec.status !== 'ready') {
      return false;
    }
    return !isBlocked(spec, specs);
  });
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
 * Returns specs sorted by priority (highest first), then depth (deepest first), then title.
 */
export function findReadySpecsSorted(
  specs: Spec[],
  options: FindReadyOptions = {}
): Spec[] {
  let ready = findReadySpecs(specs);

  if (options.priorityFilter !== undefined) {
    ready = ready.filter((s) => matchesPriorityFilter(s.priority, options.priorityFilter as Priority | PriorityRange));
  }

  const sorted = sortByPriority(ready, { allSpecs: specs });

  if (options.limit !== undefined && options.limit > 0) {
    return sorted.slice(0, options.limit);
  }

  return sorted;
}
