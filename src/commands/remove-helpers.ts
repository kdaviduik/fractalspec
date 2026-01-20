/**
 * Helper functions for the remove command.
 * Handles validation, reparenting, and cascade deletion logic.
 */

import { rename } from 'fs/promises';
import { dirname, join, basename } from 'path';
import type { Spec } from '../types';
import { deleteSpec, getSpecsRoot, writeSpec } from '../spec-filesystem';
import { isSpecClaimed } from '../claim-logic';

export interface ValidationResult {
  isClaimed: boolean;
  childrenClaimed: string[];
  dependents: Spec[];
  children: Spec[];
  canRemove: boolean;
  reasons: string[];
}

export interface CascadeValidationResult {
  descendants: Spec[];
  externalDependents: Map<string, string[]>;
  canCascade: boolean;
}

export async function validateRemovalPreconditions(
  spec: Spec,
  allSpecs: Spec[]
): Promise<ValidationResult> {
  const reasons: string[] = [];
  const isClaimed = await isSpecClaimed(spec.id);
  const dependents = allSpecs.filter((s) => s.blocks.includes(spec.id));
  const children = allSpecs.filter((s) => s.parent === spec.id);

  const childrenClaimed: string[] = [];
  for (const child of children) {
    const claimed = await isSpecClaimed(child.id);
    if (claimed) {
      childrenClaimed.push(child.id);
    }
  }

  if (isClaimed) {
    reasons.push(`Spec ${spec.id} is claimed`);
  }

  if (childrenClaimed.length > 0) {
    reasons.push(`Child spec(s) claimed: ${childrenClaimed.join(', ')}`);
  }

  if (dependents.length > 0) {
    const ids = dependents.map((d) => d.id).join(', ');
    reasons.push(`Depended upon by: ${ids}`);
  }

  return { isClaimed, childrenClaimed, dependents, children, canRemove: reasons.length === 0, reasons };
}

export function isDescendantOf(potentialDescendant: Spec, ancestor: Spec, allSpecs: Spec[]): boolean {
  let current = potentialDescendant;
  while (current.parent !== null) {
    if (current.parent === ancestor.id) return true;
    const parent = allSpecs.find((s) => s.id === current.parent);
    if (!parent) return false;
    current = parent;
  }
  return false;
}

export function validateCascadeDeletion(spec: Spec, allSpecs: Spec[]): CascadeValidationResult {
  const descendants: Spec[] = [];
  const descendantIds = new Set<string>();

  const collectDescendants = (parentId: string) => {
    const directChildren = allSpecs.filter((s) => s.parent === parentId);
    for (const child of directChildren) {
      descendants.push(child);
      descendantIds.add(child.id);
      collectDescendants(child.id);
    }
  };

  descendantIds.add(spec.id);
  collectDescendants(spec.id);

  const externalDependents = new Map<string, string[]>();
  for (const descendant of [spec, ...descendants]) {
    const deps = allSpecs.filter(
      (s) => s.blocks.includes(descendant.id) && !descendantIds.has(s.id)
    );
    if (deps.length > 0) {
      externalDependents.set(descendant.id, deps.map((d) => d.id));
    }
  }

  return { descendants, externalDependents, canCascade: externalDependents.size === 0 };
}

export async function reparentChildren(
  children: Spec[],
  newParentId: string | null,
  allSpecs: Spec[]
): Promise<void> {
  if (children.length === 0) return;

  if (newParentId !== null) {
    const newParent = allSpecs.find((s) => s.id === newParentId);
    if (!newParent) {
      throw new Error(`Parent ID '${newParentId}' not found`);
    }
  }

  const specsRoot = await getSpecsRoot();
  let newBasePath: string;

  if (newParentId === null) {
    newBasePath = specsRoot;
  } else {
    const newParent = allSpecs.find((s) => s.id === newParentId);
    if (!newParent) {
      throw new Error(`Parent ID '${newParentId}' not found`);
    }
    newBasePath = dirname(newParent.filePath);
  }

  const moves: Array<{ child: Spec; oldPath: string; newPath: string }> = [];

  for (const child of children) {
    const oldDirPath = dirname(child.filePath);
    const dirName = basename(oldDirPath);
    const newDirPath = join(newBasePath, dirName);
    moves.push({ child, oldPath: oldDirPath, newPath: newDirPath });
  }

  for (const move of moves) {
    try {
      await rename(move.oldPath, move.newPath);
      const newFilePath = join(move.newPath, basename(move.child.filePath));
      const updatedChild: Spec = { ...move.child, parent: newParentId, filePath: newFilePath };
      await writeSpec(updatedChild);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const failedIndex = moves.indexOf(move);
      const completed = moves.slice(0, failedIndex).map((m) => m.child.id);
      const failed = moves.slice(failedIndex).map((m) => m.child.id);
      throw new Error(
        `Failed to reparent child ${move.child.id}: ${message}\n` +
        `Completed: ${completed.join(', ') || 'none'}\n` +
        `Failed: ${failed.join(', ')}`
      );
    }
  }
}

export async function cascadeDelete(spec: Spec, allSpecs: Spec[]): Promise<string[]> {
  const toDelete: Spec[] = [];

  const collectDescendants = (parentId: string) => {
    const directChildren = allSpecs.filter((s) => s.parent === parentId);
    for (const child of directChildren) {
      collectDescendants(child.id);
      toDelete.push(child);
    }
  };

  collectDescendants(spec.id);
  toDelete.push(spec);

  const deleted: string[] = [];
  const failed: string[] = [];

  for (const specToDelete of toDelete) {
    try {
      await deleteSpec(specToDelete);
      deleted.push(specToDelete.id);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      failed.push(`${specToDelete.id} (${reason})`);
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `Deleted ${deleted.join(', ')}, failed to delete ${failed.join(', ')}. ` +
      `Recover via 'sc doctor --fix' or git.`
    );
  }

  return deleted;
}

export async function confirmDeletion(
  spec: Spec,
  children: Spec[],
  newParentId: string | null,
  cascade: boolean,
  descendants: Spec[]
): Promise<boolean> {
  console.log('\n⚠️  PERMANENT DELETION\n');

  if (cascade) {
    const allToDelete = [spec, ...descendants];
    console.log(`This will DELETE ${allToDelete.length} spec${allToDelete.length === 1 ? '' : 's'}:`);
    for (const s of allToDelete) {
      console.log(`  - ${s.id} - ${s.title}`);
    }
  } else {
    console.log('Spec to remove:');
    console.log(`  ${spec.id} - ${spec.title}`);

    if (children.length > 0) {
      if (newParentId === null) {
        console.log('\nChildren (will become root-level specs):');
      } else {
        console.log(`\nChildren (will be reparented to ${newParentId}):`);
      }
      for (const child of children) {
        console.log(`  - ${child.id} - ${child.title}`);
      }
      console.log('\nNote: Directories will be relocated');
    }
  }

  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  return new Promise((resolve) => {
    rl.question('\nType capital \'Y\' to confirm deletion: ', (answer) => {
      rl.close();
      resolve(answer === 'Y');
    });
  });
}
