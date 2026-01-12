/**
 * sc release - Release claimed spec
 */

import type { CommandHandler } from '../types';
import { findSpecFile } from '../spec-filesystem';
import { releaseSpec, isSpecClaimed } from '../claim-logic';

export const command: CommandHandler = {
  name: 'release',
  description: 'Release claimed spec',

  async execute(args: string[]): Promise<number> {
    const specId = args[0];
    if (!specId) {
      console.error('Usage: sc release <id>');
      return 1;
    }

    const spec = await findSpecFile(specId);
    if (!spec) {
      console.error(`Spec not found: ${specId}`);
      return 1;
    }

    const claimed = await isSpecClaimed(spec.id);
    if (!claimed) {
      console.error(`Spec ${spec.id} is not claimed.`);
      return 1;
    }

    await releaseSpec(spec);

    console.log(`Released: ${spec.title}`);
    console.log(`  Status: ready`);
    console.log(`  Branch deleted: work/${spec.id}`);

    return 0;
  },
};
