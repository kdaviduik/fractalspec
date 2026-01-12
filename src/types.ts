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

export function isValidStatus(value: unknown): value is Status {
  if (typeof value !== 'string') {
    return false;
  }
  return STATUSES.includes(value as Status);
}

export function isValidEarsPattern(value: unknown): value is EarsPattern {
  if (typeof value !== 'string') {
    return false;
  }
  return EARS_PATTERNS.includes(value as EarsPattern);
}

export function isValidSpecFrontmatter(value: unknown): value is SpecFrontmatter {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj['id'] !== 'string' || obj['id'] === '') {
    return false;
  }

  if (!isValidStatus(obj['status'])) {
    return false;
  }

  if (obj['parent'] !== null && typeof obj['parent'] !== 'string') {
    return false;
  }

  if (!Array.isArray(obj['blocks'])) {
    return false;
  }

  return true;
}
