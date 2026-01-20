/**
 * Query and filter functions for specs.
 */

import type { Spec, Status, Priority } from './types';
import { PRIORITIES } from './types';
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
  if (spec.blocks.length === 0) {
    return false;
  }

  for (const blockerId of spec.blocks) {
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

/**
 * Priority rank for sorting (lower = higher priority).
 */
function getPriorityRank(priority: Priority): number {
  return PRIORITIES.indexOf(priority);
}

export interface SortOptions {
  allSpecs: Spec[];
}

/**
 * Sorts specs by priority (highest first), then depth (deepest first), then title alphabetically.
 * Sort order: priority (critical > high > normal > low), depth descending, title alphabetically.
 */
export function sortByPriority(specs: Spec[], options: SortOptions): Spec[] {
  const depths = computeDepths(options.allSpecs);

  return [...specs].sort((a, b) => {
    const priorityRankA = getPriorityRank(a.priority);
    const priorityRankB = getPriorityRank(b.priority);
    if (priorityRankA !== priorityRankB) {
      return priorityRankA - priorityRankB;
    }

    const depthA = depths.get(a.id) ?? 0;
    const depthB = depths.get(b.id) ?? 0;
    if (depthA !== depthB) {
      return depthB - depthA;
    }

    return a.title.localeCompare(b.title);
  });
}

export interface FindReadyOptions {
  priorityFilter?: Priority | undefined;
  limit?: number | undefined;
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

  if (options.priorityFilter) {
    ready = ready.filter((s) => s.priority === options.priorityFilter);
  }

  const sorted = sortByPriority(ready, { allSpecs: specs });

  if (options.limit !== undefined && options.limit > 0) {
    return sorted.slice(0, options.limit);
  }

  return sorted;
}
