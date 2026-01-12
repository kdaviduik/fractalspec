/**
 * sc deps - Manage dependencies
 */

import type { CommandHandler, Spec } from '../types';
import { findSpecFile, writeSpec, readAllSpecs } from '../spec-filesystem';

async function addDependency(specId: string, blockerId: string): Promise<number> {
  const spec = await findSpecFile(specId);
  if (!spec) {
    console.error(`Spec not found: ${specId}`);
    return 1;
  }

  const blocker = await findSpecFile(blockerId);
  if (!blocker) {
    console.error(`Blocker spec not found: ${blockerId}`);
    return 1;
  }

  if (spec.blocks.includes(blocker.id)) {
    console.log(`Dependency already exists: ${spec.id} → ${blocker.id}`);
    return 0;
  }

  const updatedSpec: Spec = {
    ...spec,
    blocks: [...spec.blocks, blocker.id],
  };

  await writeSpec(updatedSpec);

  console.log(`Added dependency: ${spec.id} is blocked by ${blocker.id}`);
  return 0;
}

async function removeDependency(specId: string, blockerId: string): Promise<number> {
  const spec = await findSpecFile(specId);
  if (!spec) {
    console.error(`Spec not found: ${specId}`);
    return 1;
  }

  if (!spec.blocks.includes(blockerId)) {
    console.log(`Dependency does not exist: ${spec.id} → ${blockerId}`);
    return 0;
  }

  const updatedSpec: Spec = {
    ...spec,
    blocks: spec.blocks.filter((id) => id !== blockerId),
  };

  await writeSpec(updatedSpec);

  console.log(`Removed dependency: ${spec.id} → ${blockerId}`);
  return 0;
}

async function listDependencies(specId: string): Promise<number> {
  const specs = await readAllSpecs();
  const spec = specs.find((s) => s.id === specId || s.id.startsWith(specId));

  if (!spec) {
    console.error(`Spec not found: ${specId}`);
    return 1;
  }

  console.log(`\nDependencies for: ${spec.title} (${spec.id})`);
  console.log('═'.repeat(40));

  if (spec.blocks.length === 0) {
    console.log('  No blockers');
  } else {
    console.log('\nBlocked by:');
    for (const blockerId of spec.blocks) {
      const blocker = specs.find((s) => s.id === blockerId);
      const status = blocker ? `[${blocker.status}]` : '[not found]';
      const title = blocker?.title ?? 'Unknown';
      console.log(`  ${blockerId} ${status} ${title}`);
    }
  }

  const blocking = specs.filter((s) => s.blocks.includes(spec.id));
  if (blocking.length > 0) {
    console.log('\nBlocking:');
    for (const blocked of blocking) {
      console.log(`  ${blocked.id} [${blocked.status}] ${blocked.title}`);
    }
  }

  return 0;
}

export const command: CommandHandler = {
  name: 'deps',
  description: 'Manage dependencies',

  async execute(args: string[]): Promise<number> {
    const subcommand = args[0];
    const specId = args[1];

    if (!subcommand || !specId) {
      console.error('Usage: sc deps <add|remove|list> <id> [blocker-id]');
      return 1;
    }

    switch (subcommand) {
      case 'add': {
        const blockerId = args[2];
        if (!blockerId) {
          console.error('Usage: sc deps add <id> <blocker-id>');
          return 1;
        }
        return addDependency(specId, blockerId);
      }

      case 'remove': {
        const blockerId = args[2];
        if (!blockerId) {
          console.error('Usage: sc deps remove <id> <blocker-id>');
          return 1;
        }
        return removeDependency(specId, blockerId);
      }

      case 'list':
        return listDependencies(specId);

      default:
        console.error(`Unknown subcommand: ${subcommand}`);
        console.error('Usage: sc deps <add|remove|list> <id> [blocker-id]');
        return 1;
    }
  },
};
