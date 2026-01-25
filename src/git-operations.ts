/**
 * Git branch and worktree operations for spec claiming.
 */

import { resolve } from 'path';

const GIT_COMMAND_TIMEOUT_MS = 10_000;

export class GitError extends Error {
  constructor(
    message: string,
    public readonly stderr: string
  ) {
    super(message);
    this.name = 'GitError';
  }
}

export class GitTimeoutError extends Error {
  constructor(command: string) {
    super(`Git command timed out after ${GIT_COMMAND_TIMEOUT_MS}ms: git ${command}`);
    this.name = 'GitTimeoutError';
  }
}

interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  isBare: boolean;
}

interface RunGitOptions {
  cwd?: string;
  timeoutMs?: number;
}

async function runGit(args: string[], options: RunGitOptions = {}): Promise<string> {
  const { cwd, timeoutMs = GIT_COMMAND_TIMEOUT_MS } = options;

  const spawnOptions = cwd
    ? { stdout: 'pipe' as const, stderr: 'pipe' as const, cwd }
    : { stdout: 'pipe' as const, stderr: 'pipe' as const };

  const proc = Bun.spawn(['git', ...args], spawnOptions);

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      proc.kill();
      reject(new GitTimeoutError(args[0] ?? 'unknown'));
    }, timeoutMs);
  });

  const resultPromise = (async () => {
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new GitError(`git ${args[0]} failed: ${stderr.trim()}`, stderr);
    }

    return stdout.trim();
  })();

  try {
    const result = await Promise.race([resultPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

let cachedGitRoot: string | null = null;

export async function findGitRoot(): Promise<string> {
  if (cachedGitRoot) return cachedGitRoot;
  const gitRoot = await runGit(['rev-parse', '--show-toplevel']);
  cachedGitRoot = gitRoot;
  return cachedGitRoot;
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
  return slug || 'untitled';
}

export function getWorkBranchName(specId: string, title: string): string {
  const slug = slugify(title);
  return `work-${slug}-${specId}`;
}

export async function getCurrentBranch(): Promise<string> {
  return runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
}

export async function branchExists(branchName: string): Promise<boolean> {
  try {
    await runGit(['rev-parse', '--verify', `refs/heads/${branchName}`]);
    return true;
  } catch {
    return false;
  }
}

export async function createBranch(branchName: string): Promise<void> {
  const exists = await branchExists(branchName);
  if (exists) {
    throw new GitError(`Branch ${branchName} already exists`, '');
  }

  await runGit(['branch', branchName]);
}

export async function deleteBranch(branchName: string): Promise<void> {
  const exists = await branchExists(branchName);
  if (!exists) {
    throw new GitError(`Branch ${branchName} does not exist`, '');
  }

  await runGit(['branch', '-D', branchName]);
}

export async function checkoutBranch(branchName: string): Promise<void> {
  await runGit(['checkout', branchName]);
}

export async function mergeBranch(branchName: string): Promise<void> {
  await runGit(['merge', branchName, '--no-ff', '-m', `Merge ${branchName}`]);
}

async function listWorktrees(): Promise<WorktreeInfo[]> {
  const output = await runGit(['worktree', 'list', '--porcelain']);
  const worktrees: WorktreeInfo[] = [];

  const lines = output.split('\n');
  let currentWorktree: Partial<WorktreeInfo> = {};

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      currentWorktree.path = line.substring('worktree '.length);
    } else if (line.startsWith('HEAD ')) {
      currentWorktree.head = line.substring('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.substring('branch refs/heads/'.length);
    } else if (line === 'bare') {
      currentWorktree.isBare = true;
    } else if (line === '') {
      if (currentWorktree.path && currentWorktree.head) {
        worktrees.push({
          path: currentWorktree.path,
          branch: currentWorktree.branch ?? '',
          head: currentWorktree.head,
          isBare: currentWorktree.isBare ?? false,
        });
      }
      currentWorktree = {};
    }
  }

  // Handle final worktree entry (no trailing empty line after trim())
  if (currentWorktree.path && currentWorktree.head) {
    worktrees.push({
      path: currentWorktree.path,
      branch: currentWorktree.branch ?? '',
      head: currentWorktree.head,
      isBare: currentWorktree.isBare ?? false,
    });
  }

  return worktrees;
}

export async function getCurrentWorktree(): Promise<WorktreeInfo | null> {
  const cwd = process.cwd();
  const worktrees = await listWorktrees();

  for (const worktree of worktrees) {
    const resolvedPath = resolve(worktree.path);
    if (cwd.startsWith(resolvedPath)) {
      return worktree;
    }
  }

  return null;
}

export async function findWorktreeByBranch(branch: string): Promise<WorktreeInfo | null> {
  const worktrees = await listWorktrees();
  return worktrees.find(w => w.branch === branch) ?? null;
}

export async function createWorktree(path: string, branch: string): Promise<void> {
  await runGit(['worktree', 'add', path, '-b', branch]);
}

export async function removeWorktree(path: string, force?: boolean): Promise<void> {
  const args = ['worktree', 'remove', path];
  if (force) {
    args.push('--force');
  }
  await runGit(args);
}

export async function getWorkWorktreePath(specId: string, title: string): Promise<string> {
  const slug = slugify(title);
  const gitRoot = await findGitRoot();
  return resolve(gitRoot, '..', `work-${slug}-${specId}`);
}

/**
 * Check if the worktree has uncommitted changes (staged, unstaged, or untracked files).
 * Returns true if there are any changes that would be lost on branch deletion.
 */
export async function hasUncommittedChanges(worktreePath: string): Promise<boolean> {
  try {
    const status = await runGit(['status', '--porcelain'], { cwd: worktreePath });
    return status.length > 0;
  } catch (error) {
    if (error instanceof GitTimeoutError) {
      throw error;
    }
    return true;
  }
}

/**
 * Check if the branch has commits that haven't been pushed to the remote tracking branch.
 * Returns true if there are unpushed commits OR if there's no upstream configured (fail-safe).
 *
 * Uses local tracking refs only - does not contact remote server.
 */
export async function hasUnpushedCommits(worktreePath: string): Promise<boolean> {
  try {
    const headRef = await runGit(['symbolic-ref', '-q', 'HEAD'], { cwd: worktreePath });
    if (!headRef) {
      return true;
    }

    try {
      await runGit(['rev-parse', '--verify', '@{upstream}'], { cwd: worktreePath });
    } catch {
      return true;
    }

    const unpushed = await runGit(['rev-list', '@{upstream}..HEAD', '--count'], { cwd: worktreePath });
    return parseInt(unpushed, 10) > 0;
  } catch (error) {
    if (error instanceof GitTimeoutError) {
      throw error;
    }
    return true;
  }
}

/**
 * Check if the worktree is in a detached HEAD state.
 * Returns true if detached or if the worktree doesn't exist (fail-safe).
 */
export async function isDetachedHead(worktreePath: string): Promise<boolean> {
  try {
    await runGit(['symbolic-ref', '-q', 'HEAD'], { cwd: worktreePath });
    return false;
  } catch (error) {
    if (error instanceof GitTimeoutError) {
      throw error;
    }
    return true;
  }
}
