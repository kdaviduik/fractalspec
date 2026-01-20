/**
 * Serializes Spec objects back to markdown with YAML frontmatter.
 */

import type { Spec } from './types';

function serializeBlocks(blocks: string[]): string {
  if (blocks.length === 0) {
    return '[]';
  }

  const items = blocks.map((block) => `  - ${block}`).join('\n');
  return `\n${items}`;
}

export function serializeSpec(spec: Spec): string {
  const blocksValue = serializeBlocks(spec.blocks);
  const parentValue = spec.parent === null ? 'null' : spec.parent;

  const frontmatter = [
    '---',
    `id: ${spec.id}`,
    `status: ${spec.status}`,
    `parent: ${parentValue}`,
    `blocks: ${blocksValue}`,
    `priority: ${spec.priority}`,
    '---',
  ].join('\n');

  return `${frontmatter}\n\n${spec.content}\n`;
}
