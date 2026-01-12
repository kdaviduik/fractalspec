/**
 * sc edit - Edit spec in $EDITOR
 */

import type { CommandHandler } from '../types';
import { findSpecFile } from '../spec-filesystem';

export const command: CommandHandler = {
  name: 'edit',
  description: 'Edit spec in $EDITOR',

  async execute(args: string[]): Promise<number> {
    const specId = args[0];
    if (!specId) {
      console.error('Usage: sc edit <id>');
      return 1;
    }

    const spec = await findSpecFile(specId);
    if (!spec) {
      console.error(`Spec not found: ${specId}`);
      return 1;
    }

    const editor = process.env['EDITOR'] ?? 'vim';

    const proc = Bun.spawn([editor, spec.filePath], {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    });

    const exitCode = await proc.exited;
    return exitCode;
  },
};
