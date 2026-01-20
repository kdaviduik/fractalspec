import { describe, expect, test, afterEach } from 'bun:test';
import { resolve } from 'path';
import {
  branchExists,
  createBranch,
  deleteBranch,
  getCurrentBranch,
  getWorkBranchName,
  findGitRoot,
  getWorkWorktreePath,
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
  test('returns work-<slug>-<id> format (hyphens, no slashes)', () => {
    expect(getWorkBranchName('a1b2', 'User Authentication')).toBe('work-user-authentication-a1b2');
    expect(getWorkBranchName('test', 'My Feature')).toBe('work-my-feature-test');
  });

  test('handles special characters in title', () => {
    expect(getWorkBranchName('abc1', 'Add OAuth 2.0 Support!')).toBe('work-add-oauth-2-0-support-abc1');
  });

  test('truncates long titles to 30 chars', () => {
    const longTitle = 'This is a very long title that exceeds thirty characters';
    const result = getWorkBranchName('xyz9', longTitle);
    expect(result).toBe('work-this-is-a-very-long-title-that-xyz9');
  });

  test('handles empty title with untitled fallback', () => {
    expect(getWorkBranchName('a1b2', '')).toBe('work-untitled-a1b2');
  });

  test('handles all-special-character title with untitled fallback', () => {
    expect(getWorkBranchName('a1b2', '!@#$%')).toBe('work-untitled-a1b2');
  });

  test('handles whitespace-only title with untitled fallback', () => {
    expect(getWorkBranchName('a1b2', '   ')).toBe('work-untitled-a1b2');
  });

  test('handles single character title', () => {
    expect(getWorkBranchName('a1b2', 'a')).toBe('work-a-a1b2');
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

describe('findGitRoot', () => {
  test('returns a non-empty string', async () => {
    const gitRoot = await findGitRoot();
    expect(typeof gitRoot).toBe('string');
    expect(gitRoot.length).toBeGreaterThan(0);
  });

  test('returned path is absolute', async () => {
    const gitRoot = await findGitRoot();
    expect(resolve(gitRoot)).toBe(gitRoot);
  });

  test('contains .git directory or file', async () => {
    const gitRoot = await findGitRoot();
    const gitPath = resolve(gitRoot, '.git');
    const file = Bun.file(gitPath);
    expect(await file.exists()).toBe(true);
  });
});

describe('getWorkWorktreePath', () => {
  test('returns absolute path with slug and id', async () => {
    const path = await getWorkWorktreePath('a1b2', 'User Auth');
    expect(resolve(path)).toBe(path);
    expect(path).toContain('work-user-auth-a1b2');
  });

  test('handles empty title with untitled fallback', async () => {
    const path = await getWorkWorktreePath('a1b2', '');
    expect(path).toContain('work-untitled-a1b2');
  });

  test('path is sibling to git root', async () => {
    const gitRoot = await findGitRoot();
    const expectedParent = resolve(gitRoot, '..');
    const path = await getWorkWorktreePath('test-id', 'Test Spec');
    const actualParent = resolve(path, '..');
    expect(actualParent).toBe(expectedParent);
  });

  test('different spec IDs produce different paths', async () => {
    const path1 = await getWorkWorktreePath('a1b2', 'Feature A');
    const path2 = await getWorkWorktreePath('c3d4', 'Feature B');
    expect(path1).not.toBe(path2);
  });

  test('different titles with same ID produce different paths', async () => {
    const path1 = await getWorkWorktreePath('a1b2', 'Feature A');
    const path2 = await getWorkWorktreePath('a1b2', 'Feature B');
    expect(path1).not.toBe(path2);
  });
});
