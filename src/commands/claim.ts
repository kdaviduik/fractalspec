/**
 * sc claim - Claim spec for work
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { readAllSpecs } from '../spec-filesystem';
import { findSpecById } from '../spec-query';
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
            'Output cd command for shell evaluation. Not needed with shell integration (sc init).',
        },
      ],
      examples: [
        '# Recommended: set up shell integration (one-time)',
        'eval "$(sc init bash)"   # Add to ~/.bashrc',
        'eval "$(sc init zsh)"    # Add to ~/.zshrc',
        '',
        '# Then claiming auto-cd\'s into the worktree',
        'sc claim a1b2c3',
        '',
        '# Without shell integration: use eval',
        'eval "$(sc claim --cd a1b2c3)"',
        '',
        '# ... do work, commit changes ...',
        'sc done a1b2c3  # Works from any directory',
      ],
      notes: [
        'Parent specs (specs with children) cannot be claimed. Work on their child specs instead.',
        'The worktree is created as a sibling to the repository root.',
        'Claim and done/release commands work from any directory in the repository.',
        'With --cd: Status info goes to stderr, cd command to stdout (safe for eval).',
        'On failure with --cd: stdout is empty, preventing eval from executing garbage.',
        'Set up sc init for automatic cd on every claim. See: sc init --help',
        'With shell integration active, bypass auto-cd with: command sc claim <id>',
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

    const allSpecs = await readAllSpecs();
    const spec = findSpecById(allSpecs, specId);
    if (!spec) {
      console.error(`Spec not found: ${specId}`);
      return 1;
    }

    if (allSpecs.some(s => s.parent === spec.id)) {
      console.error(`Cannot claim "${spec.title}": it has child specs and is not directly actionable.`);
      console.error('Work on its child specs instead. See: sc list --tree');
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
      console.log(`\nTip: Set up shell integration to auto-cd on claim. See: sc init --help`);
    }

    return 0;
  },
};
