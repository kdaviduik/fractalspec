/**
 * sc claim - Claim spec for work
 */

import type { CommandHandler } from '../types';
import { findSpecFile } from '../spec-filesystem';
import { claimSpec } from '../claim-logic';

export const command: CommandHandler = {
  name: 'claim',
  description: 'Claim spec for work',

  async execute(args: string[]): Promise<number> {
    const specId = args[0];
    if (!specId) {
      console.error('Usage: sc claim <id>');
      return 1;
    }

    const spec = await findSpecFile(specId);
    if (!spec) {
      console.error(`Spec not found: ${specId}`);
      return 1;
    }

    const result = await claimSpec(spec);

    if (!result.success) {
      console.error(`Failed to claim spec: ${result.error}`);
      return 1;
    }

    console.log(`Claimed: ${spec.title}`);
    console.log(`  Branch: ${result.branchName}`);
    console.log(`  Status: in_progress`);
    console.log(`\nTo switch to the work branch:`);
    console.log(`  git checkout ${result.branchName}`);

    return 0;
  },
};
