/**
 * sc init - Set up shell integration for auto-cd on claim
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';

const SUPPORTED_SHELLS = ['bash', 'zsh', 'fish'] as const;
type Shell = (typeof SUPPORTED_SHELLS)[number];

function isSupportedShell(value: string): value is Shell {
  return value === 'bash' || value === 'zsh' || value === 'fish';
}

function bashZshFunction(): string {
  return `sc() {
  if [ "$1" = "claim" ]; then
    local _sc_output
    _sc_output=$(command sc claim --cd "\${@:2}")
    local _sc_exit=$?
    if [ $_sc_exit -eq 0 ] && [ -n "$_sc_output" ]; then
      eval "$_sc_output"
    fi
    return $_sc_exit
  fi
  command sc "$@"
}`;
}

function fishFunction(): string {
  return `function sc --wraps sc --description 'sc wrapper for auto-cd on claim'
    if test (count $argv) -ge 1; and test "$argv[1]" = claim
        set -l _sc_output (command sc claim --cd $argv[2..])
        set -l _sc_exit $status
        if test $_sc_exit -eq 0; and test -n "$_sc_output"
            eval $_sc_output
        end
        return $_sc_exit
    end
    command sc $argv
end`;
}

const SHELL_FUNCTIONS: Record<Shell, () => string> = {
  bash: bashZshFunction,
  zsh: bashZshFunction,
  fish: fishFunction,
};

export const command: CommandHandler = {
  name: 'init',
  description: 'Set up shell integration for auto-cd on claim',

  getHelp(): CommandHelp {
    return {
      name: 'sc init',
      synopsis: 'sc init <bash|zsh|fish>',
      description: `Output a shell function that wraps sc to auto-cd into worktrees on claim.

  The generated function intercepts all 'sc claim' invocations and automatically
  changes directory into the new worktree. Non-claim commands pass through unchanged.

  Supported shells: bash, zsh, fish.

  Add the eval/source line to your shell's startup file for persistent setup.`,
      examples: [
        '# Bash: add to ~/.bashrc',
        'eval "$(sc init bash)"',
        '',
        '# Zsh: add to ~/.zshrc',
        'eval "$(sc init zsh)"',
        '',
        '# Fish: add to ~/.config/fish/config.fish',
        'sc init fish | source',
        '',
        '# Then claiming auto-cd\'s into the worktree',
        'sc claim a1b2c3',
      ],
      notes: [
        'To claim without auto-cd (bypass the wrapper): command sc claim <id>',
        'The wrapper always passes --cd to the real binary. Status info goes to stderr.',
        'On claim failure, stdout is empty and eval is skipped.',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const shell = args[0];

    if (!shell) {
      printCommandUsage(this.getHelp!());
      return 1;
    }

    if (!isSupportedShell(shell)) {
      console.error(`Unsupported shell: ${shell}`);
      console.error(`Supported shells: ${SUPPORTED_SHELLS.join(', ')}`);
      return 1;
    }

    console.log(SHELL_FUNCTIONS[shell]());
    return 0;
  },
};
