/**
 * sc done - Mark spec as complete
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFile } from '../spec-filesystem';
import { completeSpec, isSpecClaimed, checkClaimSafety } from '../claim-logic';
import { parseForceFlag } from '../flag-utils';

export const command: CommandHandler = {
  name: 'done',
  description: 'Mark spec as complete',

  getHelp(): CommandHelp {
    return {
      name: 'sc done',
      synopsis: 'sc done <id> [--force]',
      description: `Mark a claimed spec as complete. This command:
  - Checks for uncommitted changes and unpushed commits (safety check)
  - Sets the spec status to 'closed'
  - Removes the work branch (and worktree if one exists)

The spec must already be claimed (status: in_progress) before marking it done.
Commands can be run from any directory in the repository.`,
      flags: [
        {
          flag: '--force, -f',
          description: 'Bypass safety checks (uncommitted changes, unpushed commits)',
        },
      ],
      examples: [
        '# Complete a spec from anywhere in repo',
        'sc done a1b2c3',
        '',
        '# Force completion despite uncommitted changes',
        'sc done a1b2c3 --force',
      ],
      notes: [
        'Safety checks prevent accidental data loss by blocking completion if there are uncommitted changes or unpushed commits.',
        'Use --force only when you intentionally want to discard work.',
        'Commands work from any directory in the repository.',
        'If a worktree was used and you run this from inside it, you will be left in a deleted directory after cleanup.',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const { force, specId } = parseForceFlag(args);

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
      console.error(`Spec ${spec.id} is not claimed. Claim it first with: sc claim ${spec.id}`);
      return 1;
    }

    const safety = await checkClaimSafety(spec);

    if (!safety.safe && !force) {
      console.error(`Cannot complete spec: ${safety.issues.join(', ')}`);
      console.error('');
      console.error('To resolve:');
      if (safety.issues.includes('uncommitted changes')) {
        console.error(`  cd ${safety.worktreePath}`);
        console.error('  git add . && git commit -m "your message"');
      }
      if (safety.issues.includes('unpushed commits')) {
        console.error(`  cd ${safety.worktreePath}`);
        console.error(`  git push -u origin ${safety.branchName}`);
      }
      if (safety.issues.includes('detached HEAD state')) {
        console.error(`  cd ${safety.worktreePath}`);
        console.error('  # First, save any commits you made while detached:');
        console.error(`  git branch temp-save-${spec.id}`);
        console.error('  # Then checkout the work branch:');
        console.error(`  git checkout ${safety.branchName}`);
        console.error('  # If needed, cherry-pick commits from temp-save branch');
      }
      console.error('');
      console.error('Or use --force to bypass (WARNING: may lose work)');
      return 1;
    }

    if (!safety.safe && force) {
      console.error(`WARNING: Forcing completion despite ${safety.issues.join(', ')}`);
      console.error('The branch (and worktree if present) will be permanently deleted.');
    }

    await completeSpec(spec, force);

    console.log(`Completed: ${spec.title}`);
    console.log(`  Status: closed`);

    return 0;
  },
};
