/**
 * Git branch operations for spec claiming.
 */

export class GitError extends Error {
  constructor(
    message: string,
    public readonly stderr: string
  ) {
    super(message);
    this.name = 'GitError';
  }
}

async function runGit(args: string[]): Promise<string> {
  const proc = Bun.spawn(['git', ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new GitError(`git ${args[0]} failed: ${stderr.trim()}`, stderr);
  }

  return stdout.trim();
}

export function getWorkBranchName(specId: string): string {
  return `work/${specId}`;
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
