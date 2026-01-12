/**
 * sc list - List specs
 */

import { parseArgs } from 'util';
import type { CommandHandler } from '../types';
import { readAllSpecs } from '../spec-filesystem';
import { buildSpecTree, renderTree } from '../spec-tree';
import { findReadySpecs, getStatusSummary } from '../spec-query';

export const command: CommandHandler = {
  name: 'list',
  description: 'List specs',

  async execute(args: string[]): Promise<number> {
    const { values } = parseArgs({
      args,
      options: {
        ready: { type: 'boolean' },
        tree: { type: 'boolean' },
        status: { type: 'boolean' },
      },
      allowPositionals: false,
    });

    const specs = await readAllSpecs();

    if (specs.length === 0) {
      console.log('No specs found. Create one with: sc create');
      return 0;
    }

    if (values.status) {
      const summary = getStatusSummary(specs);
      console.log('\nSpec Status Summary');
      console.log('═══════════════════');
      console.log(`  Ready:       ${summary.ready}`);
      console.log(`  In Progress: ${summary.in_progress}`);
      console.log(`  Blocked:     ${summary.blocked}`);
      console.log(`  Closed:      ${summary.closed}`);
      console.log(`  Deferred:    ${summary.deferred}`);
      console.log(`  Not Planned: ${summary.not_planned}`);
      console.log(`  ─────────────────`);
      console.log(`  Total:       ${summary.total}`);
      return 0;
    }

    if (values.ready) {
      const ready = findReadySpecs(specs);
      if (ready.length === 0) {
        console.log('No specs ready for work.');
        return 0;
      }
      console.log('\nSpecs Ready for Work');
      console.log('════════════════════');
      for (const spec of ready) {
        console.log(`  ${spec.id}  ${spec.title}`);
      }
      return 0;
    }

    if (values.tree) {
      const tree = buildSpecTree(specs);
      console.log('\nSpec Tree');
      console.log('═════════');
      console.log(renderTree(tree));
      return 0;
    }

    console.log('\nAll Specs');
    console.log('═════════');
    for (const spec of specs) {
      const statusIcon = getStatusIcon(spec.status);
      console.log(`  ${statusIcon} ${spec.id}  ${spec.title}`);
    }

    return 0;
  },
};

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    ready: '○',
    in_progress: '◐',
    blocked: '⊘',
    closed: '●',
    deferred: '◇',
    not_planned: '✕',
  };
  return icons[status] ?? '?';
}
