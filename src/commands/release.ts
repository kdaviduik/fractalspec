/**
 * sc release - Release claimed spec
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFile } from '../spec-filesystem';
import { releaseSpec, isSpecClaimed, checkClaimSafety } from '../claim-logic';

function parseForceFlag(args: string[]): { force: boolean; specId: string | undefined } {
  let force = false;
  let specId: string | undefined;

  for (const arg of args) {
    if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (!arg.startsWith('-')) {
      specId = arg;
    }
  }

  return { force, specId };
}

export const command: CommandHandler = {
  name: 'release',
  description: 'Release claimed spec',

  getHelp(): CommandHelp {
    return {
      name: 'sc release',
      synopsis: 'sc release <id> [--force]',
      description: `Abandon work on a claimed spec and make it available again. This command:
  - Checks for uncommitted changes and unpushed commits (safety check)
  - Resets the spec status to 'ready'
  - Deletes the work branch work-<slug>-<id>
  - Removes the worktree (relative to repository root, as sibling to repo)

Use this when you need to stop working on a spec without completing it.
Commands can be run from any directory in the repository.`,
      flags: [
        {
          flag: '--force, -f',
          description: 'Bypass safety checks (uncommitted changes, unpushed commits)',
        },
      ],
      examples: [
        '# Abandon work and reset spec from anywhere in repo',
        'sc release a1b2c3',
        '',
        '# Force release despite uncommitted changes',
        'sc release a1b2c3 --force',
      ],
      notes: [
        'Safety checks prevent accidental data loss by blocking release if there are uncommitted changes or unpushed commits.',
        'Use --force only when you intentionally want to discard work.',
        'Commands work from any directory in the repository.',
        'If run from inside the work worktree being removed, you will be left in a deleted directory after cleanup.',
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
      console.error(`Spec ${spec.id} is not claimed.`);
      return 1;
    }

    const safety = await checkClaimSafety(spec);

    if (!safety.safe && !force) {
      console.error(`Cannot release spec: ${safety.issues.join(', ')}`);
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
      console.error(`WARNING: Forcing release despite ${safety.issues.join(', ')}`);
      console.error('The worktree and branch will be permanently deleted.');
    }

    await releaseSpec(spec);

    console.log(`Released: ${spec.title}`);
    console.log(`  Status: ready`);

    return 0;
  },
};
