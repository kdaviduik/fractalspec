import type { CommandHandler, Spec, Status } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFile, writeSpec, readAllSpecs } from '../spec-filesystem';
import { STATUSES, MIN_PRIORITY, MAX_PRIORITY, isValidStatus, isValidPriority } from '../types';

interface SetOptions {
  priority?: number;
  status?: Status;
  parent?: string | null;
  block?: string;
  unblock?: string;
  pr?: string | null;
}

function exitWithError(message: string): never {
  console.error(message);
  process.exit(1);
}

function getNextArg(args: string[], index: number): string | undefined {
  return args[index + 1];
}

function parsePriorityFlag(args: string[], index: number): number {
  const value = getNextArg(args, index);
  if (value === undefined) return exitWithError('--priority requires a value');
  const parsed = parseInt(value, 10);
  if (!isValidPriority(parsed)) {
    return exitWithError(`Invalid priority: must be integer ${MIN_PRIORITY}-${MAX_PRIORITY}`);
  }
  return parsed;
}

function parseStatusFlag(args: string[], index: number): Status {
  const value = getNextArg(args, index);
  if (value === undefined) return exitWithError('--status requires a value');
  if (!isValidStatus(value)) {
    return exitWithError(`Invalid status: must be one of ${STATUSES.join(', ')}`);
  }
  return value;
}

function parseParentFlag(args: string[], index: number): string | null {
  const value = getNextArg(args, index);
  if (value === undefined) return exitWithError('--parent requires a value');
  if (value === 'none') return null;
  if (value === '') return exitWithError('Parent ID cannot be empty');
  return value;
}

function parseIdFlag(flagName: string, args: string[], index: number): string {
  const value = getNextArg(args, index);
  if (value === undefined) return exitWithError(`${flagName} requires a value`);
  if (value === '') return exitWithError(`${flagName.replace('--', '')} ID cannot be empty`);
  return value;
}

function parsePrFlag(args: string[], index: number): string | null {
  const value = getNextArg(args, index);
  if (value === undefined) return exitWithError('--pr requires a value');
  if (value === 'none') return null;
  if (value === '') return exitWithError('PR URL cannot be empty');
  return value;
}

function parseArgs(args: string[]): { specId: string | null; options: SetOptions } {
  const options: SetOptions = {};
  let specId: string | null = null;
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === undefined) { i++; continue; }
    if (arg === '--priority') { options.priority = parsePriorityFlag(args, i); i += 2; continue; }
    if (arg === '--status') { options.status = parseStatusFlag(args, i); i += 2; continue; }
    if (arg === '--parent') { options.parent = parseParentFlag(args, i); i += 2; continue; }
    if (arg === '--block') { options.block = parseIdFlag('--block', args, i); i += 2; continue; }
    if (arg === '--unblock') { options.unblock = parseIdFlag('--unblock', args, i); i += 2; continue; }
    if (arg === '--pr') { options.pr = parsePrFlag(args, i); i += 2; continue; }
    if (!arg.startsWith('-') && specId === null) {
      if (arg === '') return exitWithError('Spec ID cannot be empty');
      specId = arg;
      i++;
      continue;
    }
    return exitWithError(`Unknown argument: ${arg}`);
  }
  return { specId, options };
}

function hasAnyOption(o: SetOptions): boolean {
  return o.priority !== undefined || o.status !== undefined || o.parent !== undefined ||
    o.block !== undefined || o.unblock !== undefined || o.pr !== undefined;
}

function wouldCreateParentCycle(specId: string, newParentId: string, allSpecs: Spec[]): boolean {
  const visited = new Set<string>();
  let currentId: string | null = newParentId;
  while (currentId !== null) {
    if (currentId === specId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    const current = allSpecs.find((s) => s.id === currentId);
    currentId = current?.parent ?? null;
  }
  return false;
}

function wouldCreateBlockerCycle(specId: string, newBlockerId: string, allSpecs: Spec[]): boolean {
  const visited = new Set<string>();
  const toVisit = [newBlockerId];
  while (toVisit.length > 0) {
    const currentId = toVisit.pop();
    if (currentId === undefined) continue;
    if (currentId === specId) return true;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    const current = allSpecs.find((s) => s.id === currentId);
    if (current) toVisit.push(...current.blocks);
  }
  return false;
}

interface ChangeResult { success: boolean; messages: string[] }

function applyPriorityChange(spec: Spec, updated: Spec, priority: number, msgs: string[]): void {
  if (spec.priority === priority) { msgs.push(`Priority already ${priority}`); return; }
  updated.priority = priority;
  msgs.push(`Priority set to ${priority}`);
}

function applyStatusChange(spec: Spec, updated: Spec, status: Status, msgs: string[]): void {
  if (spec.status === status) { msgs.push(`Status already ${status}`); return; }
  updated.status = status;
  msgs.push(`Status set to ${status}`);
}

async function applyParentChange(
  spec: Spec, updated: Spec, parentOption: string | null, allSpecs: Spec[], msgs: string[]
): Promise<ChangeResult> {
  if (parentOption === null) {
    if (spec.parent === null) msgs.push('Already a root spec');
    else { updated.parent = null; msgs.push('Removed parent (now a root spec)'); }
    return { success: true, messages: msgs };
  }
  const parentSpec = await findSpecFile(parentOption);
  if (!parentSpec) {
    console.error(`Parent spec not found: ${parentOption}`);
    return { success: false, messages: [] };
  }
  if (wouldCreateParentCycle(spec.id, parentSpec.id, allSpecs)) {
    console.error(`Cannot set parent: would create a cycle (${spec.id} -> ${parentSpec.id})`);
    return { success: false, messages: [] };
  }
  if (spec.parent === parentSpec.id) msgs.push(`Parent already ${parentSpec.id}`);
  else { updated.parent = parentSpec.id; msgs.push(`Parent set to ${parentSpec.id}`); }
  return { success: true, messages: msgs };
}

async function applyBlockChange(
  spec: Spec, updated: Spec, blockerId: string, allSpecs: Spec[], msgs: string[]
): Promise<ChangeResult> {
  if (blockerId === spec.id) {
    console.error('Spec cannot block itself');
    return { success: false, messages: [] };
  }
  const blockerSpec = await findSpecFile(blockerId);
  if (!blockerSpec) {
    console.error(`Blocker spec not found: ${blockerId}`);
    return { success: false, messages: [] };
  }
  if (wouldCreateBlockerCycle(spec.id, blockerSpec.id, allSpecs)) {
    console.error(`Cannot add blocker: would create a cycle (${spec.id} <-> ${blockerSpec.id})`);
    return { success: false, messages: [] };
  }
  if (updated.blocks.includes(blockerSpec.id)) msgs.push(`Already blocked by ${blockerSpec.id}`);
  else { updated.blocks.push(blockerSpec.id); msgs.push(`Added blocker ${blockerSpec.id}`); }
  return { success: true, messages: msgs };
}

function applyUnblockChange(updated: Spec, blockerId: string, msgs: string[]): void {
  if (!updated.blocks.includes(blockerId)) { msgs.push(`Not blocked by ${blockerId}`); return; }
  updated.blocks = updated.blocks.filter((id) => id !== blockerId);
  msgs.push(`Removed blocker ${blockerId}`);
}

function applyPrChange(spec: Spec, updated: Spec, prValue: string | null, msgs: string[]): void {
  if (spec.pr === prValue) {
    if (prValue === null) msgs.push('PR already cleared');
    else msgs.push(`PR already set to ${prValue}`);
    return;
  }
  updated.pr = prValue;
  if (prValue === null) msgs.push('Cleared PR');
  else msgs.push(`PR set to ${prValue}`);
}

async function applyChanges(spec: Spec, options: SetOptions, allSpecs: Spec[]): Promise<ChangeResult> {
  const msgs: string[] = [];
  const updated: Spec = { ...spec, blocks: [...spec.blocks] };
  if (options.priority !== undefined) applyPriorityChange(spec, updated, options.priority, msgs);
  if (options.status !== undefined) applyStatusChange(spec, updated, options.status, msgs);
  if (options.parent !== undefined) {
    const result = await applyParentChange(spec, updated, options.parent, allSpecs, msgs);
    if (!result.success) return result;
  }
  if (options.block !== undefined) {
    const result = await applyBlockChange(spec, updated, options.block, allSpecs, msgs);
    if (!result.success) return result;
  }
  if (options.unblock !== undefined) applyUnblockChange(updated, options.unblock, msgs);
  if (options.pr !== undefined) applyPrChange(spec, updated, options.pr, msgs);
  const hasChanges = updated.priority !== spec.priority || updated.status !== spec.status ||
    updated.parent !== spec.parent || JSON.stringify(updated.blocks) !== JSON.stringify(spec.blocks) ||
    updated.pr !== spec.pr;
  if (hasChanges) await writeSpec(updated);
  return { success: true, messages: msgs };
}

function getCommandHelp(): CommandHelp {
  return {
    name: 'sc set',
    synopsis: 'sc set <id> [--priority <1-10>] [--status <status>] [--parent <id>|none] [--block <id>] [--unblock <id>] [--pr <url>|none]',
    description: `Modify properties of a spec. At least one flag is required.`,
    flags: [
      { flag: '--priority <1-10>', description: 'Set priority (10 = highest)' },
      { flag: '--status <status>', description: `Set status: ${STATUSES.join(', ')}` },
      { flag: '--parent <id>', description: 'Reparent to another spec' },
      { flag: '--parent none', description: 'Make root spec (remove parent)' },
      { flag: '--block <id>', description: 'Add blocking dependency' },
      { flag: '--unblock <id>', description: 'Remove blocking dependency' },
      { flag: '--pr <url>', description: 'Set PR URL for tracking' },
      { flag: '--pr none', description: 'Clear PR URL' },
    ],
    examples: [
      'sc set a1b2 --priority 8',
      'sc set a1b2 --status blocked',
      'sc set a1b2 --parent jk2n',
      'sc set a1b2 --parent none',
      'sc set a1b2 --block xyz9',
      'sc set a1b2 --unblock xyz9',
      'sc set a1b2 --pr https://github.com/org/repo/pull/123',
      'sc set a1b2 --pr none',
      'sc set a1b2 --priority 10 --status ready',
    ],
    notes: [
      'Operations are idempotent: setting same value twice succeeds silently.',
      'Cycle detection prevents circular parent/blocker references.',
    ],
  };
}

export const command: CommandHandler = {
  name: 'set',
  description: 'Modify spec properties',
  getHelp: getCommandHelp,
  async execute(args: string[]): Promise<number> {
    const { specId, options } = parseArgs(args);
    const help = getCommandHelp();
    if (!specId) { printCommandUsage(help); return 1; }
    if (!hasAnyOption(options)) {
      console.error('At least one flag is required');
      printCommandUsage(help);
      return 1;
    }
    const spec = await findSpecFile(specId);
    if (!spec) { console.error(`Spec not found: ${specId}`); return 1; }
    const allSpecs = await readAllSpecs();
    const result = await applyChanges(spec, options, allSpecs);
    if (!result.success) return 1;
    for (const message of result.messages) console.log(message);
    return 0;
  },
};
