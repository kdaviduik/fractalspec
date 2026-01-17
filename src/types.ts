/**
 * Core type definitions for the sc CLI tool.
 * Defines spec statuses, EARS patterns, and document structures.
 */

export const STATUSES = [
  'ready',
  'in_progress',
  'blocked',
  'closed',
  'deferred',
  'not_planned',
] as const;

export type Status = (typeof STATUSES)[number];

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
}

export interface ClaimResult {
  success: boolean;
  branchName: string;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  pattern?: EarsPattern;
  errors: string[];
  suggestions: string[];
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
