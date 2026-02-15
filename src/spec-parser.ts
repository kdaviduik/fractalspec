/**
 * Parses spec markdown files with YAML frontmatter.
 */

import matter from 'gray-matter';
import { validateSpecFrontmatter, isValidStatus, isValidPriority, DEFAULT_PRIORITY, type Spec, type Priority } from './types';

// Force YAML-only parsing to prevent RCE via gray-matter's JavaScript engine
function rejectJavaScriptEngine(): object {
  throw new Error('JavaScript frontmatter engine is disabled for security');
}
const GRAY_MATTER_OPTIONS = {
  language: 'yaml' as const,
  engines: { javascript: rejectJavaScriptEngine },
};

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly field?: string,
    public readonly actualValue?: string
  ) {
    super(`${message} in ${filePath}`);
    this.name = 'ParseError';
  }
}

/**
 * Safely extracts blockedBy array from frontmatter data.
 * Supports migration from deprecated 'blocks' field name.
 */
function extractBlockedBy(data: Record<string, unknown>): string[] {
  const raw = data['blockedBy'] ?? data['blocks'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is string => typeof item === 'string');
}

function extractTitle(content: string): string {
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#')) {
      continue;
    }

    const headingMatch = trimmed.match(/^#\s+(?:Spec:\s*)?(.+)$/);
    if (headingMatch !== null && headingMatch[1] !== undefined) {
      return headingMatch[1].trim();
    }
  }

  return 'Untitled';
}

export function parseSpec(filePath: string, rawContent: string): Spec {
  const parsed = matter(rawContent, GRAY_MATTER_OPTIONS);

  if (Object.keys(parsed.data).length === 0) {
    throw new ParseError('Missing YAML frontmatter', filePath);
  }

  // Migration support: accept both 'blocks' (deprecated) and 'blockedBy' (current)
  // Read blockedBy first, fall back to blocks for backward compatibility
  const blockedBy = extractBlockedBy(parsed.data);

  // Build a normalized data object for validation
  const normalizedData = {
    ...parsed.data,
    blockedBy,
  };

  const validationErrors = validateSpecFrontmatter(normalizedData);
  const firstError = validationErrors[0];
  if (firstError !== undefined) {
    throw new ParseError(
      `Invalid "${firstError.field}": ${firstError.message} (got "${firstError.actualValue}")`,
      filePath,
      firstError.field,
      firstError.actualValue
    );
  }

  const content = parsed.content.trim();
  const title = extractTitle(content);

  const rawPriority: unknown = parsed.data['priority'];
  const priority: Priority = isValidPriority(rawPriority) ? rawPriority : DEFAULT_PRIORITY;

  const rawPr: unknown = parsed.data['pr'];
  const pr: string | null = typeof rawPr === 'string' ? rawPr : null;

  const rawId: unknown = parsed.data['id'];
  const rawParent: unknown = parsed.data['parent'];

  return {
    id: String(rawId),
    status: isValidStatus(parsed.data['status']) ? parsed.data['status'] : 'ready',
    parent: rawParent === null ? null : String(rawParent),
    blockedBy,
    priority,
    pr,
    title,
    content,
    filePath,
  };
}
