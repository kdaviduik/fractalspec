/**
 * Routes CLI commands to their handlers.
 * Uses lazy loading to keep startup fast.
 */

import type { CommandHandler } from './types';
import { bold, underline, dim, displayWithPager } from './help.js';

interface CommandModule {
  command: CommandHandler;
}

const COMMANDS: Record<string, () => Promise<CommandModule>> = {
  init: () => import('./commands/init'),
  create: () => import('./commands/create'),
  show: () => import('./commands/show'),
  edit: () => import('./commands/edit'),
  list: () => import('./commands/list'),
  claim: () => import('./commands/claim'),
  release: () => import('./commands/release'),
  done: () => import('./commands/done'),
  set: () => import('./commands/set'),
  validate: () => import('./commands/validate'),
  doctor: () => import('./commands/doctor'),
  ears: () => import('./commands/ears'),
  remove: () => import('./commands/remove'),
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

export async function printHelp(): Promise<void> {
  const helpText = `${bold('NAME')}
  sc - Recursive specification management with EARS requirements

${bold('DESCRIPTION')}
  sc manages hierarchical specifications where complex features decompose into
  smaller, testable units. Each spec contains requirements in EARS format
  (Easy Approach to Requirements Syntax) ensuring unambiguous, verifiable criteria.

  Specs form a tree through parent/child relationships and can have blocking
  dependencies. By default, claiming sets status to in_progress. Use --branch
  for a dedicated work branch, or --worktree for isolated git worktrees.

  Status transitions: ready → in_progress → closed
  Blocked specs cannot start until their blockers reach a terminal status.

${bold('FILE STRUCTURE')}
  docs/specs/<slug>-<id>/<slug>-<id>.md

  Example:
    docs/specs/user-auth-a1b2c3/user-auth-a1b2c3.md

  Each spec is a markdown file with YAML frontmatter containing:
    - id: 6-character alphanumeric identifier
    - status: ready | in_progress | blocked | closed | deferred | not_planned
    - parent: parent spec ID or null
    - blockedBy: array of spec IDs that block this spec
    - priority: 1-10 numeric (10 = highest, default: inherits from parent, or 5)

${bold('STATUS ICONS')}
  ○  ready       - No blockers, available for work
  ◐  in_progress - Currently being worked on
  ⊘  blocked     - Waiting on dependencies
  ●  closed      - Complete
  ◇  deferred    - Postponed
  ✕  not_planned - Will not implement

${bold('CLAIM WORKFLOW')}
  ${underline('Status-only mode')} (default):
    1. sc claim <id>              # Sets status to in_progress (no git artifacts)
    2. [do the work, commit]
    3. sc done <id>               # Mark complete (works from anywhere)

  ${underline('Branch mode')} (--branch):
    1. sc claim <id> --branch     # Creates branch, checks it out, sets in_progress
    2. [do the work, commit]
    3. sc done <id>               # Mark complete, delete branch

  ${underline('Worktree mode')} (--worktree):
    1. sc claim <id> --worktree   # Creates worktree + branch, sets in_progress
    2. [do the work, commit]
    3. sc done <id>               # Mark complete, remove worktree + branch

  Branch mode requires a clean working tree. Use --worktree for isolated workspaces.
  In bare repositories with --branch, worktree mode is used automatically.

  Shell integration (auto-cd in worktree mode):
    eval "$(sc init bash)"        # Add to ~/.bashrc
    eval "$(sc init zsh)"         # Add to ~/.zshrc
    sc init fish | source         # Add to ~/.config/fish/config.fish

  Without shell integration:  eval "$(sc claim --cd --worktree <id>)"

${bold('COMMANDS')}
  ${underline('Setup')}
    ${underline('init')} ${dim('<bash|zsh|fish>')}     Set up shell integration for auto-cd on claim
                           Outputs a shell function to eval/source in your startup file

  ${underline('Discovery & Viewing')}
    ${underline('list')}                   List all specs
      --ready              Show specs available for work (sorted by priority)
      --limit ${dim('<n>')}          Limit to top N specs (requires --ready)
      --priority ${dim('<n or n-m>')} Filter by priority (requires --ready). E.g., 8 or 8-10
      --tree               Display hierarchical tree view (sorted by priority)
      --status             Show status count summary

    ${underline('show')} ${dim('<id>')}              Display full spec details including metadata

  ${underline('Workflow')}
    ${underline('claim')} ${dim('<id>')} ${dim('[--branch] [--worktree] [--cd]')}
                           Claim spec for work
                           - Sets status to in_progress (default: status-only)
      --branch, -B         Create and check out a work branch (work-<slug>-<id>)
      --worktree, -W       Create isolated worktree with work branch
      --cd, -C             Output cd command for shell eval (worktree mode)

    ${underline('release')} ${dim('<id>')} ${dim('[--force]')}  Abandon work and reset to ready
                           - Safety checks for uncommitted/unpushed work
                           - Removes work branch (and worktree if present)
                           - Resets status to ready
      --force, -f          Bypass safety checks (may lose work)

    ${underline('done')} ${dim('<id>')} ${dim('[--force]')}     Mark spec complete
                           - Safety checks for uncommitted/unpushed work
                           - Removes work branch (and worktree if present)
                           - Sets status to closed
      --force, -f          Bypass safety checks (may lose work)

  ${underline('Creation & Editing')}
    ${underline('create')}                 Create new spec (interactive)
      --status ${dim('<status>')}, -s Set initial status (default: ready)
      --priority ${dim('<1-10>')}     Set priority (higher = more urgent, default: inherits from parent)
      --parent ${dim('<id>')}, -p    Create as child of specified parent
      --title ${dim('<text>')}, -t   Set spec title (skips prompt)
      --message ${dim('<text>')}, -m Add context line to Overview (repeatable)
                           Each -m adds a line after the placeholder

    ${underline('edit')} ${dim('<id>')}              Open spec in $EDITOR (defaults to vim)

  ${underline('Property Modification')}
    ${underline('set')} ${dim('<id> [flags]')}        Modify spec properties
      --priority ${dim('<1-10>')}    Set priority (10 = highest)
      --status ${dim('<status>')}    Set status (ready, in_progress, blocked, closed, deferred, not_planned)
      --parent ${dim('<id>|none')}  Reparent to another spec or remove parent
      --block ${dim('<id>')}        Add blocking dependency
      --unblock ${dim('<id>')}      Remove blocking dependency
      --pr ${dim('<url>|none')}     Set or clear PR URL for tracking

  ${underline('Validation & Health')}
    ${underline('validate')} ${dim('[id]')}          Validate EARS requirement format
                           No args: validate all specs
                           With <id>: validate single spec
      --fix                ${dim('(Planned)')} Auto-fix format issues

    ${underline('doctor')}                 Check repository health
                           Detect and report structural health issues
      --fix                Auto-fix detected issues where possible
                           Exits with code 1 if issues found

    ${underline('ears')} ${dim('[text]')}            EARS format reference and conversion
                           No args: display pattern reference
                           With text: detect pattern or suggest conversion

  ${underline('Maintenance')}
    ${underline('remove')} ${dim('<id> [--cascade | --reparent <id>] [--dry-run]')}
                           Permanently delete a spec (UNRECOVERABLE)
                           ALWAYS requires confirmation (capital Y)
      --cascade            Delete spec and all descendants
      --reparent ${dim('<id>')}      Move children to specified parent
      --dry-run            Preview deletion without executing

${bold('EARS PATTERNS')}
  Ubiquitous       [Component] shall <response>
  Event-driven     When <trigger>, [component] shall <response>
  State-driven     While <state>, [component] shall <response>
  Optional         Where <feature>, [component] shall <response>
  Unwanted         If <condition>, then [component] shall <response>
  Complex          While <state>, when <trigger>, [component] shall <response>

  Note: Prefer specific component names over generic "system"

  See 'sc ears' for full reference and conversion assistance.

${bold('EXAMPLES')}
  # Finding work
  sc list --status              # Check overall project health
  sc list --ready               # Show available work (sorted by priority)
  sc list --ready --limit 1     # Get THE next task to work on
  sc list --ready --priority 8-10  # Show only highest-priority ready specs
  sc list --tree                # Understand hierarchy

  # Working on a spec (status-only - default)
  sc claim a1b2c3               # Sets status to in_progress
  # ... do work, git commit ...
  sc done a1b2c3                # Complete (works from any directory)

  # Working on a spec (branch mode)
  sc claim a1b2c3 --branch      # Creates branch, checks it out
  # ... do work, git commit ...
  sc done a1b2c3                # Complete, removes branch

  # Working on a spec (worktree mode - isolated workspace)
  sc claim a1b2c3 --worktree    # Creates worktree + branch
  # ... do work, git commit ...
  sc done a1b2c3                # Complete, removes worktree

  # Shell integration (for worktree auto-cd)
  eval "$(sc init bash)"         # Add to ~/.bashrc (or zsh/fish equivalent)
  sc claim a1b2c3 --worktree    # Auto-cd's into worktree with shell integration

  # Creating specs
  sc create                     # Create root spec (prompted for title)
  sc create -t "OAuth Flow"     # Create with title
  sc create -t "Security Fix" --priority 10  # Create with highest priority
  sc create -t "Database Migration" -m "Required for schema v2"  # Add context
  sc create -p a1b2 -t "OAuth Callback Handler"  # Create child (inherits priority)
  sc create -s blocked -t "Premium Features" -m "Waiting on payment gateway"  # With status and context

  # Modifying spec properties
  sc set b3c4 --priority 8      # Set priority
  sc set b3c4 --status blocked  # Set status
  sc set b3c4 --block a1b2      # b3c4 blocked by a1b2
  sc set b3c4 --unblock a1b2    # Remove blocking dependency
  sc set b3c4 --parent a1b2     # Reparent to a1b2
  sc set b3c4 --parent none     # Make root spec
  sc set b3c4 --pr https://github.com/org/repo/pull/123  # Set PR URL
  sc set b3c4 --pr none         # Clear PR URL

  # Completing work with safety checks
  sc done a1b2c3                # Errors if uncommitted/unpushed work
  sc done a1b2c3 --force        # Bypass safety checks

  # Validation
  sc validate                   # Check all specs
  sc validate a1b2c3            # Check single spec
  sc ears "users can login"     # Get EARS format suggestion

  # Repository health
  sc doctor                     # Check for issues
  sc doctor --fix               # Auto-repair where possible

${bold('ENVIRONMENT')}
  EDITOR    Text editor for 'sc edit' command (default: vim)

${bold('EXIT CODES')}
  0  Success
  1  Error (invalid arguments, spec not found, validation failure, etc.)
`;

  await displayWithPager(helpText);
}

export function printVersion(): void {
  console.log('sc version 0.1.0');
}
