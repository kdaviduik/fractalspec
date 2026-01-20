/**
 * Remove command - permanently delete specs.
 * Handles child reparenting, cascade deletion, and safety validations.
 */

import type { CommandHandler, Spec } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFile, readAllSpecs, deleteSpec } from '../spec-filesystem';
import {
  validateRemovalPreconditions,
  validateCascadeDeletion,
  isDescendantOf,
  reparentChildren,
  cascadeDelete,
  confirmDeletion,
  type ValidationResult,
} from './remove-helpers';

interface RemoveArgs {
  idArg: string | undefined;
  cascade: boolean;
  reparentId: string | null;
  dryRun: boolean;
}

function parseRemoveArgs(args: string[]): RemoveArgs {
  return {
    idArg: args.find((a) => !a.startsWith('--')),
    cascade: args.includes('--cascade'),
    reparentId: (() => {
      const idx = args.indexOf('--reparent');
      return idx !== -1 ? args[idx + 1] || null : null;
    })(),
    dryRun: args.includes('--dry-run'),
  };
}

function handlePreconditionErrors(validation: ValidationResult, spec: Spec): void {
  for (const reason of validation.reasons) {
    if (reason.startsWith('Spec') && reason.includes('is claimed')) {
      console.error(`Error: Spec is claimed. Run 'sc release ${spec.id}' or 'sc done ${spec.id}' first.`);
    } else if (reason.startsWith('Child spec')) {
      console.error(`Error: Cannot remove: ${reason}. Release children first.`);
    } else if (reason.startsWith('Depended upon')) {
      console.error(`Error: Cannot remove ${spec.id}: ${reason}. Remove dependents first or check with 'sc deps list ${spec.id}'.`);
    }
  }
}

function performDryRun(
  cascade: boolean,
  spec: Spec,
  descendantsToDelete: Spec[],
  validation: ValidationResult,
  newParentId: string | null
): void {
  console.log('\n[DRY RUN] Would perform the following actions:\n');

  if (cascade) {
    const allToDelete = [spec, ...descendantsToDelete];
    console.log(`DELETE ${allToDelete.length} spec${allToDelete.length === 1 ? '' : 's'}:`);
    for (const s of allToDelete) {
      console.log(`  - ${s.id} - ${s.title}`);
    }
  } else {
    console.log(`DELETE spec: ${spec.id} - ${spec.title}`);

    if (validation.children.length > 0) {
      if (newParentId === null) {
        console.log('\nREPARENT children to root (parent: null):');
      } else {
        console.log(`\nREPARENT children to ${newParentId}:`);
      }
      for (const child of validation.children) {
        console.log(`  - ${child.id} - ${child.title}`);
      }
    }
  }

  console.log('\nNo changes made (dry run).');
}

async function executeRemoval(
  cascade: boolean,
  spec: Spec,
  validation: ValidationResult,
  newParentId: string | null,
  allSpecs: Spec[]
): Promise<void> {
  if (cascade) {
    const deleted = await cascadeDelete(spec, allSpecs);
    console.log(`\n✓ Successfully deleted ${deleted.length} spec${deleted.length === 1 ? '' : 's'}: ${deleted.join(', ')}`);
  } else {
    if (validation.children.length > 0) {
      await reparentChildren(validation.children, newParentId, allSpecs);

      if (newParentId === null) {
        console.log(`\n✓ Reparented ${validation.children.length} child${validation.children.length === 1 ? '' : 'ren'} to root`);
      } else {
        console.log(`\n✓ Reparented ${validation.children.length} child${validation.children.length === 1 ? '' : 'ren'} to ${newParentId}`);
      }
    }

    await deleteSpec(spec);
    console.log(`✓ Deleted spec ${spec.id}`);
  }
}

interface DeletionPlan {
  descendantsToDelete: Spec[];
  newParentId: string | null;
  valid: boolean;
  error?: string;
}

function planDeletion(
  parsedArgs: RemoveArgs,
  spec: Spec,
  allSpecs: Spec[]
): DeletionPlan {
  if (parsedArgs.cascade) {
    const cascadeValidation = validateCascadeDeletion(spec, allSpecs);
    if (!cascadeValidation.canCascade) {
      return { descendantsToDelete: [], newParentId: null, valid: false, error: 'cascade' };
    }
    return { descendantsToDelete: cascadeValidation.descendants, newParentId: null, valid: true };
  }

  if (parsedArgs.reparentId !== null) {
    const targetParent = allSpecs.find((s) => s.id === parsedArgs.reparentId);
    if (!targetParent) {
      return { descendantsToDelete: [], newParentId: null, valid: false, error: `Parent ID '${parsedArgs.reparentId}' not found` };
    }
    if (isDescendantOf(targetParent, spec, allSpecs)) {
      return { descendantsToDelete: [], newParentId: null, valid: false, error: `Cannot reparent to '${parsedArgs.reparentId}': it is a descendant of '${spec.id}'` };
    }
    return { descendantsToDelete: [], newParentId: parsedArgs.reparentId, valid: true };
  }

  return { descendantsToDelete: [], newParentId: spec.parent, valid: true };
}

function handlePlanError(plan: DeletionPlan, spec: Spec, allSpecs: Spec[]): void {
  if (plan.error === 'cascade') {
    const cascadeValidation = validateCascadeDeletion(spec, allSpecs);
    console.error('Error: Cannot cascade delete:');
    for (const [childId, dependentIds] of cascadeValidation.externalDependents) {
      console.error(`  - ${childId} is depended upon by ${dependentIds.join(', ')}`);
    }
  } else {
    console.error(`Error: ${plan.error}`);
  }
}

async function performRemoval(
  parsedArgs: RemoveArgs,
  spec: Spec,
  validation: ValidationResult,
  plan: DeletionPlan
): Promise<boolean> {
  if (parsedArgs.dryRun) {
    performDryRun(parsedArgs.cascade, spec, plan.descendantsToDelete, validation, plan.newParentId);
    return true;
  }

  return await confirmDeletion(
    spec,
    validation.children,
    plan.newParentId,
    parsedArgs.cascade,
    plan.descendantsToDelete
  );
}

function validateArgs(
  parsedArgs: RemoveArgs,
  helpFn: (() => CommandHelp) | undefined
): { valid: boolean; errorCode?: number } {
  if (!parsedArgs.idArg || !helpFn) {
    if (helpFn) {
      printCommandUsage(helpFn());
    }
    return { valid: false, errorCode: 1 };
  }

  if (parsedArgs.cascade && parsedArgs.reparentId !== null) {
    console.error('Error: Flags --cascade and --reparent are mutually exclusive');
    return { valid: false, errorCode: 1 };
  }

  return { valid: true };
}

export const command: CommandHandler = {
  name: 'remove',
  description: 'Permanently delete a spec (UNRECOVERABLE - always requires confirmation)',

  getHelp(): CommandHelp {
    return {
      name: 'sc remove',
      synopsis: 'sc remove <id> [--cascade | --reparent <parent-id>] [--dry-run]',
      description: `Permanently delete a spec from the filesystem. This operation:
  - Deletes the entire spec directory and its contents
  - ALWAYS requires explicit confirmation (type capital 'Y') - no bypass flag
  - Cannot be undone (specs live outside git tracking in bare repository)

Preconditions:
  - Spec must NOT be claimed (no active worktree)
  - No other specs can depend on it (no specs have this ID in their blocks array)

Child handling:
  - Default: Reparents children to parent's parent (up one level). If removing a root
    spec, children become root-level specs (parent: null).
  - --cascade: Recursively deletes all descendants. Fails if any descendant is depended
    upon by specs outside the subtree.
  - --reparent <id>: Moves children to specified parent before deletion`,

      flags: [
        {
          flag: '--cascade',
          description: 'Recursively delete all child specs (destructive)',
        },
        {
          flag: '--reparent <parent-id>',
          description: 'Move children to specified parent before deletion',
        },
        {
          flag: '--dry-run',
          description: 'Show what would be deleted without actually deleting',
        },
      ],

      examples: [
        '# Check dependencies, remove leaf spec',
        'sc deps list a1b2c3',
        'sc remove a1b2c3',
        '',
        '# Remove parent (children promoted up one level)',
        'sc remove abc123',
        '',
        '# Remove parent, reparent children',
        'sc remove abc123 --reparent xyz789',
        '',
        '# Remove entire subtree',
        'sc remove abc123 --cascade',
        '',
        '# Preview deletion',
        'sc remove abc123 --dry-run',
      ],

      notes: [
        'Confirmation prompt ALWAYS required - requires capital \'Y\' (not \'y\', \'yes\', or Enter)',
        'Operation is PERMANENT and UNRECOVERABLE - specs live outside git tracking',
        'If spec is claimed, run `sc release <id>` or `sc done <id>` first',
        'Check dependencies before removal: `sc deps list <id>`',
        'Use `sc list --tree` to visualize hierarchy before removing parents',
        'Partial failures leave inconsistent state; recover with `sc doctor --fix`',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const parsedArgs = parseRemoveArgs(args);

    const argsValidation = validateArgs(parsedArgs, this.getHelp);
    if (!argsValidation.valid || !parsedArgs.idArg) {
      return argsValidation.errorCode || 1;
    }

    const spec = await findSpecFile(parsedArgs.idArg);
    if (!spec) {
      console.error(`Error: Spec '${parsedArgs.idArg}' not found`);
      return 1;
    }

    const allSpecs = await readAllSpecs();
    const validation = await validateRemovalPreconditions(spec, allSpecs);

    if (!validation.canRemove) {
      handlePreconditionErrors(validation, spec);
      return 1;
    }

    const plan = planDeletion(parsedArgs, spec, allSpecs);

    if (!plan.valid) {
      handlePlanError(plan, spec, allSpecs);
      return 1;
    }

    const shouldProceed = await performRemoval(parsedArgs, spec, validation, plan);

    if (!shouldProceed) {
      console.log('\nAborted. No changes made.');
      return 0;
    }

    if (parsedArgs.dryRun) {
      return 0;
    }

    try {
      await executeRemoval(parsedArgs.cascade, spec, validation, plan.newParentId, allSpecs);
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`\nError: ${message}`);
      return 1;
    }
  },
};
