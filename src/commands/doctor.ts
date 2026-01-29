/**
 * sc doctor - Check repository health
 */

import { parseArgs } from 'util';
import type { CommandHandler, Spec } from '../types';
import { isValidPriority, MIN_PRIORITY, MAX_PRIORITY, DEFAULT_PRIORITY } from '../types';
import type { CommandHelp } from '../help.js';
import { readAllSpecs, writeSpec, getSpecsRoot } from '../spec-filesystem';
import { findGitRoot } from '../git-operations';
import { relative } from 'path';

interface HealthIssue {
  type: 'orphan' | 'circular' | 'missing_blocker' | 'stale_branch' | 'uncommitted' | 'invalid_priority' | 'single_workstream';
  specId: string;
  message: string;
  fixable: boolean;
}

interface UncommittedSpec {
  path: string;
  status: 'modified' | 'untracked';
}

async function findUncommittedSpecs(): Promise<UncommittedSpec[]> {
  const gitRoot = await findGitRoot();
  const specsRoot = await getSpecsRoot();
  const specsRelative = relative(gitRoot, specsRoot);

  const proc = Bun.spawn(['git', 'status', '--porcelain', specsRelative], {
    cwd: gitRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  await proc.exited;

  const uncommitted: UncommittedSpec[] = [];
  const lines = stdout.trim().split('\n').filter(Boolean);

  for (const line of lines) {
    const statusCode = line.slice(0, 2);
    const filePath = line.slice(3);

    if (!filePath.endsWith('.md')) {
      continue;
    }

    const status: 'modified' | 'untracked' =
      statusCode.includes('?') ? 'untracked' : 'modified';

    uncommitted.push({ path: filePath, status });
  }

  return uncommitted;
}

async function findOrphans(specs: Spec[]): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];
  const specIds = new Set(specs.map((s) => s.id));

  for (const spec of specs) {
    if (spec.parent && !specIds.has(spec.parent)) {
      issues.push({
        type: 'orphan',
        specId: spec.id,
        message: `Parent "${spec.parent}" not found`,
        fixable: true,
      });
    }
  }

  return issues;
}

async function findMissingBlockers(specs: Spec[]): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];
  const specIds = new Set(specs.map((s) => s.id));

  for (const spec of specs) {
    for (const blockerId of spec.blocks) {
      if (!specIds.has(blockerId)) {
        issues.push({
          type: 'missing_blocker',
          specId: spec.id,
          message: `Blocker "${blockerId}" not found`,
          fixable: true,
        });
      }
    }
  }

  return issues;
}

function findInvalidPriorities(specs: Spec[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const spec of specs) {
    if (!isValidPriority(spec.priority)) {
      issues.push({
        type: 'invalid_priority',
        specId: spec.id,
        message: `Priority "${spec.priority}" is invalid (must be ${MIN_PRIORITY}-${MAX_PRIORITY})`,
        fixable: true,
      });
    }
  }

  return issues;
}

async function fixInvalidPriority(spec: Spec): Promise<void> {
  const updated: Spec = { ...spec, priority: DEFAULT_PRIORITY };
  await writeSpec(updated);
}

function findCircularDeps(specs: Spec[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const specMap = new Map(specs.map((s) => [s.id, s]));

  function hasCircle(startId: string, visited: Set<string>): boolean {
    if (visited.has(startId)) {
      return true;
    }

    const spec = specMap.get(startId);
    if (!spec) return false;

    visited.add(startId);

    for (const blockerId of spec.blocks) {
      if (hasCircle(blockerId, new Set(visited))) {
        return true;
      }
    }

    return false;
  }

  for (const spec of specs) {
    if (hasCircle(spec.id, new Set())) {
      issues.push({
        type: 'circular',
        specId: spec.id,
        message: 'Circular dependency detected',
        fixable: false,
      });
    }
  }

  return issues;
}

function findSingleUseWorkstreams(specs: Spec[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const workstreamCounts = new Map<string, string[]>();

  for (const spec of specs) {
    if (spec.workstream !== null) {
      const existing = workstreamCounts.get(spec.workstream) ?? [];
      existing.push(spec.id);
      workstreamCounts.set(spec.workstream, existing);
    }
  }

  const allWorkstreams = Array.from(workstreamCounts.keys());

  for (const [workstream, specIds] of workstreamCounts.entries()) {
    if (specIds.length !== 1) {
      continue;
    }
    const specId = specIds[0];
    if (specId === undefined) {
      continue;
    }

    const similarWorkstreams = allWorkstreams.filter(
      (ws) => ws !== workstream && ws.length > 3 && workstream.length > 3
    ).filter((ws) => {
      const similarity = calculateSimilarity(workstream, ws);
      return similarity > 0.6;
    });

    let message = `Workstream "${workstream}" has only 1 spec (potential typo?)`;
    if (similarWorkstreams.length > 0) {
      const counts = similarWorkstreams.map((ws) => {
        const count = workstreamCounts.get(ws)?.length ?? 0;
        return `"${ws}" (${count} specs)`;
      });
      message += `. Did you mean: ${counts.join(', ')}?`;
    }

    issues.push({
      type: 'single_workstream',
      specId,
      message,
      fixable: false,
    });
  }

  return issues;
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.includes(shorter)) return shorter.length / longer.length;

  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i] as string)) {
      matches++;
    }
  }
  return matches / longer.length;
}

async function fixOrphan(spec: Spec, _specs: Spec[]): Promise<void> {
  const updated: Spec = { ...spec, parent: null };
  await writeSpec(updated);
}

async function fixMissingBlocker(spec: Spec, specs: Spec[]): Promise<void> {
  const specIds = new Set(specs.map((s) => s.id));
  const validBlocks = spec.blocks.filter((id) => specIds.has(id));
  const updated: Spec = { ...spec, blocks: validBlocks };
  await writeSpec(updated);
}

export const command: CommandHandler = {
  name: 'doctor',
  description: 'Check repository health',

  getHelp(): CommandHelp {
    return {
      name: 'sc doctor',
      synopsis: 'sc doctor [--fix]',
      description: `Check repository health and detect structural issues.

Detects:
  - Orphaned parent references (parent spec doesn't exist)
  - Missing blockers (blocker spec doesn't exist)
  - Invalid priorities (outside ${MIN_PRIORITY}-${MAX_PRIORITY} range)
  - Circular dependencies (A blocks B, B blocks A)
  - Single-use workstreams (potential typos)
  - Uncommitted spec changes (modified or untracked specs)

Circular dependencies, single-use workstreams, and uncommitted changes cannot be auto-fixed.`,
      flags: [
        {
          flag: '--fix',
          description: 'Automatically fix orphaned parents and missing blockers',
        },
      ],
      examples: [
        '# Check for issues',
        'sc doctor',
        '',
        '# Check and auto-fix where possible',
        'sc doctor --fix',
      ],
      notes: [
        'Exits with code 1 if any issues are found (even after --fix if unfixable issues remain).',
        'Orphan fix: Sets parent to null, making the spec a root.',
        'Missing blocker fix: Removes the invalid blocker ID from the blocks array.',
        'Uncommitted specs and single-use workstreams are warnings only and do not cause exit code 1.',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const { values } = parseArgs({
      args,
      options: {
        fix: { type: 'boolean' },
      },
      allowPositionals: false,
    });

    const specs = await readAllSpecs();

    console.log('\nRepository Health Check');
    console.log('═══════════════════════');

    const orphans = await findOrphans(specs);
    const missingBlockers = await findMissingBlockers(specs);
    const invalidPriorities = findInvalidPriorities(specs);
    const circular = findCircularDeps(specs);
    const singleWorkstreams = findSingleUseWorkstreams(specs);
    const uncommittedSpecs = await findUncommittedSpecs();

    const allIssues = [...orphans, ...missingBlockers, ...invalidPriorities, ...circular];
    const warningIssues = [...singleWorkstreams];

    if (allIssues.length === 0 && uncommittedSpecs.length === 0 && warningIssues.length === 0) {
      console.log('✓ No issues found');
      return 0;
    }

    if (uncommittedSpecs.length > 0) {
      console.log(`⚠ Warning: ${uncommittedSpecs.length} spec(s) have uncommitted changes`);
      for (const spec of uncommittedSpecs) {
        console.log(`  - ${spec.path} (${spec.status})`);
      }
      console.log('');
      console.log('Run: git add docs/specs/ && git commit -m "spec: update specs"');
      console.log('');
    }

    if (warningIssues.length > 0) {
      console.log(`⚠ ${warningIssues.length} warning(s):\n`);
      for (const issue of warningIssues) {
        console.log(`⚠ [${issue.type}] ${issue.specId}: ${issue.message}`);
      }
      console.log('');
    }

    if (allIssues.length === 0) {
      return 0;
    }

    console.log(`Found ${allIssues.length} issue(s):\n`);

    for (const issue of allIssues) {
      const icon = issue.fixable ? '⚠' : '✗';
      console.log(`${icon} [${issue.type}] ${issue.specId}: ${issue.message}`);
    }

    if (values.fix) {
      console.log('\nApplying fixes...');

      for (const issue of allIssues) {
        if (!issue.fixable) {
          console.log(`  ✗ Cannot auto-fix: ${issue.specId} (${issue.type})`);
          continue;
        }

        const spec = specs.find((s) => s.id === issue.specId);
        if (!spec) continue;

        if (issue.type === 'orphan') {
          await fixOrphan(spec, specs);
          console.log(`  ✓ Fixed orphan: ${issue.specId}`);
        }

        if (issue.type === 'missing_blocker') {
          await fixMissingBlocker(spec, specs);
          console.log(`  ✓ Fixed missing blocker: ${issue.specId}`);
        }

        if (issue.type === 'invalid_priority') {
          await fixInvalidPriority(spec);
          console.log(`  ✓ Fixed invalid priority: ${issue.specId} (set to ${DEFAULT_PRIORITY})`);
        }
      }
    } else {
      const fixable = allIssues.filter((i) => i.fixable).length;
      if (fixable > 0) {
        console.log(`\nRun 'sc doctor --fix' to auto-fix ${fixable} issue(s)`);
      }
    }

    return 1;
  },
};
