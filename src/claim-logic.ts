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
  removeWorktree,
} from './git-operations';
import { writeSpec } from './spec-filesystem';
import type { Spec, ClaimResult } from './types';

export async function isSpecClaimed(specId: string): Promise<boolean> {
  const branchName = getWorkBranchName(specId);
  const worktree = await findWorktreeByBranch(branchName);
  return worktree !== null;
}

export async function claimSpec(spec: Spec): Promise<ClaimResult> {
  const branchName = getWorkBranchName(spec.id);
  const worktreePath = await getWorkWorktreePath(spec.id);

  const alreadyClaimed = await isSpecClaimed(spec.id);
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
  const branchName = getWorkBranchName(spec.id);
  const worktreePath = await getWorkWorktreePath(spec.id);

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
    console.log(`To clean up, run: cd ../main && rm -rf ${worktreePath}`);
  } else {
    await removeWorktree(worktreePath);

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
