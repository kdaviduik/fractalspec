import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { claimSpec, releaseSpec, isSpecClaimed } from './claim-logic';
import { branchExists, deleteBranch, getWorkBranchName, getWorkWorktreePath } from './git-operations';
import { setSpecsRoot, writeSpec } from './spec-filesystem';
import type { Spec } from './types';

let testDir: string;
let specsDir: string;
const createdSpecs: Spec[] = [];

function makeSpec(id: string): Spec {
  return {
    id,
    status: 'ready',
    parent: null,
    blocks: [],
    priority: 'normal',
    title: `Test ${id}`,
    content: `# Spec: Test ${id}`,
    filePath: join(specsDir, `test-${id}`, `test-${id}.md`),
  };
}

async function cleanupWorktreeAndBranch(spec: Spec): Promise<void> {
  const branchName = getWorkBranchName(spec.id, spec.title);
  const worktreePath = await getWorkWorktreePath(spec.id, spec.title);
  try {
    const proc = Bun.spawn(['git', 'worktree', 'remove', '--force', worktreePath], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
  } catch {
    // Ignore cleanup errors
  }
  try {
    await deleteBranch(branchName);
  } catch {
    // Ignore cleanup errors
  }
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'sc-claim-test-'));
  specsDir = join(testDir, 'docs', 'specs');
  setSpecsRoot(specsDir);
});

afterEach(async () => {
  for (const spec of createdSpecs) {
    await cleanupWorktreeAndBranch(spec);
  }
  createdSpecs.length = 0;
  await rm(testDir, { recursive: true, force: true });
});

describe('isSpecClaimed', () => {
  test('returns false when branch does not exist', async () => {
    const spec = makeSpec('nonexistent-id');
    const result = await isSpecClaimed(spec);
    expect(result).toBe(false);
  });
});

describe('claimSpec', () => {
  test('creates branch and updates spec status', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);
    createdSpecs.push(spec);

    const result = await claimSpec(spec);

    expect(result.success).toBe(true);
    expect(result.branchName).toBe('work-test-a1b2-a1b2');

    const branchCreated = await branchExists('work-test-a1b2-a1b2');
    expect(branchCreated).toBe(true);
  });

  test('returns error if already claimed', async () => {
    const spec = makeSpec('c3d4');
    await writeSpec(spec);
    createdSpecs.push(spec);

    const firstClaim = await claimSpec(spec);
    expect(firstClaim.success).toBe(true);

    const secondClaim = await claimSpec(spec);
    expect(secondClaim.success).toBe(false);
    expect(secondClaim.error).toBeDefined();
  });
});

describe('releaseSpec', () => {
  test('deletes branch', async () => {
    const spec = makeSpec('e5f6');
    await writeSpec(spec);
    const branchName = getWorkBranchName(spec.id, spec.title);

    await claimSpec(spec);

    const existsBefore = await branchExists(branchName);
    expect(existsBefore).toBe(true);

    await releaseSpec(spec);

    const existsAfter = await branchExists(branchName);
    expect(existsAfter).toBe(false);
  });

  test('throws error if not claimed', async () => {
    const spec = makeSpec('g7h8');
    await writeSpec(spec);

    await expect(releaseSpec(spec)).rejects.toThrow();
  });
});
