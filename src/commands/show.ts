/**
 * sc show - Display spec details
 */

import type { CommandHandler } from '../types';
import { findSpecFile } from '../spec-filesystem';

export const command: CommandHandler = {
  name: 'show',
  description: 'Display spec details',

  async execute(args: string[]): Promise<number> {
    const specId = args[0];
    if (!specId) {
      console.error('Usage: sc show <id>');
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
