/**
 * sc doctor - Check repository health
 */

import { parseArgs } from 'util';
import matter from 'gray-matter';
import type { CommandHandler, Spec, Status } from '../types';
import { isValidPriority, MIN_PRIORITY, MAX_PRIORITY, DEFAULT_PRIORITY, COMPLETED_STATUSES } from '../types';
import { isBlocked } from '../spec-query';
import type { CommandHelp } from '../help.js';
import { readAllSpecs, writeSpec, getSpecsRoot, readRawSpecContent, type SpecParseFailure } from '../spec-filesystem';
import { findBoilerplateSections } from '../markdown-sections';
import { findGitRoot } from '../git-operations';
import { relative, dirname, join } from 'path';
import { rename } from 'fs/promises';

function rejectJavaScriptEngine(): object {
  throw new Error('JavaScript frontmatter engine is disabled for security');
}
const GRAY_MATTER_OPTIONS = {
  language: 'yaml' as const,
  engines: { javascript: rejectJavaScriptEngine },
};
import { randomUUID } from 'crypto';

interface HealthIssue {
  type: 'orphan' | 'circular' | 'missing_blocker' | 'stale_branch' | 'uncommitted' | 'invalid_priority' | 'deprecated_field' | 'unclosed_parent' | 'stale_blocked' | 'boilerplate_content' | 'parse_failure';
  specId: string;
  message: string;
  fixable: boolean;
  targetStatus?: Status;
  filePath?: string | undefined;
  suggestedFix?: string | undefined;
}

const STATUS_ALIASES: ReadonlyMap<string, Status> = new Map([
  ['done', 'closed'],
  ['complete', 'closed'],
  ['completed', 'closed'],
  ['wip', 'in_progress'],
  ['in-progress', 'in_progress'],
  ['inprogress', 'in_progress'],
  ['todo', 'ready'],
  ['pending', 'ready'],
  ['skip', 'not_planned'],
  ['skipped', 'not_planned'],
  ['cancelled', 'not_planned'],
  ['canceled', 'not_planned'],
  ['not-planned', 'not_planned'],
  ['notplanned', 'not_planned'],
]);

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
    if (spec.parent !== null && !specIds.has(spec.parent)) {
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

function findStaleBlocked(specs: Spec[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const spec of specs) {
    if (spec.status !== 'blocked') continue;
    if (spec.blockedBy.length === 0) continue;

    if (!isBlocked(spec, specs)) {
      issues.push({
        type: 'stale_blocked',
        specId: spec.id,
        message: `Status is "blocked" but all blockers are resolved — should be "ready"`,
        fixable: true,
      });
    }
  }

  return issues;
}

async function fixStaleBlocked(spec: Spec): Promise<void> {
  const updated: Spec = { ...spec, status: 'ready' };
  await writeSpec(updated);
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

const ANSI_ESCAPE_PATTERN = new RegExp(String.raw`\x1b\[[0-9;]*[a-zA-Z]`, 'g');
const CONTROL_CHAR_PATTERN = new RegExp(String.raw`[\x00-\x1f\x7f]`, 'g');

function sanitizeForDisplay(value: string): string {
  return value.replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_CHAR_PATTERN, '');
}

function findParseFailureIssues(failures: SpecParseFailure[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  for (const failure of failures) {
    const isStatusField = failure.field === 'status';
    const actualLower = isStatusField && failure.actualValue !== undefined
      ? failure.actualValue.toLowerCase()
      : undefined;
    const canonicalStatus = actualLower !== undefined ? STATUS_ALIASES.get(actualLower) : undefined;
    const fixable = canonicalStatus !== undefined;

    const displayValue = failure.actualValue !== undefined
      ? sanitizeForDisplay(failure.actualValue)
      : undefined;

    const suggestedFix = fixable && canonicalStatus !== undefined
      ? `${displayValue} → ${canonicalStatus}`
      : undefined;

    issues.push({
      type: 'parse_failure',
      specId: failure.filePath,
      message: displayValue !== undefined
        ? `${failure.error} (got "${displayValue}")`
        : failure.error,
      fixable,
      filePath: failure.filePath,
      suggestedFix,
    });
  }

  return issues;
}

async function fixParseFailureStatus(filePath: string, canonicalStatus: Status): Promise<void> {
  const rawContent = await Bun.file(filePath).text();
  const parsed = matter(rawContent, GRAY_MATTER_OPTIONS);
  parsed.data['status'] = canonicalStatus;
  const fixed = matter.stringify(parsed.content, parsed.data);

  // Atomic write: write to temp file, then rename
  const dirPath = dirname(filePath);
  const tempPath = join(dirPath, `.tmp-${randomUUID()}.md`);
  await Bun.write(tempPath, fixed);
  await rename(tempPath, filePath);
}

function findBoilerplateContent(specs: Spec[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  for (const spec of specs) {
    const sections = findBoilerplateSections(spec.content);
    if (sections.length > 0) {
      issues.push({
        type: 'boilerplate_content',
        specId: spec.id,
        message: `Unfilled boilerplate in: ${sections.join(', ')}`,
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

async function applyParseFailureFix(issue: HealthIssue): Promise<void> {
  if (issue.filePath === undefined) return;

  // Re-read the raw file and extract the actual status value
  const rawContent = await Bun.file(issue.filePath).text();
  const parsed = matter(rawContent, GRAY_MATTER_OPTIONS);
  const rawStatus: unknown = parsed.data['status'];
  if (typeof rawStatus !== 'string') return;

  const canonicalStatus = STATUS_ALIASES.get(rawStatus.toLowerCase());
  if (canonicalStatus === undefined) return;

  await fixParseFailureStatus(issue.filePath, canonicalStatus);
  console.log(`  ✓ Fixed parse failure: ${issue.suggestedFix}`);
}

async function applyFix(issue: HealthIssue, specs: Spec[]): Promise<void> {
  if (!issue.fixable) {
    console.log(`  ✗ Cannot auto-fix: ${issue.specId} (${issue.type})`);
    return;
  }

  if (issue.type === 'parse_failure') {
    await applyParseFailureFix(issue);
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
  } else if (issue.type === 'stale_blocked') {
    await fixStaleBlocked(spec);
    console.log(`  ✓ Fixed stale blocked: ${issue.specId} (blocked → ready)`);
  } else if (issue.type === 'unclosed_parent') {
    await tryFixUnclosedParent(spec, issue, '  ');
  }
}

const MAX_CASCADE_ROUNDS = 10;

async function cascadeUnclosedParentFixes(): Promise<void> {
  let cascadeRound = 0;
  while (cascadeRound < MAX_CASCADE_ROUNDS) {
    const { specs: freshSpecs } = await readAllSpecs();
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
  - Parse failures (spec files with invalid/missing frontmatter — invisible to other commands)
  - Orphaned parent references (parent spec doesn't exist)
  - Missing blockers (blocker spec doesn't exist)
  - Invalid priorities (outside ${MIN_PRIORITY}-${MAX_PRIORITY} range)
  - Circular dependencies (A blocks B, B blocks A)
  - Deprecated field names (blocks → blockedBy migration)
  - Stale blocked specs (all blockers resolved but status still "blocked")
  - Unclosed parent specs (all children completed but parent still open)
  - Unfilled boilerplate content (specs with template placeholder text)
  - Uncommitted spec changes (modified or untracked specs)

Circular dependencies, uncommitted changes, and boilerplate content cannot be auto-fixed.`,
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
        'Stale blocked fix: Promotes specs with all blockers resolved from "blocked" to "ready". Specs with empty blockedBy (manually blocked) are not affected.',
        'Unclosed parent fix: Auto-closes with smart status matching (closed/not_planned). Cascades upward through the hierarchy. In-progress parents with active worktrees are skipped.',
        'Boilerplate detection: Reports specs with unfilled template sections. Use "sc set <id> --overview/--goals/etc." to fill them programmatically.',
        'Parse failure fix: Corrects common status aliases (done→closed, todo→ready, wip→in_progress, etc.). Case-insensitive.',
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

    const { specs, failures: parseFailures } = await readAllSpecs();

    console.log('\nRepository Health Check');
    console.log('═══════════════════════');

    const parseFailureIssues = findParseFailureIssues(parseFailures);
    const orphans = await findOrphans(specs);
    const missingBlockers = await findMissingBlockers(specs);
    const invalidPriorities = findInvalidPriorities(specs);
    const circular = findCircularDeps(specs);
    const deprecatedFields = await findDeprecatedFields(specs);
    const staleBlocked = findStaleBlocked(specs);
    const unclosedParents = findUnclosedParents(specs);
    const boilerplateIssues = findBoilerplateContent(specs);
    const uncommittedSpecs = await findUncommittedSpecs();

    // Parse failures first so they're impossible to miss
    const allIssues = [...parseFailureIssues, ...orphans, ...missingBlockers, ...invalidPriorities, ...circular, ...deprecatedFields, ...staleBlocked, ...unclosedParents, ...boilerplateIssues];

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
      const icon = issue.fixable ? '⚠ warning' : '✗ error';
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
