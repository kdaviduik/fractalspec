#!/usr/bin/env bun
/**
 * sc CLI entry point.
 * Parses arguments and routes to command handlers.
 */

import { loadCommand, printHelp, printVersion } from './command-router';
import { printCommandHelp, printSubcommandHelp } from './help.js';

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    await printHelp();
    return 0;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    printVersion();
    return 0;
  }

  const commandName = args[0];
  if (commandName === undefined) {
    await printHelp();
    return 0;
  }

  // Check for help flags at any position
  const helpIndex = args.findIndex(arg => arg === '--help' || arg === '-h');

  if (helpIndex !== -1) {
    const command = await loadCommand(commandName);

    if (!command) {
      console.error(`Unknown command: ${commandName}`);
      console.error('Run "sc --help" for usage information.');
      return 1;
    }

    if (command.getHelp) {
      const help = command.getHelp();

      // Check for subcommand help (e.g., sc command subcommand --help)
      const subcommand = helpIndex > 1 ? args[1] : undefined;

      if (subcommand !== undefined && help.subcommands?.[subcommand] !== undefined) {
        await printSubcommandHelp(commandName, subcommand, help.subcommands[subcommand]);
        return 0;
      }

      // Show full command help
      await printCommandHelp(help);
      return 0;
    }

    // Fallback for commands without getHelp()
    console.log(`Usage: sc ${commandName} ...`);
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
