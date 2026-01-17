#!/usr/bin/env bun
/**
 * sc CLI entry point.
 * Parses arguments and routes to command handlers.
 */

import { loadCommand, printHelp, printVersion } from './command-router';

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return 0;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    printVersion();
    return 0;
  }

  const commandName = args[0];
  if (!commandName) {
    printHelp();
    return 0;
  }

  const command = await loadCommand(commandName);

  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.error('Run "sc --help" for usage information.');
    return 1;
  }

  try {
    const commandArgs = args.slice(1);
    return await command.execute(commandArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error: ${message}`);
    return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
