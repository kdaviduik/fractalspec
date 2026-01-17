/**
 * sc claim - Claim spec for work
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFile } from '../spec-filesystem';
import { claimSpec } from '../claim-logic';
import { getWorkWorktreePath } from '../git-operations';

export const command: CommandHandler = {
  name: 'claim',
  description: 'Claim spec for work',

  getHelp(): CommandHelp {
    return {
      name: 'sc claim',
      synopsis: 'sc claim <id>',
      description: `Claim a spec and prepare it for work. This command:
  - Sets the spec status to 'in_progress'
  - Creates a dedicated git worktree at ../work-<id>/
  - Creates and checks out branch work/<id> in that worktree
  - Ensures exclusive access (git prevents same branch in multiple worktrees)

After claiming, switch to the work worktree to begin implementation.`,
      examples: [
        '# Claim spec and start working',
        'sc claim a1b2c3',
        'cd ../work-a1b2c3',
        '# ... do work, commit changes ...',
        'cd ../main',
        'sc done a1b2c3',
      ],
      notes: [
        'The worktree is created as a sibling directory to your main worktree.',
        'Always return to the main worktree before running "sc done" or "sc release" for automatic cleanup.',
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

    const result = await claimSpec(spec);

    if (!result.success) {
      console.error(`Failed to claim spec: ${result.error}`);
      return 1;
    }

    const worktreePath = getWorkWorktreePath(spec.id);

    console.log(`Claimed: ${spec.title}`);
    console.log(`  Status: in_progress`);
    console.log(`\nTo start working:`);
    console.log(`  cd ${worktreePath}`);

    return 0;
  },
};
