/**
 * Claim and release logic for specs.
 * Uses git worktrees to track claimed work.
 */

import {
  createWorktree,
  deleteBranch,
  findWorktreeByBranch,
  getCurrentWorktree,
  getWorkBranchName,
  getWorkWorktreePath,
  hasUncommittedChanges,
  hasUnpushedCommits,
  isDetachedHead,
  removeWorktree,
} from './git-operations';
import { writeSpec } from './spec-filesystem';
import type { Spec, ClaimResult } from './types';

export interface SafetyCheckResult {
  safe: boolean;
  issues: string[];
  worktreePath: string;
  branchName: string;
}

export async function isSpecClaimed(spec: Spec): Promise<boolean> {
  const branchName = getWorkBranchName(spec.id, spec.title);
  const worktree = await findWorktreeByBranch(branchName);
  return worktree !== null;
}

export async function claimSpec(spec: Spec): Promise<ClaimResult> {
  const branchName = getWorkBranchName(spec.id, spec.title);
  const worktreePath = await getWorkWorktreePath(spec.id, spec.title);

  const alreadyClaimed = await isSpecClaimed(spec);
  if (alreadyClaimed) {
    return {
      success: false,
      branchName,
      error: `Spec ${spec.id} is already claimed (worktree exists at ${worktreePath})`,
    };
  }

  try {
    await createWorktree(worktreePath, branchName);

    const updatedSpec: Spec = {
      ...spec,
      status: 'in_progress',
    };
    await writeSpec(updatedSpec);

    return {
      success: true,
      branchName,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      branchName,
      error: `Failed to claim spec: ${message}`,
    };
  }
}

async function cleanupClaim(spec: Spec, newStatus: 'ready' | 'closed'): Promise<void> {
  const branchName = getWorkBranchName(spec.id, spec.title);
  const worktreePath = await getWorkWorktreePath(spec.id, spec.title);

  const worktree = await findWorktreeByBranch(branchName);
  if (!worktree) {
    throw new Error(`Spec ${spec.id} is not claimed (no worktree found)`);
  }

  const currentWorktree = await getCurrentWorktree();
  const isInsideWorkWorktree = currentWorktree?.path === worktree.path;

  if (isInsideWorkWorktree) {
    await deleteBranch(branchName);

    const updatedSpec: Spec = {
      ...spec,
      status: newStatus,
    };
    await writeSpec(updatedSpec);

    console.log(`\nNote: Cannot remove worktree from inside it.`);
    console.log(`To clean up from outside this directory, run: rm -rf ${worktreePath}`);
  } else {
    await removeWorktree(worktreePath);
    await deleteBranch(branchName);

    const updatedSpec: Spec = {
      ...spec,
      status: newStatus,
    };
    await writeSpec(updatedSpec);
  }
}

export async function releaseSpec(spec: Spec): Promise<void> {
  await cleanupClaim(spec, 'ready');
}

export async function completeSpec(spec: Spec): Promise<void> {
  await cleanupClaim(spec, 'closed');
}

/**
 * Check if it's safe to release or complete a spec.
 * Returns issues if there are uncommitted changes or unpushed commits.
 *
 * If worktree doesn't exist (already cleaned up manually), returns safe=true.
 */
export async function checkClaimSafety(spec: Spec): Promise<SafetyCheckResult> {
  const branchName = getWorkBranchName(spec.id, spec.title);
  const worktreePath = await getWorkWorktreePath(spec.id, spec.title);
  const issues: string[] = [];

  const worktree = await findWorktreeByBranch(branchName);
  if (!worktree) {
    return { safe: true, issues: [], worktreePath, branchName };
  }

  const detached = await isDetachedHead(worktreePath);
  if (detached) {
    issues.push('detached HEAD state');
    return { safe: false, issues, worktreePath, branchName };
  }

  const uncommitted = await hasUncommittedChanges(worktreePath);
  if (uncommitted) {
    issues.push('uncommitted changes');
  }

  const unpushed = await hasUnpushedCommits(worktreePath);
  if (unpushed) {
    issues.push('unpushed commits');
  }

  return {
    safe: issues.length === 0,
    issues,
    worktreePath,
    branchName,
  };
}
