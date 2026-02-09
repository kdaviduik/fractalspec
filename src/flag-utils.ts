/**
 * Shared flag parsing utilities for CLI commands.
 */

export function parseForceFlag(args: string[]): { force: boolean; specId: string | undefined } {
  let force = false;
  let specId: string | undefined;

  for (const arg of args) {
    if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (!arg.startsWith('-')) {
      specId = arg;
    }
  }

  return { force, specId };
}
