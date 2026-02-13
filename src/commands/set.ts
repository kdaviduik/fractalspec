import type { CommandHandler, Spec, Status } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { findSpecFile, writeSpec, readAllSpecs } from '../spec-filesystem';
import { STATUSES, MIN_PRIORITY, MAX_PRIORITY, isValidStatus, isValidPriority } from '../types';
import { appendToSection, SECTION_HEADINGS } from '../markdown-sections';

interface ContentOverrides {
  overview?: string;
  background?: string;
  goals?: string[];
  requirements?: string;
  tasks?: string[];
  prerequisites?: string;
  questions?: string[];
}

interface SetOptions {
  priority?: number;
  status?: Status;
  parent?: string | null;
  block?: string;
  unblock?: string;
  pr?: string | null;
  content?: ContentOverrides;
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

function parseContentStringFlag(flagName: string, args: string[], index: number): string {
  const value = getNextArg(args, index);
  if (value === undefined) return exitWithError(`${flagName} requires a value`);
  if (value.trim() === '') return exitWithError(`${flagName} requires non-empty text`);
  return value;
}

function ensureContent(options: SetOptions): ContentOverrides {
  if (options.content === undefined) options.content = {};
  return options.content;
}

function pushContentArray(options: SetOptions, key: 'goals' | 'tasks' | 'questions', value: string): void {
  const content = ensureContent(options);
  const existing = content[key];
  if (existing !== undefined) {
    existing.push(value);
  } else {
    content[key] = [value];
  }
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

    if (arg === '--overview') { ensureContent(options).overview = parseContentStringFlag(arg, args, i); i += 2; continue; }
    if (arg === '--background') { ensureContent(options).background = parseContentStringFlag(arg, args, i); i += 2; continue; }
    if (arg === '--requirements') { ensureContent(options).requirements = parseContentStringFlag(arg, args, i); i += 2; continue; }
    if (arg === '--prerequisites') { ensureContent(options).prerequisites = parseContentStringFlag(arg, args, i); i += 2; continue; }
    if (arg === '--goals') { pushContentArray(options, 'goals', parseContentStringFlag(arg, args, i)); i += 2; continue; }
    if (arg === '--tasks') { pushContentArray(options, 'tasks', parseContentStringFlag(arg, args, i)); i += 2; continue; }
    if (arg === '--questions') { pushContentArray(options, 'questions', parseContentStringFlag(arg, args, i)); i += 2; continue; }

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
    o.block !== undefined || o.unblock !== undefined || o.pr !== undefined || o.content !== undefined;
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
    if (current) toVisit.push(...current.blockedBy);
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
  if (updated.blockedBy.includes(blockerSpec.id)) msgs.push(`Already blocked by ${blockerSpec.id}`);
  else { updated.blockedBy.push(blockerSpec.id); msgs.push(`Added blocker ${blockerSpec.id}`); }
  return { success: true, messages: msgs };
}

function applyUnblockChange(updated: Spec, blockerId: string, msgs: string[]): void {
  if (!updated.blockedBy.includes(blockerId)) { msgs.push(`Not blocked by ${blockerId}`); return; }
  updated.blockedBy = updated.blockedBy.filter((id) => id !== blockerId);
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

function sectionHeading(key: string): string {
  return SECTION_HEADINGS[key] ?? key;
}

function applyContentChanges(spec: Spec, content: ContentOverrides, msgs: string[]): void {
  if (content.overview !== undefined) {
    spec.content = appendToSection(spec.content, sectionHeading('overview'), content.overview + '\n');
    msgs.push('Updated Overview');
  }
  if (content.background !== undefined) {
    spec.content = appendToSection(spec.content, sectionHeading('background'), content.background + '\n');
    msgs.push('Updated Background & Context');
  }
  if (content.goals !== undefined) {
    const goalsBody = content.goals.map(g => `- ${g}`).join('\n') + '\n';
    spec.content = appendToSection(spec.content, sectionHeading('goals'), goalsBody);
    msgs.push(`Added ${content.goals.length} goal(s)`);
  }
  if (content.requirements !== undefined) {
    spec.content = appendToSection(spec.content, sectionHeading('requirements'), content.requirements + '\n');
    msgs.push('Updated Requirements');
  }
  if (content.tasks !== undefined) {
    const tasksBody = content.tasks.map(t => `- [ ] ${t}`).join('\n') + '\n';
    spec.content = appendToSection(spec.content, sectionHeading('tasks'), tasksBody);
    msgs.push(`Added ${content.tasks.length} task(s)`);
  }
  if (content.prerequisites !== undefined) {
    spec.content = appendToSection(spec.content, sectionHeading('prerequisites'), content.prerequisites + '\n');
    msgs.push('Updated Prerequisites');
  }
  if (content.questions !== undefined) {
    const questionsBody = content.questions.map(q => `- ${q}`).join('\n') + '\n';
    spec.content = appendToSection(spec.content, sectionHeading('questions'), questionsBody);
    msgs.push(`Added ${content.questions.length} question(s)`);
  }
}

async function applyChanges(spec: Spec, options: SetOptions, allSpecs: Spec[]): Promise<ChangeResult> {
  const msgs: string[] = [];
  const updated: Spec = { ...spec, blockedBy: [...spec.blockedBy] };
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

  if (options.content !== undefined) {
    applyContentChanges(updated, options.content, msgs);
  }

  const hasChanges = updated.priority !== spec.priority || updated.status !== spec.status ||
    updated.parent !== spec.parent || JSON.stringify(updated.blockedBy) !== JSON.stringify(spec.blockedBy) ||
    updated.pr !== spec.pr || updated.content !== spec.content;
  if (hasChanges) await writeSpec(updated);
  return { success: true, messages: msgs };
}

function getCommandHelp(): CommandHelp {
  return {
    name: 'sc set',
    synopsis: 'sc set <id> [--priority <1-10>] [--status <status>] [--parent <id>|none] [--block <id>] [--unblock <id>] [--pr <url>|none] [--overview <text>] [--goals <text>] ...',
    description: `Modify spec properties or section content. At least one flag is required.

Content flags use smart-append semantics: if the existing section is boilerplate
(template placeholder), the new content replaces it. If the section already has
real content, the new content appends to it.`,
    flags: [
      { flag: '--priority <1-10>', description: 'Set priority (10 = highest)' },
      { flag: '--status <status>', description: `Set status: ${STATUSES.join(', ')}` },
      { flag: '--parent <id>', description: 'Reparent to another spec' },
      { flag: '--parent none', description: 'Make root spec (remove parent)' },
      { flag: '--block <id>', description: 'Add blocking dependency' },
      { flag: '--unblock <id>', description: 'Remove blocking dependency' },
      { flag: '--pr <url>', description: 'Set PR URL for tracking' },
      { flag: '--pr none', description: 'Clear PR URL' },
      { flag: '--overview <text>', description: 'Set or append to Overview section' },
      { flag: '--background <text>', description: 'Set or append to Background & Context section' },
      { flag: '--goals <text>', description: 'Add a goal bullet (repeatable)' },
      { flag: '--requirements <text>', description: 'Set or append to Requirements section' },
      { flag: '--tasks <text>', description: 'Add a task checkbox under Inline Tasks (repeatable)' },
      { flag: '--prerequisites <text>', description: 'Set or append to Prerequisites section' },
      { flag: '--questions <text>', description: 'Add an open question bullet (repeatable)' },
    ],
    examples: [
      '# Property changes',
      'sc set a1b2c3 --priority 8',
      'sc set a1b2c3 --status blocked',
      'sc set a1b2c3 --parent jk2nm4',
      'sc set a1b2c3 --block xyz9q7',
      'sc set a1b2c3 --pr https://github.com/org/repo/pull/123',
      '',
      '# Content editing (replaces boilerplate, appends to real content)',
      'sc set a1b2c3 --overview "Implement user authentication with JWT"',
      'sc set a1b2c3 --goals "Support email/password login" --goals "Add session persistence"',
      'sc set a1b2c3 --tasks "Create login endpoint" --tasks "Add auth middleware"',
      'sc set a1b2c3 --questions "Should we support OAuth?"',
      '',
      '# Combine property and content changes',
      'sc set a1b2c3 --priority 10 --overview "Critical security fix needed"',
    ],
    notes: [
      'Operations are idempotent: setting same value twice succeeds silently.',
      'Cycle detection prevents circular parent/blocker references.',
      'Parent specs (specs with children) cannot be set to in_progress. Work on their child specs instead.',
      'Content flags use smart-append: boilerplate is replaced, real content is appended to.',
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
    if (specId === null) { printCommandUsage(help); return 1; }
    if (!hasAnyOption(options)) {
      console.error('At least one flag is required');
      printCommandUsage(help);
      return 1;
    }
    const spec = await findSpecFile(specId);
    if (!spec) { console.error(`Spec not found: ${specId}`); return 1; }
    const allSpecs = await readAllSpecs();
    if (options.status === 'in_progress' && allSpecs.some(s => s.parent === spec.id)) {
      console.error(`Cannot set "${spec.title}" to in_progress: it has child specs and is not directly actionable.`);
      console.error('Work on its child specs instead. See: sc list --tree');
      return 1;
    }
    const result = await applyChanges(spec, options, allSpecs);
    if (!result.success) return 1;
    for (const message of result.messages) console.log(message);
    return 0;
  },
};
