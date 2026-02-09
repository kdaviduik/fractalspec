/**
 * Claim and release logic for specs.
 * Supports two modes: branch-only (default) and worktree (opt-in via --worktree).
 */

import {
  branchExists,
  checkoutBranch,
  createBranch,
  createWorktree,
  deleteBranch,
  findGitRoot,
  findWorktreeByBranch,
  getDefaultBranch,
  getCurrentBranch,
  getCurrentWorktree,
  getWorkBranchName,
  getWorkWorktreePath,
  hasUncommittedChanges,
  hasUnmergedCommits,
  hasUnpushedCommits,
  isBareRepository,
  isDetachedHead,
  removeWorktree,
} from './git-operations';
import { writeSpec } from './spec-filesystem';
import type { Spec, ClaimResult, ClaimOptions } from './types';

export interface SafetyCheckResult {
  safe: boolean;
  issues: string[];
  worktreePath: string;
  branchName: string;
}

/**
 * Runtime detection: we determine the claim mode by checking if a worktree exists
 * for the work branch. If yes, it was claimed in worktree mode. If only the branch
 * exists, it was claimed in branch-only mode. This avoids storing mode in the spec
 * frontmatter. Assumption: worktrees matching the work-<slug>-<id> naming convention
 * are created by sc claim, not by external tools.
 */
export async function isSpecClaimed(spec: Spec): Promise<boolean> {
  const branchName = getWorkBranchName(spec.id, spec.title);
  const worktree = await findWorktreeByBranch(branchName);
  if (worktree) return true;
  return branchExists(branchName);
}

export async function claimSpec(spec: Spec, options?: ClaimOptions): Promise<ClaimResult> {
  const branchName = getWorkBranchName(spec.id, spec.title);

  const alreadyClaimed = await isSpecClaimed(spec);
  if (alreadyClaimed) {
    return {
      success: false,
      branchName,
      error: `Spec ${spec.id} is already claimed. Release it first with: sc release ${spec.id}`,
    };
  }

  let useWorktree = options?.useWorktree ?? false;

  if (!useWorktree) {
    const bare = await isBareRepository();
    if (bare) {
      useWorktree = true;
    }
  }

  try {
    if (useWorktree) {
      return await claimWithWorktree(spec, branchName);
    }
    return await claimWithBranch(spec, branchName);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      branchName,
      error: `Failed to claim spec: ${message}`,
    };
  }
}

async function claimWithWorktree(spec: Spec, branchName: string): Promise<ClaimResult> {
  const worktreePath = await getWorkWorktreePath(spec.id, spec.title);
  await createWorktree(worktreePath, branchName);

  const updatedSpec: Spec = { ...spec, status: 'in_progress' };
  await writeSpec(updatedSpec);

  return { success: true, branchName, worktreePath };
}

async function claimWithBranch(spec: Spec, branchName: string): Promise<ClaimResult> {
  const gitRoot = await findGitRoot();
  const dirty = await hasUncommittedChanges(gitRoot);
  if (dirty) {
    return {
      success: false,
      branchName,
      error: 'Working tree has uncommitted changes. Commit or stash them first, or use --worktree for an isolated worktree.',
    };
  }

  await createBranch(branchName);
  await checkoutBranch(branchName);

  const updatedSpec: Spec = { ...spec, status: 'in_progress' };
  await writeSpec(updatedSpec);

  return { success: true, branchName };
}

async function cleanupClaim(spec: Spec, newStatus: 'ready' | 'closed', force?: boolean): Promise<void> {
  const branchName = getWorkBranchName(spec.id, spec.title);

  const worktree = await findWorktreeByBranch(branchName);

  if (worktree) {
    await cleanupWorktreeClaim(spec, branchName, worktree.path, newStatus, force);
  } else if (await branchExists(branchName)) {
    await cleanupBranchClaim(spec, branchName, newStatus, force);
  } else {
    throw new Error(`Spec ${spec.id} is not claimed (no worktree or branch found)`);
  }
}

async function cleanupWorktreeClaim(
  spec: Spec,
  branchName: string,
  worktreePath: string,
  newStatus: 'ready' | 'closed',
  force?: boolean,
): Promise<void> {
  // Write status first — spec state is the source of truth.
  // If git cleanup fails after this, the user has a stale worktree/branch but correct spec status.
  const updatedSpec: Spec = { ...spec, status: newStatus };
  await writeSpec(updatedSpec);

  const currentWorktree = await getCurrentWorktree();
  const isInsideWorkWorktree = currentWorktree?.path === worktreePath;
  let worktreeRemoved = false;

  if (isInsideWorkWorktree) {
    if (force) {
      try {
        await removeWorktree(worktreePath, true);
        worktreeRemoved = true;
      } catch {
        console.log(`\nNote: Cannot remove worktree from inside it.`);
        console.log(`To clean up from outside this directory, run:`);
        console.log(`  rm -rf ${worktreePath}`);
        console.log(`  git branch -D ${branchName}`);
      }
    } else {
      console.log(`\nNote: Cannot remove worktree from inside it.`);
      console.log(`To clean up from outside this directory, run:`);
      console.log(`  rm -rf ${worktreePath}`);
      console.log(`  git branch -D ${branchName}`);
    }
  } else {
    await removeWorktree(worktreePath, force);
    worktreeRemoved = true;
  }

  // Only delete branch if worktree was successfully removed.
  // Deleting a branch that a worktree still references puts git in an inconsistent state.
  if (worktreeRemoved) {
    await deleteBranch(branchName);
  }
}

async function cleanupBranchClaim(
  spec: Spec,
  branchName: string,
  newStatus: 'ready' | 'closed',
  force?: boolean,
): Promise<void> {
  // Write status first — spec state is the source of truth.
  // If git cleanup fails after this, the user has a stale branch but correct spec status.
  const updatedSpec: Spec = { ...spec, status: newStatus };
  await writeSpec(updatedSpec);

  const currentBranch = await getCurrentBranch();

  if (currentBranch === branchName) {
    const defaultBranch = await getDefaultBranch();
    await checkoutBranch(defaultBranch, force);
  }

  await deleteBranch(branchName);
}

export async function releaseSpec(spec: Spec, force?: boolean): Promise<void> {
  await cleanupClaim(spec, 'ready', force);
}

export async function completeSpec(spec: Spec, force?: boolean): Promise<void> {
  await cleanupClaim(spec, 'closed', force);
}

/**
 * Check if it's safe to release or complete a spec.
 * Returns issues if there are uncommitted changes or unpushed commits.
 *
 * Handles both worktree and branch-only modes:
 * - Worktree mode: checks the worktree directory for uncommitted/unpushed/detached
 * - Branch-only mode: checks unpushed commits via ref comparison (always works).
 *   Only checks uncommitted changes if currently on the work branch.
 * - Neither exists: returns safe=true (already cleaned up manually)
 */
export async function checkClaimSafety(spec: Spec): Promise<SafetyCheckResult> {
  const branchName = getWorkBranchName(spec.id, spec.title);
  const worktreePath = await getWorkWorktreePath(spec.id, spec.title);

  const worktree = await findWorktreeByBranch(branchName);
  if (worktree) {
    return checkWorktreeSafety(branchName, worktreePath);
  }

  if (await branchExists(branchName)) {
    return checkBranchSafety(branchName);
  }

  return { safe: true, issues: [], worktreePath, branchName };
}

async function checkWorktreeSafety(branchName: string, worktreePath: string): Promise<SafetyCheckResult> {
  const issues: string[] = [];

  const detached = await isDetachedHead(worktreePath);
  if (detached) {
    return { safe: false, issues: ['detached HEAD state'], worktreePath, branchName };
  }

  if (await hasUncommittedChanges(worktreePath)) {
    issues.push('uncommitted changes');
  }

  if (await hasUnpushedCommits(worktreePath)) {
    issues.push('unpushed commits');
  }

  return { safe: issues.length === 0, issues, worktreePath, branchName };
}

async function checkBranchSafety(branchName: string): Promise<SafetyCheckResult> {
  const issues: string[] = [];
  const gitRoot = await findGitRoot();

  const currentBranch = await getCurrentBranch();
  if (currentBranch === branchName) {
    if (await hasUncommittedChanges(gitRoot)) {
      issues.push('uncommitted changes');
    }
  }

  try {
    const defaultBranch = await getDefaultBranch();
    if (await hasUnmergedCommits(branchName, defaultBranch)) {
      issues.push('unpushed commits');
    }
  } catch {
    issues.push('unpushed commits');
  }

  return { safe: issues.length === 0, issues, worktreePath: gitRoot, branchName };
}
