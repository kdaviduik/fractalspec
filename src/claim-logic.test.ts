import { describe, expect, test, beforeEach, afterEach, spyOn } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { claimSpec, releaseSpec, isSpecClaimed, checkClaimSafety } from './claim-logic';
import * as gitOps from './git-operations';
import { getWorkBranchName, getWorkWorktreePath } from './git-operations';
import { setSpecsRoot, writeSpec } from './spec-filesystem';
import type { Spec } from './types';

let testDir: string;
let specsDir: string;

function makeSpec(id: string): Spec {
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
  test('returns false when branch does not exist', async () => {
    const spec = makeSpec('nonexistent-id');
    const result = await isSpecClaimed(spec);
    expect(result).toBe(false);
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

    const result = await claimSpec(spec);

    expect(result.success).toBe(true);
    expect(result.branchName).toBe('work-test-a1b2-a1b2');
    expect(result.worktreePath).toBeUndefined();
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

    const result = await claimSpec(spec);

    expect(result.success).toBe(false);
    expect(result.error).toContain('uncommitted changes');

    mocks.forEach(m => m.mockRestore());
  });

  test('returns error if already claimed', async () => {
    const spec = makeSpec('c3d4');
    await writeSpec(spec);

    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(true),
    ];

    const result = await claimSpec(spec);

    expect(result.success).toBe(false);
    expect(result.error).toContain('already claimed');

    mocks.forEach(m => m.mockRestore());
  });

  test('auto-falls-back to worktree mode in bare repo', async () => {
    const spec = makeSpec('bare1');
    await writeSpec(spec);
    const worktreePath = await getWorkWorktreePath(spec.id, spec.title);

    const mocks = [
      spyOn(gitOps, 'isBareRepository').mockResolvedValue(true),
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
      spyOn(gitOps, 'createWorktree').mockResolvedValue(undefined),
    ];

    const result = await claimSpec(spec);

    expect(result.success).toBe(true);
    expect(result.worktreePath).toBe(worktreePath);
    expect(gitOps.createWorktree).toHaveBeenCalled();

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

  test('throws error if not claimed', async () => {
    const mocks = [
      spyOn(gitOps, 'findWorktreeByBranch').mockResolvedValue(null),
      spyOn(gitOps, 'branchExists').mockResolvedValue(false),
    ];

    const spec = makeSpec('g7h8');
    await writeSpec(spec);

    await expect(releaseSpec(spec)).rejects.toThrow();

    mocks.forEach(m => m.mockRestore());
  });
});

describe('checkClaimSafety', () => {
  test('returns safe=true when worktree does not exist', async () => {
    const spec = makeSpec('unclaimed1');
    const result = await checkClaimSafety(spec);

    expect(result.safe).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.branchName).toBe('work-test-unclaimed1-unclaimed1');
    expect(result.worktreePath).toContain('work-test-unclaimed1-unclaimed1');
  });

  test('returns correct branchName format', async () => {
    const spec = makeSpec('test123');
    spec.title = 'My Feature';
    const result = await checkClaimSafety(spec);

    expect(result.branchName).toBe('work-my-feature-test123');
  });

  test('includes worktreePath in result', async () => {
    const spec = makeSpec('pathtest');
    const result = await checkClaimSafety(spec);

    expect(typeof result.worktreePath).toBe('string');
    expect(result.worktreePath.length).toBeGreaterThan(0);
  });
});
