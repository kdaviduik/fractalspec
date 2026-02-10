/**
 * Claim and release logic for specs.
 * Supports three modes: status-only (default), branch (opt-in via --branch),
 * and worktree (opt-in via --worktree).
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
import type { Spec, ClaimMode, ClaimResult, ClaimOptions } from './types';

export interface SafetyCheckResult {
  safe: boolean;
  issues: string[];
  worktreePath: string;
  branchName: string;
}

/**
 * Runtime detection: we determine whether a spec is claimed by checking git artifacts
 * first (worktree, then branch), then falling back to status. Git artifacts are checked
 * first because they're more specific — status alone can't distinguish "status-only claim"
 * from "branch claim where something went wrong."
 */
export async function isSpecClaimed(spec: Spec): Promise<boolean> {
  const branchName = getWorkBranchName(spec.id, spec.title);
  const worktree = await findWorktreeByBranch(branchName);
  if (worktree) return true;
  if (await branchExists(branchName)) return true;
  return spec.status === 'in_progress';
}

async function resolveClaimMode(options?: ClaimOptions): Promise<ClaimMode> {
  const useBranch = options?.useBranch ?? false;
  const useWorktree = options?.useWorktree ?? false;

  if (useWorktree) return 'worktree';
  if (!useBranch) return 'status_only';

  // bare repo + --branch: auto-escalate to worktree
  const bare = await isBareRepository();
  return bare ? 'worktree' : 'branch';
}

export async function claimSpec(spec: Spec, options?: ClaimOptions): Promise<ClaimResult> {
  const branchName = getWorkBranchName(spec.id, spec.title);

  const alreadyClaimed = await isSpecClaimed(spec);
  if (alreadyClaimed) {
    return {
      success: false,
      mode: 'status_only',
      branchName,
      error: `Spec ${spec.id} is already claimed. Release it first with: sc release ${spec.id}`,
    };
  }

  const mode = await resolveClaimMode(options);

  try {
    switch (mode) {
      case 'worktree': return await claimWithWorktree(spec, branchName);
      case 'branch': return await claimWithBranch(spec, branchName);
      case 'status_only': return await claimStatusOnly(spec, branchName);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      mode: 'status_only',
      branchName,
      error: `Failed to claim spec: ${message}`,
    };
  }
}

async function claimStatusOnly(spec: Spec, branchName: string): Promise<ClaimResult> {
  const updatedSpec: Spec = { ...spec, status: 'in_progress' };
  await writeSpec(updatedSpec);
  return { success: true, mode: 'status_only', branchName };
}

async function claimWithWorktree(spec: Spec, branchName: string): Promise<ClaimResult> {
  const worktreePath = await getWorkWorktreePath(spec.id, spec.title);
  await createWorktree(worktreePath, branchName);

  const updatedSpec: Spec = { ...spec, status: 'in_progress' };
  await writeSpec(updatedSpec);

  return { success: true, mode: 'worktree', branchName, worktreePath };
}

async function claimWithBranch(spec: Spec, branchName: string): Promise<ClaimResult> {
  const gitRoot = await findGitRoot();
  const dirty = await hasUncommittedChanges(gitRoot);
  if (dirty) {
    return {
      success: false,
      mode: 'branch',
      branchName,
      error: 'Working tree has uncommitted changes. Commit or stash them first, or use --worktree for an isolated worktree.',
    };
  }

  await createBranch(branchName);
  await checkoutBranch(branchName);

  const updatedSpec: Spec = { ...spec, status: 'in_progress' };
  await writeSpec(updatedSpec);

  return { success: true, mode: 'branch', branchName };
}

async function cleanupClaim(spec: Spec, newStatus: 'ready' | 'closed', force?: boolean): Promise<void> {
  const branchName = getWorkBranchName(spec.id, spec.title);

  const worktree = await findWorktreeByBranch(branchName);

  if (worktree) {
    await cleanupWorktreeClaim(spec, branchName, worktree.path, newStatus, force);
  } else if (await branchExists(branchName)) {
    await cleanupBranchClaim(spec, branchName, newStatus, force);
  } else {
    // Status-only claim: no git artifacts to clean up, just update status.
    // Guard: if the spec isn't in_progress, something is wrong.
    if (spec.status !== 'in_progress') {
      throw new Error(`Bug: cleanupClaim called on spec ${spec.id} with status '${spec.status}' and no git artifacts`);
    }
    const updatedSpec: Spec = { ...spec, status: newStatus };
    await writeSpec(updatedSpec);
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
 * Handles all three claim modes:
 * - Worktree mode: checks the worktree directory for uncommitted/unpushed/detached
 * - Branch mode: checks unpushed commits via ref comparison (always works).
 *   Only checks uncommitted changes if currently on the work branch.
 * - Status-only mode: checks the current branch for uncommitted changes and
 *   unpushed commits (stewardship: protect users from marking work done when
 *   their changes aren't saved, regardless of whether sc created the branch).
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

  // Status-only claim: check current branch for uncommitted/unpushed work
  const gitRoot = await findGitRoot();
  return checkCurrentBranchSafety(branchName, gitRoot);
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

async function checkCurrentBranchSafety(branchName: string, gitRoot: string): Promise<SafetyCheckResult> {
  const issues: string[] = [];

  if (await hasUncommittedChanges(gitRoot)) {
    issues.push('uncommitted changes');
  }

  if (await hasUnpushedCommits(gitRoot)) {
    issues.push('unpushed commits');
  }

  return { safe: issues.length === 0, issues, worktreePath: gitRoot, branchName };
}
