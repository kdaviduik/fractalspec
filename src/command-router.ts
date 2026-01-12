/**
 * Routes CLI commands to their handlers.
 * Uses lazy loading to keep startup fast.
 */

import type { CommandHandler } from './types';

interface CommandModule {
  command: CommandHandler;
}

const COMMANDS: Record<string, () => Promise<CommandModule>> = {
  create: () => import('./commands/create'),
  show: () => import('./commands/show'),
  edit: () => import('./commands/edit'),
  list: () => import('./commands/list'),
  claim: () => import('./commands/claim'),
  release: () => import('./commands/release'),
  done: () => import('./commands/done'),
  deps: () => import('./commands/deps'),
  validate: () => import('./commands/validate'),
  doctor: () => import('./commands/doctor'),
  ears: () => import('./commands/ears'),
};

export function getAvailableCommands(): string[] {
  return Object.keys(COMMANDS);
}

export async function loadCommand(name: string): Promise<CommandHandler | null> {
  const loader = COMMANDS[name];
  if (!loader) {
    return null;
  }

  const module = await loader();
  return module.command;
}

export function printHelp(): void {
  console.log(`sc - Spec management CLI

Usage:
  sc <command> [options]

Commands:
  create [--parent <id>]        Create a new spec
  show <id>                     Display spec details
  edit <id>                     Edit spec in $EDITOR
  list [--ready|--tree|--status] List specs
  claim <id>                    Claim spec for work
  release <id>                  Release claimed spec
  done <id>                     Mark spec as complete
  deps add|remove|list <id>     Manage dependencies
  validate [id] [--fix]         Validate EARS format
  doctor [--fix]                Check repository health
  ears <text>                   Convert text to EARS format

Options:
  --help, -h                    Show this help message
  --version, -v                 Show version

Examples:
  sc create                     Create root spec
  sc create --parent a1b2       Create child spec
  sc list --ready               Show specs available for work
  sc claim a1b2                 Start working on spec
  sc done a1b2                  Complete spec
`);
}

export function printVersion(): void {
  console.log('sc version 0.1.0');
}
