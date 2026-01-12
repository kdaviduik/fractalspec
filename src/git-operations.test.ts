import { describe, expect, test, afterEach } from 'bun:test';
import {
  branchExists,
  createBranch,
  deleteBranch,
  getCurrentBranch,
  getWorkBranchName,
} from './git-operations';

const TEST_BRANCH_PREFIX = 'test-sc-git-';
const createdBranches: string[] = [];

afterEach(async () => {
  for (const branch of createdBranches) {
    try {
      await deleteBranch(branch);
    } catch {
      // Ignore cleanup errors
    }
  }
  createdBranches.length = 0;
});

describe('getWorkBranchName', () => {
  test('returns work/<id> format', () => {
    expect(getWorkBranchName('a1b2')).toBe('work/a1b2');
    expect(getWorkBranchName('test-id')).toBe('work/test-id');
  });
});

describe('getCurrentBranch', () => {
  test('returns current branch name', async () => {
    const branch = await getCurrentBranch();
    expect(typeof branch).toBe('string');
    expect(branch.length).toBeGreaterThan(0);
  });
});

describe('branchExists', () => {
  test('returns false for non-existent branch', async () => {
    const exists = await branchExists('definitely-does-not-exist-xyz123');
    expect(exists).toBe(false);
  });

  test('returns true for current branch', async () => {
    const current = await getCurrentBranch();
    const exists = await branchExists(current);
    expect(exists).toBe(true);
  });
});

describe('createBranch and deleteBranch', () => {
  test('creates and deletes branch', async () => {
    const branchName = `${TEST_BRANCH_PREFIX}${Date.now()}`;
    createdBranches.push(branchName);

    const existsBefore = await branchExists(branchName);
    expect(existsBefore).toBe(false);

    await createBranch(branchName);

    const existsAfter = await branchExists(branchName);
    expect(existsAfter).toBe(true);

    await deleteBranch(branchName);
    createdBranches.pop();

    const existsAfterDelete = await branchExists(branchName);
    expect(existsAfterDelete).toBe(false);
  });

  test('createBranch throws if branch already exists', async () => {
    const branchName = `${TEST_BRANCH_PREFIX}${Date.now()}-dup`;
    createdBranches.push(branchName);

    await createBranch(branchName);

    await expect(createBranch(branchName)).rejects.toThrow();
  });

  test('deleteBranch throws if branch does not exist', async () => {
    await expect(deleteBranch('nonexistent-branch-xyz')).rejects.toThrow();
  });
});
