/**
 * sc deps - Manage dependencies
 */

import type { CommandHandler, Spec } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
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

  getHelp(): CommandHelp {
    return {
      name: 'sc deps',
      synopsis: 'sc deps <add|remove|list> <id> [blocker-id]',
      description: `Manage blocking dependencies between specs.

When spec A blocks spec B, it means B cannot start until A is completed (closed).
This creates a dependency graph that determines which specs are ready for work.`,
      subcommands: {
        add: {
          synopsis: 'sc deps add <id> <blocker-id>',
          description: 'Add a blocking dependency. <id> will be blocked by <blocker-id>.',
          examples: [
            'sc deps add b3c4 a1b2  # b3c4 cannot start until a1b2 is closed',
          ],
        },
        remove: {
          synopsis: 'sc deps remove <id> <blocker-id>',
          description: 'Remove a blocking dependency.',
          examples: [
            'sc deps remove b3c4 a1b2  # Remove blocker relationship',
          ],
        },
        list: {
          synopsis: 'sc deps list <id>',
          description: 'Show all blockers for this spec and all specs it blocks.',
          examples: [
            'sc deps list b3c4  # Show what blocks b3c4 and what b3c4 blocks',
          ],
        },
      },
      examples: [
        '# Add a dependency',
        'sc deps add feature-xyz abc123',
        '',
        '# View all dependencies',
        'sc deps list feature-xyz',
        '',
        '# Remove a dependency',
        'sc deps remove feature-xyz abc123',
      ],
      notes: [
        'Specs with unmet blockers will have status "blocked" and won\'t appear in "sc list --ready".',
        'Circular dependencies are detected by "sc doctor" and should be fixed manually.',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const subcommand = args[0];
    const specId = args[1];

    if (!subcommand || !specId) {
      printCommandUsage(this.getHelp!());
      return 1;
    }

    switch (subcommand) {
      case 'add': {
        const blockerId = args[2];
        if (!blockerId) {
          const help = this.getHelp!();
          console.error(`Usage: ${help.subcommands!['add'].synopsis}`);
          return 1;
        }
        return addDependency(specId, blockerId);
      }

      case 'remove': {
        const blockerId = args[2];
        if (!blockerId) {
          const help = this.getHelp!();
          console.error(`Usage: ${help.subcommands!['remove'].synopsis}`);
          return 1;
        }
        return removeDependency(specId, blockerId);
      }

      case 'list':
        return listDependencies(specId);

      default:
        console.error(`Unknown subcommand: ${subcommand}`);
        printCommandUsage(this.getHelp!());
        return 1;
    }
  },
};
