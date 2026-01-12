/**
 * sc done - Mark spec as complete
 */

import type { CommandHandler } from '../types';
import { findSpecFile } from '../spec-filesystem';
import { completeSpec, isSpecClaimed } from '../claim-logic';

export const command: CommandHandler = {
  name: 'done',
  description: 'Mark spec as complete',

  async execute(args: string[]): Promise<number> {
    const specId = args[0];
    if (!specId) {
      console.error('Usage: sc done <id>');
      return 1;
    }

    const spec = await findSpecFile(specId);
    if (!spec) {
      console.error(`Spec not found: ${specId}`);
      return 1;
    }

    const claimed = await isSpecClaimed(spec.id);
    if (!claimed) {
      console.error(`Spec ${spec.id} is not claimed. Claim it first with: sc claim ${spec.id}`);
      return 1;
    }

    await completeSpec(spec);

    console.log(`Completed: ${spec.title}`);
    console.log(`  Status: closed`);
    console.log(`  Branch deleted: work/${spec.id}`);

    return 0;
  },
};
