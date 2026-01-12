/**
 * Query and filter functions for specs.
 */

import type { Spec, Status } from './types';

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
