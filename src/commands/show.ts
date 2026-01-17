/**
 * sc show - Display spec details
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFile } from '../spec-filesystem';

export const command: CommandHandler = {
  name: 'show',
  description: 'Display spec details',

  getHelp(): CommandHelp {
    return {
      name: 'sc show',
      synopsis: 'sc show <id>',
      description: `Display full details for a spec including metadata and content.

Shows:
  - ID, title, status
  - Parent spec (if any)
  - Blockers (specs this spec depends on)
  - File path
  - Full markdown content`,
      examples: [
        '# View spec details',
        'sc show a1b2c3',
        '',
        '# Works with partial IDs',
        'sc show a1b',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const specId = args[0];
    if (!specId) {
      printCommandUsage(this.getHelp!());
      return 1;
    }

    const spec = await findSpecFile(specId);
    if (!spec) {
      console.error(`Spec not found: ${specId}`);
      return 1;
    }

    console.log(`\n${spec.title}`);
    console.log('═'.repeat(spec.title.length));
    console.log(`ID:     ${spec.id}`);
    console.log(`Status: ${spec.status}`);
    console.log(`Parent: ${spec.parent ?? '(root)'}`);
    console.log(`Blocks: ${spec.blocks.length > 0 ? spec.blocks.join(', ') : '(none)'}`);
    console.log(`Path:   ${spec.filePath}`);
    console.log('\n--- Content ---\n');
    console.log(spec.content);

    return 0;
  },
};
