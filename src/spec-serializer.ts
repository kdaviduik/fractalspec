/**
 * Serializes Spec objects back to markdown with YAML frontmatter.
 */

import type { Spec } from './types';

function serializeBlockedBy(blockedBy: string[]): string {
  if (blockedBy.length === 0) {
    return '[]';
  }

  const items = blockedBy.map((id) => `  - ${id}`).join('\n');
  return `\n${items}`;
}

export function serializeSpec(spec: Spec): string {
  const blockedByValue = serializeBlockedBy(spec.blockedBy);
  const parentValue = spec.parent === null ? 'null' : spec.parent;
  const prValue = spec.pr === null ? 'null' : spec.pr;

  const frontmatter = [
    '---',
    `id: ${spec.id}`,
    `status: ${spec.status}`,
    `parent: ${parentValue}`,
    `blockedBy: ${blockedByValue}`,
    `priority: ${spec.priority}`,
    `pr: ${prValue}`,
    '---',
  ].join('\n');

  return `${frontmatter}\n\n${spec.content}\n`;
}
