/**
 * sc doctor - Check repository health
 */

import { parseArgs } from 'util';
import type { CommandHandler, Spec } from '../types';
import { readAllSpecs, writeSpec } from '../spec-filesystem';

interface HealthIssue {
  type: 'orphan' | 'circular' | 'missing_blocker' | 'stale_branch';
  specId: string;
  message: string;
  fixable: boolean;
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

async function fixOrphan(spec: Spec, specs: Spec[]): Promise<void> {
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
    const circular = findCircularDeps(specs);

    const allIssues = [...orphans, ...missingBlockers, ...circular];

    if (allIssues.length === 0) {
      console.log('✓ No issues found');
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
