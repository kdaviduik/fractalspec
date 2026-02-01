/**
 * sc doctor - Check repository health
 */

import { parseArgs } from 'util';
import type { CommandHandler, Spec, Status } from '../types';
import { isValidPriority, MIN_PRIORITY, MAX_PRIORITY, DEFAULT_PRIORITY, COMPLETED_STATUSES } from '../types';
import type { CommandHelp } from '../help.js';
import { readAllSpecs, writeSpec, getSpecsRoot, readRawSpecContent } from '../spec-filesystem';
import { findGitRoot } from '../git-operations';
import { relative } from 'path';

interface HealthIssue {
  type: 'orphan' | 'circular' | 'missing_blocker' | 'stale_branch' | 'uncommitted' | 'invalid_priority' | 'deprecated_field' | 'unclosed_parent';
  specId: string;
  message: string;
  fixable: boolean;
  targetStatus?: Status;
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
    for (const blockerId of spec.blockedBy) {
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

    for (const blockerId of spec.blockedBy) {
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

async function fixOrphan(spec: Spec, _specs: Spec[]): Promise<void> {
  const updated: Spec = { ...spec, parent: null };
  await writeSpec(updated);
}

async function fixMissingBlocker(spec: Spec, specs: Spec[]): Promise<void> {
  const specIds = new Set(specs.map((s) => s.id));
  const validBlockedBy = spec.blockedBy.filter((id) => specIds.has(id));
  const updated: Spec = { ...spec, blockedBy: validBlockedBy };
  await writeSpec(updated);
}

async function findDeprecatedFields(specs: Spec[]): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  for (const spec of specs) {
    const rawContent = await readRawSpecContent(spec.filePath);
    // Check if the file uses deprecated "blocks:" field instead of "blockedBy:"
    if (rawContent.includes('\nblocks:') && !rawContent.includes('\nblockedBy:')) {
      issues.push({
        type: 'deprecated_field',
        specId: spec.id,
        message: 'Using deprecated "blocks" field, should be "blockedBy"',
        fixable: true,
      });
    }
  }

  return issues;
}

async function fixDeprecatedField(spec: Spec): Promise<void> {
  await writeSpec(spec);
}

function findUnclosedParents(specs: Spec[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const childrenByParent = new Map<string, Spec[]>();

  for (const spec of specs) {
    if (spec.parent === null) continue;
    const existing = childrenByParent.get(spec.parent) ?? [];
    existing.push(spec);
    childrenByParent.set(spec.parent, existing);
  }

  const specMap = new Map(specs.map(s => [s.id, s]));

  for (const [parentId, children] of childrenByParent) {
    const parent = specMap.get(parentId);
    if (!parent) continue;
    if (COMPLETED_STATUSES.includes(parent.status)) continue;

    const allTerminal = children.every(child =>
      COMPLETED_STATUSES.includes(child.status)
    );
    if (!allTerminal) continue;

    const allClosed = children.every(c => c.status === 'closed');
    const allNotPlanned = children.every(c => c.status === 'not_planned');
    const allDeferred = children.every(c => c.status === 'deferred');

    if (allClosed) {
      issues.push({
        type: 'unclosed_parent',
        specId: parentId,
        message: `All children closed but parent "${parent.title}" is still "${parent.status}"`,
        fixable: true,
        targetStatus: 'closed',
      });
    } else if (allNotPlanned) {
      issues.push({
        type: 'unclosed_parent',
        specId: parentId,
        message: `All children not_planned but parent "${parent.title}" is still "${parent.status}"`,
        fixable: true,
        targetStatus: 'not_planned',
      });
    } else if (allDeferred) {
      issues.push({
        type: 'unclosed_parent',
        specId: parentId,
        message: `All children deferred but parent "${parent.title}" is still "${parent.status}" — consider deferring parent too`,
        fixable: false,
      });
    } else {
      issues.push({
        type: 'unclosed_parent',
        specId: parentId,
        message: `All children resolved (mixed statuses) but parent "${parent.title}" is still "${parent.status}" — manual review needed`,
        fixable: false,
      });
    }
  }

  return issues;
}

async function fixUnclosedParent(spec: Spec, targetStatus: Status = 'closed'): Promise<void> {
  const updated: Spec = { ...spec, status: targetStatus };
  await writeSpec(updated);
}

async function tryFixUnclosedParent(spec: Spec, issue: HealthIssue, prefix: string): Promise<boolean> {
  if (spec.status === 'in_progress') {
    console.log(`${prefix}⚠ Skipping ${issue.specId} "${spec.title}": status is in_progress. Run 'sc done' or 'sc release' first.`);
    return false;
  }
  await fixUnclosedParent(spec, issue.targetStatus);
  console.log(`${prefix}✓ Resolved: ${issue.specId} "${spec.title}" (${spec.status} → ${issue.targetStatus})`);
  return true;
}

async function applyFix(issue: HealthIssue, specs: Spec[]): Promise<void> {
  if (!issue.fixable) {
    console.log(`  ✗ Cannot auto-fix: ${issue.specId} (${issue.type})`);
    return;
  }

  const spec = specs.find((s) => s.id === issue.specId);
  if (!spec) return;

  if (issue.type === 'orphan') {
    await fixOrphan(spec, specs);
    console.log(`  ✓ Fixed orphan: ${issue.specId}`);
  } else if (issue.type === 'missing_blocker') {
    await fixMissingBlocker(spec, specs);
    console.log(`  ✓ Fixed missing blocker: ${issue.specId}`);
  } else if (issue.type === 'invalid_priority') {
    await fixInvalidPriority(spec);
    console.log(`  ✓ Fixed invalid priority: ${issue.specId} (set to ${DEFAULT_PRIORITY})`);
  } else if (issue.type === 'deprecated_field') {
    await fixDeprecatedField(spec);
    console.log(`  ✓ Fixed deprecated field: ${issue.specId} (blocks → blockedBy)`);
  } else if (issue.type === 'unclosed_parent') {
    await tryFixUnclosedParent(spec, issue, '  ');
  }
}

const MAX_CASCADE_ROUNDS = 10;

async function cascadeUnclosedParentFixes(): Promise<void> {
  let cascadeRound = 0;
  while (cascadeRound < MAX_CASCADE_ROUNDS) {
    const freshSpecs = await readAllSpecs();
    const moreUnclosed = findUnclosedParents(freshSpecs).filter(i => i.fixable);
    if (moreUnclosed.length === 0) break;

    for (const issue of moreUnclosed) {
      const freshSpec = freshSpecs.find(s => s.id === issue.specId);
      if (!freshSpec) continue;
      await tryFixUnclosedParent(freshSpec, issue, '  [cascade] ');
    }
    cascadeRound++;
  }
  if (cascadeRound >= MAX_CASCADE_ROUNDS) {
    console.log(`  ⚠ Cascade reached maximum depth (${MAX_CASCADE_ROUNDS}). Run 'sc doctor --fix' again to continue.`);
  }
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
  - Deprecated field names (blocks → blockedBy migration)
  - Unclosed parent specs (all children completed but parent still open)
  - Uncommitted spec changes (modified or untracked specs)

Circular dependencies and uncommitted changes cannot be auto-fixed.`,
      flags: [
        {
          flag: '--fix',
          description: 'Automatically fix detected issues where possible',
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
        'Missing blocker fix: Removes the invalid blocker ID from the blockedBy array.',
        'Deprecated field fix: Rewrites spec file using the new blockedBy field name.',
        'Unclosed parent fix: Auto-closes with smart status matching (closed/not_planned). Cascades upward through the hierarchy. In-progress parents with active worktrees are skipped.',
        'Uncommitted specs are warnings only and do not cause exit code 1.',
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
    const deprecatedFields = await findDeprecatedFields(specs);
    const unclosedParents = findUnclosedParents(specs);
    const uncommittedSpecs = await findUncommittedSpecs();

    const allIssues = [...orphans, ...missingBlockers, ...invalidPriorities, ...circular, ...deprecatedFields, ...unclosedParents];

    if (allIssues.length === 0 && uncommittedSpecs.length === 0) {
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
        await applyFix(issue, specs);
      }

      await cascadeUnclosedParentFixes();
    } else {
      const fixable = allIssues.filter((i) => i.fixable).length;
      if (fixable > 0) {
        console.log(`\nRun 'sc doctor --fix' to auto-fix ${fixable} issue(s)`);
      }
    }

    return 1;
  },
};
