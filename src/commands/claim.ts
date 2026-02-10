/**
 * sc claim - Claim spec for work
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { readAllSpecs } from '../spec-filesystem';
import { findSpecById } from '../spec-query';
import { claimSpec } from '../claim-logic';

const FLAG_TOKENS: readonly string[] = ['--cd', '-C', '--worktree', '-W', '--branch', '-B'];

export const command: CommandHandler = {
  name: 'claim',
  description: 'Claim spec for work',

  getHelp(): CommandHelp {
    return {
      name: 'sc claim',
      synopsis: 'sc claim <id> [--branch] [--worktree] [--cd]',
      description: `Claim a spec and prepare it for work. This command sets the spec status to 'in_progress'.

By default, claiming only updates the status (status-only mode). This is ideal for
working directly on your current branch without creating git artifacts.

Use --branch to create and check out a dedicated work branch (work-<slug>-<id>).
Use --worktree to create an isolated git worktree instead.

In bare repositories with --branch, worktree mode is used automatically.

Commands can be run from any directory in the repository.`,
      flags: [
        {
          flag: '--branch, -B',
          description: 'Create and check out a work branch (work-<slug>-<id>). Requires a clean working tree.',
        },
        {
          flag: '--worktree, -W',
          description: 'Create a dedicated git worktree (sibling to repository root) with a work branch.',
        },
        {
          flag: '--cd, -C',
          description:
            'Output cd command for shell evaluation (worktree mode only). Not needed with shell integration (sc init).',
        },
      ],
      examples: [
        '# Claim a spec (status-only, no branch created)',
        'sc claim a1b2c3',
        '',
        '# Claim with a dedicated work branch',
        'sc claim a1b2c3 --branch',
        '',
        '# Claim with isolated worktree',
        'sc claim a1b2c3 --worktree',
        '',
        '# With shell integration (auto-cd into worktree)',
        'eval "$(sc init bash)"   # One-time setup in ~/.bashrc',
        'sc claim a1b2c3 --worktree  # Auto-cd\'s into worktree',
        '',
        '# Without shell integration: use eval for worktree cd',
        'eval "$(sc claim --cd --worktree a1b2c3)"',
        '',
        '# ... do work, commit changes ...',
        'sc done a1b2c3  # Works from any directory',
      ],
      notes: [
        'Parent specs (specs with children) cannot be claimed. Work on their child specs instead.',
        'Status-only mode (default): only sets status to in_progress. No git artifacts created.',
        'Branch mode (--branch): requires a clean working tree. Stash or commit changes first.',
        'Worktree mode (--worktree): creates an isolated workspace as a sibling to the repository root.',
        'In bare repositories with --branch, worktree mode is used automatically.',
        'With --cd (worktree mode): Status info goes to stderr, cd command to stdout (safe for eval).',
        'On failure with --cd: stdout is empty, preventing eval from executing garbage.',
        'Set up sc init for automatic cd on every claim in worktree mode. See: sc init --help',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const cdFlag = args.includes('--cd') || args.includes('-C');
    const worktreeFlag = args.includes('--worktree') || args.includes('-W');
    const branchFlag = args.includes('--branch') || args.includes('-B');
    const filteredArgs = args.filter(a => !FLAG_TOKENS.includes(a));

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

    const result = await claimSpec(spec, { useBranch: branchFlag, useWorktree: worktreeFlag });

    if (!result.success) {
      console.error(`Failed to claim spec: ${result.error}`);
      return 1;
    }

    switch (result.mode) {
      case 'worktree':
        return printWorktreeSuccess(spec.title, result.worktreePath, cdFlag);
      case 'branch':
        return printBranchSuccess(spec.title, result.branchName, cdFlag);
      case 'status_only':
        return printStatusOnlySuccess(spec.title, cdFlag);
    }
  },
};

function printWorktreeSuccess(title: string, worktreePath: string, cdFlag: boolean): number {
  if (cdFlag) {
    console.error(`Claimed: ${title} (in_progress)`);
    const escapedPath = worktreePath.replace(/'/g, "'\\''");
    console.log(`cd '${escapedPath}'`);
  } else {
    console.log(`Claimed: ${title}`);
    console.log(`  Status: in_progress`);
    console.log(`  Worktree: ${worktreePath}`);
    console.log(`\nTo start working:`);
    console.log(`  cd ${worktreePath}`);
    console.log(`\nTip: Set up shell integration to auto-cd on claim. See: sc init --help`);
  }
  return 0;
}

function printBranchSuccess(title: string, branchName: string, cdFlag: boolean): number {
  if (cdFlag) {
    console.error(`Claimed: ${title} (in_progress)`);
  } else {
    console.log(`Claimed: ${title}`);
    console.log(`  Status: in_progress`);
    console.log(`  Branch: ${branchName}`);
  }
  return 0;
}

function printStatusOnlySuccess(title: string, cdFlag: boolean): number {
  if (cdFlag) {
    console.error(`Claimed: ${title} (in_progress)`);
  } else {
    console.log(`Claimed: ${title}`);
    console.log(`  Status: in_progress`);
  }
  return 0;
}
