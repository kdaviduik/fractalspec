/**
 * sc list - List specs
 */

import { parseArgs } from 'util';
import type { CommandHandler, Spec } from '../types';
import { MIN_PRIORITY, MAX_PRIORITY, DEFAULT_PRIORITY } from '../types';
import type { CommandHelp } from '../help.js';
import { readAllSpecs } from '../spec-filesystem';
import { buildSpecTree, renderTree } from '../spec-tree';
import { findReadySpecsSorted, getStatusSummary, parsePriorityFilter } from '../spec-query';
import { getWorkWorktreePath } from '../git-operations';

export const command: CommandHandler = {
  name: 'list',
  description: 'List specs',

  getHelp(): CommandHelp {
    return {
      name: 'sc list',
      synopsis: 'sc list [--ready] [--tree] [--status] [--limit <n>] [--priority <level>]',
      description: `List specs in various formats. By default, shows all specs with status icons.

Status icons:
  ○  ready       - No blockers, available for work
  ◐  in_progress - Currently being worked on
  ⊘  blocked     - Waiting on dependencies
  ●  closed      - Complete
  ◇  deferred    - Postponed
  ✕  not_planned - Will not implement

Priority: numeric ${MIN_PRIORITY}-${MAX_PRIORITY} (higher = more urgent, ${MAX_PRIORITY} is highest priority)`,
      flags: [
        {
          flag: '--ready',
          description: 'Show only leaf specs available for work. Parent specs (those with children) are excluded. Sorted by priority, then depth (deepest first), then title.',
        },
        {
          flag: '--tree',
          description: 'Display hierarchical tree view showing parent-child relationships',
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
        '# See all specs with status icons',
        'sc list',
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
        '# Understand hierarchy',
        'sc list --tree',
        '',
        '# Check overall project health',
        'sc list --status',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const { values } = parseArgs({
      args,
      options: {
        ready: { type: 'boolean' },
        tree: { type: 'boolean' },
        status: { type: 'boolean' },
        limit: { type: 'string' },
        priority: { type: 'string' },
      },
      allowPositionals: false,
    });

    const specs = await readAllSpecs();

    if (specs.length === 0) {
      console.log('No specs found. Create one with: sc create');
      return 0;
    }

    if (values.status) {
      return printStatusSummary(specs);
    }

    if (values.ready) {
      return printReadySpecs(specs, values.limit, values.priority);
    }

    if (values.limit !== undefined || values.priority !== undefined) {
      console.error('Error: --limit and --priority require --ready flag');
      return 1;
    }

    if (values.tree) {
      return printTreeView(specs);
    }

    return printAllSpecs(specs);
  },
};

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    ready: '○',
    in_progress: '◐',
    blocked: '⊘',
    closed: '●',
    deferred: '◇',
    not_planned: '✕',
  };
  return icons[status] ?? '?';
}

function printStatusSummary(specs: Spec[]): number {
  const summary = getStatusSummary(specs);
  console.log('\nSpec Status Summary');
  console.log('═══════════════════');
  console.log(`  Ready:       ${summary.ready}`);
  console.log(`  In Progress: ${summary.in_progress}`);
  console.log(`  Blocked:     ${summary.blocked}`);
  console.log(`  Closed:      ${summary.closed}`);
  console.log(`  Deferred:    ${summary.deferred}`);
  console.log(`  Not Planned: ${summary.not_planned}`);
  console.log(`  ─────────────────`);
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
    const filterMsg = priorityStr ? ` with priority "${priorityStr}"` : '';
    console.log(`No specs ready for work${filterMsg}.`);
    return 0;
  }

  const limitMsg = limitValue ? ` (top ${limitValue})` : '';
  const priorityMsg = priorityStr ? ` [priority ${priorityStr}]` : '';
  console.log(`\nSpecs Ready for Work${limitMsg}${priorityMsg}`);
  console.log('════════════════════');
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
  console.log('\nSpec Tree');
  console.log('═════════');
  console.log(renderTree(tree));
  return 0;
}

async function printAllSpecs(specs: Spec[]): Promise<number> {
  console.log('\nAll Specs');
  console.log('═════════');
  for (const spec of specs) {
    const statusIcon = getStatusIcon(spec.status);
    let suffix = '';
    if (spec.status === 'in_progress') {
      const worktreePath = await getWorkWorktreePath(spec.id, spec.title);
      suffix = ` [${worktreePath}]`;
    }
    console.log(`  ${statusIcon} ${spec.id}  ${spec.title}${suffix}`);
  }
  return 0;
}
