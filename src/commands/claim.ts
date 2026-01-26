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
      synopsis: 'sc claim <id> [--cd]',
      description: `Claim a spec and prepare it for work. This command:
  - Sets the spec status to 'in_progress'
  - Creates a dedicated git worktree (sibling to repository root)
  - Creates and checks out branch work-<slug>-<id> in that worktree
  - Ensures exclusive access (git prevents same branch in multiple worktrees)

After claiming, switch to the work worktree to begin implementation.
Commands can be run from any directory in the repository.`,
      flags: [
        {
          flag: '--cd, -C',
          description:
            'Output cd command for shell evaluation. Use with eval or a wrapper function to auto-change directory after claiming.',
        },
      ],
      examples: [
        '# Claim spec and manually cd (default behavior)',
        'sc claim a1b2c3',
        'cd ../work-oauth-flow-a1b2c3',
        '',
        '# Claim and auto-cd with eval',
        'eval "$(sc claim --cd a1b2c3)"',
        '',
        '# Shell function wrapper (add to ~/.bashrc or ~/.zshrc)',
        'sccd() { local output; output=$(sc claim --cd "$@") && eval "$output"; }',
        '# Then use:',
        'sccd a1b2c3',
        '',
        '# ... do work, commit changes ...',
        'sc done a1b2c3  # Works from any directory',
      ],
      notes: [
        'The worktree is created as a sibling to the repository root.',
        'Claim and done/release commands work from any directory in the repository.',
        'With --cd: Status info goes to stderr, cd command to stdout (safe for eval).',
        'On failure with --cd: stdout is empty, preventing eval from executing garbage.',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const cdFlag = args.includes('--cd') || args.includes('-C');
    const filteredArgs = args.filter(a => a !== '--cd' && a !== '-C');

    const specId = filteredArgs[0];
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

    const worktreePath = await getWorkWorktreePath(spec.id, spec.title);

    if (cdFlag) {
      console.error(`Claimed: ${spec.title} (in_progress)`);
      const escapedPath = worktreePath.replace(/'/g, "'\\''");
      console.log(`cd '${escapedPath}'`);
    } else {
      console.log(`Claimed: ${spec.title}`);
      console.log(`  Status: in_progress`);
      console.log(`\nTo start working:`);
      console.log(`  cd ${worktreePath}`);
    }

    return 0;
  },
};
