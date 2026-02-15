/**
 * sc show - Display spec details
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFileWithFailures } from '../spec-filesystem';

export const command: CommandHandler = {
  name: 'show',
  description: 'Display spec details',

  getHelp(): CommandHelp {
    return {
      name: 'sc show',
      synopsis: 'sc show <id>',
      description: `Display full details for a spec including metadata and content.

Shows:
  - ID, title, status, priority
  - Parent spec (if any)
  - Blockers (specs this spec depends on)
  - PR URL (if set)
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
    if (specId === undefined) {
      printCommandUsage(this.getHelp!());
      return 1;
    }

    const { spec, failures } = await findSpecFileWithFailures(specId);
    if (spec === null) {
      const matchingFailure = failures.find(f => f.filePath.includes(specId));
      if (matchingFailure) {
        console.error(`Spec file found but failed to parse: ${matchingFailure.filePath}`);
        console.error(`Error: ${matchingFailure.error}`);
        console.error(`Run 'sc doctor --fix' to attempt auto-repair.`);
      } else {
        console.error(`Spec not found: ${specId}`);
      }
      return 1;
    }

    console.log(`\n${spec.title}`);
    console.log('═'.repeat(spec.title.length));
    console.log(`ID:       ${spec.id}`);
    console.log(`Status:   ${spec.status}`);
    console.log(`Priority: ${spec.priority}`);
    console.log(`Parent:   ${spec.parent ?? '(root)'}`);
    console.log(`Blocked by: ${spec.blockedBy.length > 0 ? spec.blockedBy.join(', ') : '(none)'}`);
    console.log(`PR:         ${spec.pr ?? '(none)'}`);
    console.log(`Path:       ${spec.filePath}`);
    console.log('\n--- Content ---\n');
    console.log(spec.content);

    return 0;
  },
};
