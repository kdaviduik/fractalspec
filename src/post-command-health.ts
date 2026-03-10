/**
 * Inline post-command health checks.
 * Surfaces unfilled boilerplate sections after mutating commands (create, set)
 * so LLMs and humans immediately know what's missing.
 */

import { findBoilerplateSections, getSectionFlag } from './markdown-sections';

const MAX_INLINE_FLAGS = 3;

/** Returns unfilled section info, or null if the spec is healthy. */
export function getUnfilledSections(specId: string, content: string): {
  sections: string[];
  suggestion: string;
} | null {
  const sections = findBoilerplateSections(content);
  if (sections.length === 0) return null;

  const suggestion = sections.length > MAX_INLINE_FLAGS
    ? `sc edit ${specId}`
    : buildSetSuggestion(specId, sections);

  return { sections, suggestion };
}

function buildSetSuggestion(specId: string, sections: string[]): string {
  const flags = sections
    .map(name => {
      const flag = getSectionFlag(name);
      return flag !== undefined ? `--${flag} "..."` : null;
    })
    .filter((f): f is string => f !== null)
    .join(' ');
  return `sc set ${specId} ${flags}`;
}

/** Prints inline health warning. No output when spec is healthy. */
export function printPostCommandHealth(specId: string, content: string): void {
  const result = getUnfilledSections(specId, content);
  if (result === null) return;

  console.log(`\u26A0 Spec ${specId} is currently incomplete. Unfilled sections: ${result.sections.join(', ')}`);
  console.log(`  Fill these sections directly, or use: ${result.suggestion}`);
}
