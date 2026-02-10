/**
 * sc edit - Edit spec in $EDITOR
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFile } from '../spec-filesystem';

export const command: CommandHandler = {
  name: 'edit',
  description: 'Edit spec in $EDITOR',

  getHelp(): CommandHelp {
    return {
      name: 'sc edit',
      synopsis: 'sc edit <id>',
      description: `Open a spec file in your configured text editor.

Uses the $EDITOR environment variable to determine which editor to use.
Defaults to vim if $EDITOR is not set.`,
      examples: [
        '# Edit spec in default editor',
        'sc edit a1b2c3',
        '',
        '# Set editor preference',
        'export EDITOR=nvim',
        'sc edit a1b2c3',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const specId = args[0];
    if (specId === undefined) {
      printCommandUsage(this.getHelp!());
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
