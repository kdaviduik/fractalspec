import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { claimSpec, releaseSpec, completeSpec, isSpecClaimed, checkClaimSafety } from './claim-logic';
import * as gitOps from './git-operations';
import { getWorkBranchName, getWorkWorktreePath } from './git-operations';
import { setSpecsRoot, writeSpec } from './spec-filesystem';
import type { Spec } from './types';

let testDir: string;
let specsDir: string;

function makeSpec(id: string, overrides: Partial<Spec> = {}): Spec {
  return {
    id,
    status: 'ready',
    parent: null,
    blockedBy: [],
    priority: 5,
    pr: null,
    title: `Test ${id}`,
    content: `# Spec: Test ${id}`,
    filePath: join(specsDir, `test-${id}`, `test-${id}.md`),
    ...overrides,
  };
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'sc-claim-test-'));
  specsDir = join(testDir, 'docs', 'specs');
  setSpecsRoot(specsDir);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('isSpecClaimed', () => {
  test('returns false when branch does not exist and status is not in_progress', async () => {
    const spec = makeSpec('nonexistent-id');
    const result = await isSpecClaimed(spec);
    expect(result).toBe(false);
  });

  test('returns true for in_progress status with no branch or worktree', async () => {
    const spec = makeSpec('status1', { status: 'in_progress' });

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
    ];

    const result = await isSpecClaimed(spec);
    expect(result).toBe(true);

    mocks.forEach(m => m.mockRestore());
  });

  test('returns false for ready status with no branch or worktree', async () => {
    const spec = makeSpec('status2', { status: 'ready' });

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
    ];

    const result = await isSpecClaimed(spec);
    expect(result).toBe(false);

    mocks.forEach(m => m.mockRestore());
  });
});

describe('claimSpec (status-only mode)', () => {
  test('status-only claim with no options: sets status, no git artifacts', async () => {
    const spec = makeSpec('s1b2');
    await writeSpec(spec);

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
      spyOn(gitOps, 'createBranch').mockResolvedValue(undefined),
      spyOn(gitOps, 'createWorktree').mockResolvedValue(undefined),
    ];

    const result = await claimSpec(spec);

    expect(result.success).toBe(true);
    expect(result.mode).toBe('status_only');
    expect(result.branchName).toBe('work-test-s1b2-s1b2');
    expect('worktreePath' in result).toBe(false);
    expect(gitOps.createBranch).not.toHaveBeenCalled();
    expect(gitOps.createWorktree).not.toHaveBeenCalled();

    mocks.forEach(m => m.mockRestore());
  });

  test('bare repo with no flags: status-only (NOT worktree)', async () => {
    const spec = makeSpec('bare2');
    await writeSpec(spec);

    const mocks = [
      spyOn(gitOps, 'isBareRepository').mockResolvedValue(true),
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
      spyOn(gitOps, 'createWorktree').mockResolvedValue(undefined),
      spyOn(gitOps, 'createBranch').mockResolvedValue(undefined),
    ];

    const result = await claimSpec(spec);

    expect(result.success).toBe(true);
    expect(result.mode).toBe('status_only');
    expect(gitOps.createWorktree).not.toHaveBeenCalled();

    mocks.forEach(m => m.mockRestore());
  });
});

describe('claimSpec (branch mode)', () => {
  test('creates branch, checks it out, and updates spec status', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mocks = [
      spyOn(gitOps, 'isBareRepository').mockResolvedValue(false),
      spyOn(gitOps, 'hasUncommittedChanges').mockResolvedValue(false),
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
      spyOn(gitOps, 'createBranch').mockResolvedValue(undefined),
      spyOn(gitOps, 'checkoutBranch').mockResolvedValue(undefined),
    ];

    const result = await claimSpec(spec, { useBranch: true });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('branch');
    expect(result.branchName).toBe('work-test-a1b2-a1b2');
    expect('worktreePath' in result).toBe(false);
    expect(gitOps.createBranch).toHaveBeenCalledWith('work-test-a1b2-a1b2');
    expect(gitOps.checkoutBranch).toHaveBeenCalledWith('work-test-a1b2-a1b2');

    mocks.forEach(m => m.mockRestore());
  });

  test('returns error on dirty working tree', async () => {
    const spec = makeSpec('dirty1');
    await writeSpec(spec);

    const mocks = [
      spyOn(gitOps, 'isBareRepository').mockResolvedValue(false),
      spyOn(gitOps, 'hasUncommittedChanges').mockResolvedValue(true),
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
    ];

    const result = await claimSpec(spec, { useBranch: true });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('uncommitted changes');

    mocks.forEach(m => m.mockRestore());
  });

  test('returns error if already claimed', async () => {
    const spec = makeSpec('c3d4');
    await writeSpec(spec);

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(true),
    ];

    const result = await claimSpec(spec, { useBranch: true });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('already claimed');

    mocks.forEach(m => m.mockRestore());
  });

  test('bare repo with --branch auto-escalates to worktree', async () => {
    const spec = makeSpec('bare1');
    await writeSpec(spec);
    const worktreePath = await getWorkWorktreePath(spec.id, spec.title);

    const mocks = [
      spyOn(gitOps, 'isBareRepository').mockResolvedValue(true),
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
      spyOn(gitOps, 'createWorktree').mockResolvedValue(undefined),
    ];

    const result = await claimSpec(spec, { useBranch: true });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('worktree');
    if (result.success && result.mode === 'worktree') expect(result.worktreePath).toBe(worktreePath);
    expect(gitOps.createWorktree).toHaveBeenCalled();

    mocks.forEach(m => m.mockRestore());
  });

  test('--branch --worktree: worktree wins', async () => {
    const spec = makeSpec('both1');
    await writeSpec(spec);
    const worktreePath = await getWorkWorktreePath(spec.id, spec.title);

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
      spyOn(gitOps, 'createWorktree').mockResolvedValue(undefined),
    ];

    const result = await claimSpec(spec, { useBranch: true, useWorktree: true });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('worktree');
    if (result.success && result.mode === 'worktree') expect(result.worktreePath).toBe(worktreePath);

    mocks.forEach(m => m.mockRestore());
  });
});

describe('releaseSpec', () => {
  test('switches to default branch, deletes work branch, updates status', async () => {
    const spec = makeSpec('e5f6');
    await writeSpec(spec);
    const branchName = getWorkBranchName(spec.id, spec.title);

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(true),
      spyOn(gitOps, 'getCurrentBranch').mockResolvedValue(branchName),
      spyOn(gitOps, 'getDefaultBranch').mockResolvedValue('main'),
      spyOn(gitOps, 'checkoutBranch').mockResolvedValue(undefined),
      spyOn(gitOps, 'deleteBranch').mockResolvedValue(undefined),
    ];

    await releaseSpec(spec);

    expect(gitOps.checkoutBranch).toHaveBeenCalledWith('main', undefined);
    expect(gitOps.deleteBranch).toHaveBeenCalledWith(branchName);

    mocks.forEach(m => m.mockRestore());
  });

  test('status-only claim: updates status to ready, no git operations', async () => {
    const spec = makeSpec('stat1', { status: 'in_progress' });
    await writeSpec(spec);

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
      spyOn(gitOps, 'deleteBranch').mockResolvedValue(undefined),
      spyOn(gitOps, 'checkoutBranch').mockResolvedValue(undefined),
    ];

    await releaseSpec(spec);

    expect(gitOps.deleteBranch).not.toHaveBeenCalled();
    expect(gitOps.checkoutBranch).not.toHaveBeenCalled();

    mocks.forEach(m => m.mockRestore());
  });

  test('throws if not claimed and status is not in_progress', async () => {
    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
    ];

    const spec = makeSpec('g7h8');
    await writeSpec(spec);

    await expect(releaseSpec(spec)).rejects.toThrow('Bug:');

    mocks.forEach(m => m.mockRestore());
  });
});

describe('completeSpec', () => {
  test('status-only claim: updates status to closed, no git operations', async () => {
    const spec = makeSpec('comp1', { status: 'in_progress' });
    await writeSpec(spec);

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
      spyOn(gitOps, 'deleteBranch').mockResolvedValue(undefined),
      spyOn(gitOps, 'checkoutBranch').mockResolvedValue(undefined),
    ];

    await completeSpec(spec);

    expect(gitOps.deleteBranch).not.toHaveBeenCalled();
    expect(gitOps.checkoutBranch).not.toHaveBeenCalled();

    mocks.forEach(m => m.mockRestore());
  });
});

describe('checkClaimSafety', () => {
  test('returns safe=true when worktree does not exist and no branch', async () => {
    const spec = makeSpec('unclaimed1');

    const mocks = [
      spyOn(gitOps, 'hasUncommittedChanges').mockResolvedValue(false),
      spyOn(gitOps, 'hasUnpushedCommits').mockResolvedValue(false),
    ];

    const result = await checkClaimSafety(spec);

    expect(result.safe).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.branchName).toBe('work-test-unclaimed1-unclaimed1');

    mocks.forEach(m => m.mockRestore());
  });

  test('returns correct branchName format', async () => {
    const spec = makeSpec('test123');
    spec.title = 'My Feature';

    const mocks = [
      spyOn(gitOps, 'hasUncommittedChanges').mockResolvedValue(false),
      spyOn(gitOps, 'hasUnpushedCommits').mockResolvedValue(false),
    ];

    const result = await checkClaimSafety(spec);
    expect(result.branchName).toBe('work-my-feature-test123');

    mocks.forEach(m => m.mockRestore());
  });

  test('includes worktreePath in result', async () => {
    const spec = makeSpec('pathtest');

    const mocks = [
      spyOn(gitOps, 'hasUncommittedChanges').mockResolvedValue(false),
      spyOn(gitOps, 'hasUnpushedCommits').mockResolvedValue(false),
    ];

    const result = await checkClaimSafety(spec);
    expect(typeof result.worktreePath).toBe('string');
    expect(result.worktreePath.length).toBeGreaterThan(0);

    mocks.forEach(m => m.mockRestore());
  });

  test('status-only claim: detects uncommitted changes on current branch', async () => {
    const spec = makeSpec('dirty2');

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
      spyOn(gitOps, 'hasUncommittedChanges').mockResolvedValue(true),
      spyOn(gitOps, 'hasUnpushedCommits').mockResolvedValue(false),
    ];

    const result = await checkClaimSafety(spec);
    expect(result.safe).toBe(false);
    expect(result.issues).toContain('uncommitted changes');

    mocks.forEach(m => m.mockRestore());
  });

  test('status-only claim: detects unpushed commits on current branch', async () => {
    const spec = makeSpec('unpush1');

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
      spyOn(gitOps, 'hasUncommittedChanges').mockResolvedValue(false),
      spyOn(gitOps, 'hasUnpushedCommits').mockResolvedValue(true),
    ];

    const result = await checkClaimSafety(spec);
    expect(result.safe).toBe(false);
    expect(result.issues).toContain('unpushed commits');

    mocks.forEach(m => m.mockRestore());
  });
});
