/**
 * Core type definitions for the sc CLI tool.
 * Defines spec statuses, EARS patterns, and document structures.
 */

import type { CommandHelp } from './help.js';

export const STATUSES = [
  'ready',
  'in_progress',
  'blocked',
  'closed',
  'deferred',
  'not_planned',
] as const;

export type Status = (typeof STATUSES)[number];

// Numeric priority system (1-10, where 10 = highest priority)
export const MIN_PRIORITY = 1;
export const MAX_PRIORITY = 10;
export const DEFAULT_PRIORITY = 5;

export type Priority = number;

export const COMPLETED_STATUSES: readonly Status[] = ['closed', 'deferred', 'not_planned'] as const;

const STATUS_ICONS = {
  ready: '○',
  in_progress: '◐',
  blocked: '⊘',
  closed: '●',
  deferred: '◇',
  not_planned: '✕',
} satisfies Record<Status, string>;

export function getStatusIcon(status: Status): string {
  return STATUS_ICONS[status];
}

export const EARS_PATTERNS = [
  'ubiquitous',
  'state_driven',
  'event_driven',
  'optional',
  'unwanted',
  'complex',
] as const;

export type EarsPattern = (typeof EARS_PATTERNS)[number];

export interface SpecFrontmatter {
  id: string;
  status: Status;
  parent: string | null;
  blockedBy: string[];
  priority: Priority;
  pr: string | null;
}

export interface Spec extends SpecFrontmatter {
  title: string;
  content: string;
  filePath: string;
}

export interface SpecNode {
  spec: Spec;
  children: SpecNode[];
}

export interface CommandHandler {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<number>;
  getHelp?: () => CommandHelp;
}

export type ClaimMode = 'status_only' | 'branch' | 'worktree';

export type ClaimResult = ClaimSuccess | ClaimFailure;

export type ClaimSuccess =
  | { success: true; mode: 'status_only'; branchName: string }
  | { success: true; mode: 'branch'; branchName: string }
  | { success: true; mode: 'worktree'; branchName: string; worktreePath: string };

export type ClaimFailure = {
  success: false;
  mode: ClaimMode;
  branchName: string;
  error: string;
};

export interface ClaimOptions {
  useBranch?: boolean;
  useWorktree?: boolean;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  pattern?: EarsPattern;
  issues: ValidationIssue[];
}

function isInArray<T extends readonly unknown[]>(
  array: T,
  value: unknown
): value is T[number] {
  return array.includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

export function isValidStatus(value: unknown): value is Status {
  if (typeof value !== 'string') {
    return false;
  }
  return isInArray(STATUSES, value);
}

export function isValidEarsPattern(value: unknown): value is EarsPattern {
  if (typeof value !== 'string') {
    return false;
  }
  return isInArray(EARS_PATTERNS, value);
}

export function isValidPriority(value: unknown): value is Priority {
  if (typeof value !== 'number') {
    return false;
  }
  return Number.isInteger(value) && value >= MIN_PRIORITY && value <= MAX_PRIORITY;
}

export function isValidSpecFrontmatter(value: unknown): value is SpecFrontmatter {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value['id'] !== 'string' || value['id'] === '') {
    return false;
  }

  if (!isValidStatus(value['status'])) {
    return false;
  }

  if (value['parent'] !== null && typeof value['parent'] !== 'string') {
    return false;
  }

  if (!Array.isArray(value['blockedBy'])) {
    return false;
  }

  if (value['priority'] !== undefined && !isValidPriority(value['priority'])) {
    return false;
  }

  return true;
}
