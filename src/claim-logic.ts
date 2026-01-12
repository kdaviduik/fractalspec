/**
 * Claim and release logic for specs.
 * Uses git branches to track claimed work.
 */

import {
  branchExists,
  createBranch,
  deleteBranch,
  getWorkBranchName,
} from './git-operations';
import { writeSpec } from './spec-filesystem';
import type { Spec, ClaimResult } from './types';

export async function isSpecClaimed(specId: string): Promise<boolean> {
  const branchName = getWorkBranchName(specId);
  return branchExists(branchName);
}

export async function claimSpec(spec: Spec): Promise<ClaimResult> {
  const branchName = getWorkBranchName(spec.id);

  const alreadyClaimed = await isSpecClaimed(spec.id);
  if (alreadyClaimed) {
    return {
      success: false,
      branchName,
      error: `Spec ${spec.id} is already claimed (branch ${branchName} exists)`,
    };
  }

  try {
    await createBranch(branchName);

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

export async function releaseSpec(spec: Spec): Promise<void> {
  const branchName = getWorkBranchName(spec.id);

  const isClaimed = await isSpecClaimed(spec.id);
  if (!isClaimed) {
    throw new Error(`Spec ${spec.id} is not claimed (branch ${branchName} does not exist)`);
  }

  await deleteBranch(branchName);

  const updatedSpec: Spec = {
    ...spec,
    status: 'ready',
  };
  await writeSpec(updatedSpec);
}

export async function completeSpec(spec: Spec): Promise<void> {
  const branchName = getWorkBranchName(spec.id);

  const isClaimed = await isSpecClaimed(spec.id);
  if (!isClaimed) {
    throw new Error(`Spec ${spec.id} is not claimed (branch ${branchName} does not exist)`);
  }

  await deleteBranch(branchName);

  const updatedSpec: Spec = {
    ...spec,
    status: 'closed',
  };
  await writeSpec(updatedSpec);
}
