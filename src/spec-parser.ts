/**
 * Parses spec markdown files with YAML frontmatter.
 */

import matter from 'gray-matter';
import { isValidSpecFrontmatter, isValidPriority, DEFAULT_PRIORITY, type Spec, type Priority } from './types';

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string
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
    if (headingMatch?.[1]) {
      return headingMatch[1].trim();
    }
  }

  return 'Untitled';
}

export function parseSpec(filePath: string, rawContent: string): Spec {
  const parsed = matter(rawContent);

  if (!parsed.data || Object.keys(parsed.data).length === 0) {
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

  if (!isValidSpecFrontmatter(normalizedData)) {
    throw new ParseError('Invalid frontmatter structure or values', filePath);
  }

  const content = parsed.content.trim();
  const title = extractTitle(content);

  const rawPriority = parsed.data['priority'];
  const priority: Priority = isValidPriority(rawPriority) ? rawPriority : DEFAULT_PRIORITY;

  const rawPr = parsed.data['pr'];
  const pr: string | null = typeof rawPr === 'string' ? rawPr : null;

  return {
    id: normalizedData.id,
    status: normalizedData.status,
    parent: normalizedData.parent,
    blockedBy: normalizedData.blockedBy,
    priority,
    pr,
    title,
    content,
    filePath,
  };
}
