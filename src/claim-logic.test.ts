import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { claimSpec, releaseSpec, isSpecClaimed } from './claim-logic';
import { branchExists, deleteBranch, getWorkBranchName } from './git-operations';
import { setSpecsRoot, writeSpec } from './spec-filesystem';
import type { Spec } from './types';

let testDir: string;
let specsDir: string;
const createdBranches: string[] = [];

function makeSpec(id: string): Spec {
  return {
    id,
    status: 'ready',
    parent: null,
    blocks: [],
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
  for (const branch of createdBranches) {
    try {
      await deleteBranch(branch);
    } catch {
      // Ignore cleanup errors
    }
  }
  createdBranches.length = 0;
  await rm(testDir, { recursive: true, force: true });
});

describe('isSpecClaimed', () => {
  test('returns false when branch does not exist', async () => {
    const result = await isSpecClaimed('nonexistent-id');
    expect(result).toBe(false);
  });
});

describe('claimSpec', () => {
  test('creates branch and updates spec status', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const result = await claimSpec(spec);
    createdBranches.push(getWorkBranchName(spec.id));

    expect(result.success).toBe(true);
    expect(result.branchName).toBe('work/a1b2');

    const branchCreated = await branchExists('work/a1b2');
    expect(branchCreated).toBe(true);
  });

  test('returns error if already claimed', async () => {
    const spec = makeSpec('c3d4');
    await writeSpec(spec);

    const firstClaim = await claimSpec(spec);
    createdBranches.push(getWorkBranchName(spec.id));
    expect(firstClaim.success).toBe(true);

    const secondClaim = await claimSpec(spec);
    expect(secondClaim.success).toBe(false);
    expect(secondClaim.error).toContain('already claimed');
  });
});

describe('releaseSpec', () => {
  test('deletes branch', async () => {
    const spec = makeSpec('e5f6');
    await writeSpec(spec);

    await claimSpec(spec);
    createdBranches.push(getWorkBranchName(spec.id));

    const existsBefore = await branchExists('work/e5f6');
    expect(existsBefore).toBe(true);

    await releaseSpec(spec);
    createdBranches.pop();

    const existsAfter = await branchExists('work/e5f6');
    expect(existsAfter).toBe(false);
  });

  test('throws error if not claimed', async () => {
    const spec = makeSpec('g7h8');
    await writeSpec(spec);

    await expect(releaseSpec(spec)).rejects.toThrow();
  });
});
