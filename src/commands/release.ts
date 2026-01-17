/**
 * sc release - Release claimed spec
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFile } from '../spec-filesystem';
import { releaseSpec, isSpecClaimed } from '../claim-logic';

export const command: CommandHandler = {
  name: 'release',
  description: 'Release claimed spec',

  getHelp(): CommandHelp {
    return {
      name: 'sc release',
      synopsis: 'sc release <id>',
      description: `Abandon work on a claimed spec and make it available again. This command:
  - Resets the spec status to 'ready'
  - Deletes the work branch work/<id>
  - Removes the worktree at ../work-<id>/

Use this when you need to stop working on a spec without completing it.`,
      examples: [
        '# Abandon work and reset spec',
        'cd ../main              # Return to main worktree first',
        'sc release a1b2c3       # Reset and cleanup',
      ],
      notes: [
        'IMPORTANT: Run this command from the main worktree (not from inside ../work-<id>) for automatic cleanup.',
        'Uncommitted work in the worktree will be lost. Commit changes to preserve them before releasing.',
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

    const claimed = await isSpecClaimed(spec.id);
    if (!claimed) {
      console.error(`Spec ${spec.id} is not claimed.`);
      return 1;
    }

    await releaseSpec(spec);

    console.log(`Released: ${spec.title}`);
    console.log(`  Status: ready`);

    return 0;
  },
};
