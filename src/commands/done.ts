/**
 * sc done - Mark spec as complete
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFile } from '../spec-filesystem';
import { completeSpec, isSpecClaimed } from '../claim-logic';

export const command: CommandHandler = {
  name: 'done',
  description: 'Mark spec as complete',

  getHelp(): CommandHelp {
    return {
      name: 'sc done',
      synopsis: 'sc done <id>',
      description: `Mark a claimed spec as complete. This command:
  - Sets the spec status to 'closed'
  - Deletes the work branch work/<id>
  - Removes the worktree at ../work-<id>/

The spec must already be claimed (status: in_progress) before marking it done.`,
      examples: [
        '# Complete a spec',
        'cd ../main              # Return to main worktree first',
        'sc done a1b2c3          # Mark complete and cleanup',
      ],
      notes: [
        'IMPORTANT: Run this command from the main worktree (not from inside ../work-<id>) for automatic cleanup.',
        'If run from inside the work worktree, the branch will be deleted but the worktree directory will require manual removal.',
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
      console.error(`Spec ${spec.id} is not claimed. Claim it first with: sc claim ${spec.id}`);
      return 1;
    }

    await completeSpec(spec);

    console.log(`Completed: ${spec.title}`);
    console.log(`  Status: closed`);

    return 0;
  },
};
