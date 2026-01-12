/**
 * Parses spec markdown files with YAML frontmatter.
 */

import matter from 'gray-matter';
import { isValidSpecFrontmatter, type Spec } from './types';

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly filePath: string
  ) {
    super(`${message} in ${filePath}`);
    this.name = 'ParseError';
  }
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

  if (!isValidSpecFrontmatter(parsed.data)) {
    throw new ParseError('Invalid frontmatter structure or values', filePath);
  }

  const content = parsed.content.trim();
  const title = extractTitle(content);

  return {
    id: parsed.data.id,
    status: parsed.data.status,
    parent: parsed.data.parent,
    blocks: parsed.data.blocks,
    title,
    content,
    filePath,
  };
}
