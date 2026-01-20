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
  - Deletes the work branch work-<slug>-<id>
  - Removes the worktree (relative to repository root, as sibling to repo)

Use this when you need to stop working on a spec without completing it.
Commands can be run from any directory in the repository.`,
      examples: [
        '# Abandon work and reset spec from anywhere in repo',
        'sc release a1b2c3',
      ],
      notes: [
        'Commands work from any directory in the repository.',
        'Uncommitted work in the worktree will be lost. Commit changes to preserve them before releasing.',
        'If run from inside the work worktree being removed, you will be left in a deleted directory after cleanup.',
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

    const claimed = await isSpecClaimed(spec);
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
