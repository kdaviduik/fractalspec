/**
 * sc list - List specs
 */

import { parseArgs } from 'util';
import type { CommandHandler, Spec } from '../types';
import { MIN_PRIORITY, MAX_PRIORITY, DEFAULT_PRIORITY, getStatusIcon } from '../types';
import type { CommandHelp } from '../help.js';
import { isNoColorSet } from '../help.js';
import { readAllSpecs } from '../spec-filesystem';
import { buildSpecTree, renderTree } from '../spec-tree';
import { findReadySpecsSorted, getStatusSummary, parsePriorityFilter } from '../spec-query';
import { getWorkBranchName, findWorktreeByBranch, branchExists } from '../git-operations';

export const command: CommandHandler = {
  name: 'list',
  description: 'List specs',

  getHelp(): CommandHelp {
    return {
      name: 'sc list',
      synopsis: 'sc list [--ready] [--flat] [--tree] [--status] [--limit <n>] [--priority <level>]',
      description: `List specs in various formats. By default, shows a hierarchical tree view with effective status.

Parent specs display their "effective status" derived from children:
  - All children closed → parent shows closed
  - Any child in_progress → parent shows in_progress
  - Some closed + some ready → parent shows in_progress (partial completion)
  - Any child ready → parent shows ready

Status indicators:
  ready (○)       - No blockers, available for work
  in_progress (◐) - Currently being worked on
  blocked (⊘)     - Waiting on dependencies
  closed (●)      - Complete
  deferred (◇)    - Postponed
  not_planned (✕) - Will not implement

Priority: numeric ${MIN_PRIORITY}-${MAX_PRIORITY} (higher = more urgent, ${MAX_PRIORITY} is highest priority)

Accessibility: Set NO_COLOR=1 for ASCII tree characters without icons (recommended for screen readers).`,
      flags: [
        {
          flag: '--ready',
          description: 'Show only leaf specs available for work. Includes blocked specs whose blockers are all resolved. Parent specs (those with children) are excluded. Sorted by priority, then depth (deepest first), then title.',
        },
        {
          flag: '--flat',
          description: 'Display flat list with stored status (not derived). Recommended for screen reader users.',
        },
        {
          flag: '--tree',
          description: 'Display hierarchical tree view (default). Children sorted by priority (highest first), then alphabetically.',
        },
        {
          flag: '--status',
          description: 'Show status count summary across all specs',
        },
        {
          flag: '--limit <n>',
          description: 'Limit output to top N specs (requires --ready). Use --limit 1 for "next task" behavior.',
        },
        {
          flag: '--priority <n or n-m>',
          description: `Filter by priority (requires --ready). Accepts single value (e.g., 8) or range (e.g., 8-10).`,
        },
      ],
      examples: [
        '# See spec hierarchy (default view)',
        'sc list',
        '',
        '# Flat list with stored status values',
        'sc list --flat',
        '',
        '# Find available work (sorted by priority)',
        'sc list --ready',
        '',
        '# Get THE next task to work on',
        'sc list --ready --limit 1',
        '',
        '# Get top 5 highest priority ready specs',
        'sc list --ready --limit 5',
        '',
        '# Show only highest-priority ready specs (8-10)',
        'sc list --ready --priority 8-10',
        '',
        '# Check overall project health',
        'sc list --status',
        '',
        '# Accessible mode (screen readers)',
        'NO_COLOR=1 sc list',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const { values } = parseArgs({
      args,
      options: {
        ready: { type: 'boolean' },
        flat: { type: 'boolean' },
        tree: { type: 'boolean' },
        status: { type: 'boolean' },
        limit: { type: 'string' },
        priority: { type: 'string' },
      },
      allowPositionals: false,
    });

    const { specs, failures } = await readAllSpecs();

    if (specs.length === 0 && failures.length === 0) {
      console.log('No specs found. Create one with: sc create');
      return 0;
    }

    if (values.limit !== undefined || values.priority !== undefined) {
      if (!values.ready) {
        console.error('Error: --limit and --priority require --ready flag');
        return 1;
      }
    }

    let exitCode: number;
    if (values.status) {
      exitCode = printStatusSummary(specs);
    } else if (values.ready) {
      exitCode = printReadySpecs(specs, values.limit, values.priority);
    } else if (values.flat) {
      // Flat view shows stored status (not derived)
      exitCode = await printAllSpecs(specs);
    } else {
      // Tree is now the default view (--tree kept for backward compatibility)
      exitCode = printTreeView(specs);
    }

    if (failures.length > 0) {
      const specWord = failures.length === 1 ? 'file' : 'files';
      console.log(`\nWarning: ${failures.length} spec ${specWord} failed to parse and are hidden. Run 'sc doctor' for details.`);
    }

    return exitCode;
  },
};

function printStatusSummary(specs: Spec[]): number {
  const summary = getStatusSummary(specs);
  const accessible = isNoColorSet();
  const headerLine = accessible ? '-------------------' : '═══════════════════';
  const dividerLine = accessible ? '-----------------' : '─────────────────';

  console.log('\nSpec Status Summary');
  console.log(headerLine);
  console.log(`  Ready:       ${summary.ready}`);
  console.log(`  In Progress: ${summary.in_progress}`);
  console.log(`  Blocked:     ${summary.blocked}`);
  console.log(`  Closed:      ${summary.closed}`);
  console.log(`  Deferred:    ${summary.deferred}`);
  console.log(`  Not Planned: ${summary.not_planned}`);
  console.log(`  ${dividerLine}`);
  console.log(`  Total:       ${summary.total}`);
  return 0;
}

function parseLimit(limitStr: string | undefined): number | undefined {
  if (limitStr === undefined) {
    return undefined;
  }
  const parsed = parseInt(limitStr, 10);
  if (isNaN(parsed) || parsed < 1) {
    return undefined;
  }
  return parsed;
}

function printReadySpecs(
  specs: Spec[],
  limitStr: string | undefined,
  priorityStr: string | undefined
): number {
  const limitValue = limitStr !== undefined ? parseLimit(limitStr) : undefined;

  if (limitStr !== undefined && limitValue === undefined) {
    console.error('Error: --limit must be a positive integer');
    return 1;
  }

  const priorityFilter =
    priorityStr !== undefined ? parsePriorityFilter(priorityStr) : undefined;

  if (priorityStr !== undefined && priorityFilter === null) {
    console.error(`Error: "${priorityStr}" is not a valid priority filter`);
    console.error(`Use a number (${MIN_PRIORITY}-${MAX_PRIORITY}) or range (e.g., 8-10)`);
    return 1;
  }

  const result = findReadySpecsSorted(specs, {
    limit: limitValue,
    priorityFilter: priorityFilter ?? undefined,
  });

  if (result.specs.length === 0) {
    const filterMsg = priorityStr !== undefined ? ` with priority "${priorityStr}"` : '';
    console.log(`No specs ready for work${filterMsg}.`);
    return 0;
  }

  const accessible = isNoColorSet();
  const headerLine = accessible ? '====================' : '════════════════════';
  const limitMsg = limitValue !== undefined ? ` (top ${limitValue})` : '';
  const priorityMsg = priorityStr !== undefined ? ` [priority ${priorityStr}]` : '';
  console.log(`\nSpecs Ready for Work${limitMsg}${priorityMsg}`);
  console.log(headerLine);
  for (const spec of result.specs) {
    const priorityIndicator = spec.priority !== DEFAULT_PRIORITY ? ` [P${spec.priority}]` : '';
    console.log(`  ${spec.id}  ${spec.title}${priorityIndicator}`);
  }

  if (result.excludedParentCount > 0) {
    const specWord = result.excludedParentCount === 1 ? 'spec' : 'specs';
    console.log(`\n${result.excludedParentCount} parent ${specWord} excluded — use --tree to see all`);
  }

  return 0;
}

function printTreeView(specs: Spec[]): number {
  const tree = buildSpecTree(specs);
  const accessible = isNoColorSet();
  const headerLine = accessible ? '=========' : '═════════';
  console.log('\nSpec Tree');
  console.log(headerLine);
  console.log(renderTree(tree, specs));
  return 0;
}

async function printAllSpecs(specs: Spec[]): Promise<number> {
  const accessible = isNoColorSet();
  const headerLine = accessible ? '=========' : '═════════';
  console.log('\nAll Specs');
  console.log(headerLine);
  for (const spec of specs) {
    const icon = accessible ? '' : `${getStatusIcon(spec.status)} `;
    let suffix = '';
    if (spec.status === 'in_progress') {
      const branchName = getWorkBranchName(spec.id, spec.title);
      const worktree = await findWorktreeByBranch(branchName);
      if (worktree) {
        suffix = ` [${worktree.path}]`;
      } else if (await branchExists(branchName)) {
        suffix = ` [branch: ${branchName}]`;
      }
    }
    console.log(`  ${icon}${spec.status.padEnd(11)} ${spec.id}  ${spec.title}${suffix}`);
  }
  return 0;
}
