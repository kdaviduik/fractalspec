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
  blocks: string[];
  priority: Priority;
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

export interface ClaimResult {
  success: boolean;
  branchName: string;
  error?: string;
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

  if (!Array.isArray(value['blocks'])) {
    return false;
  }

  return true;
}
