/**
 * sc create - Create a new spec
 */

import { parseArgs } from 'util';
import { join } from 'path';
import type { CommandHandler, Spec, Priority } from '../types';
import { STATUSES, MIN_PRIORITY, MAX_PRIORITY, DEFAULT_PRIORITY, isValidStatus, isValidPriority } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { generateId } from '../id-generation';
import {
  createSpecDirectory,
  readAllSpecs,
  writeSpec,
} from '../spec-filesystem';
import { SECTION_HEADINGS, setSection } from '../markdown-sections';

const MAX_MESSAGE_COUNT = 100;
const MAX_MESSAGE_LENGTH_BYTES = 10_000;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

async function promptForTitle(): Promise<string> {
  process.stdout.write('Spec title: ');

  for await (const line of console) {
    return line.trim();
  }

  return 'untitled';
}

export function validateMessages(messages: string[] | undefined): string[] {
  if (!messages || messages.length === 0) {
    return [];
  }

  if (messages.length > MAX_MESSAGE_COUNT) {
    console.error(`Error: Maximum ${MAX_MESSAGE_COUNT} messages allowed`);
    process.exit(1);
  }

  const validated: string[] = [];
  for (const msg of messages) {
    const trimmed = msg.trim();

    if (trimmed === '') {
      console.error('Error: -m flag value cannot be empty or whitespace');
      process.exit(1);
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH_BYTES) {
      console.error(
        `Error: Message exceeds ${MAX_MESSAGE_LENGTH_BYTES} character limit`,
      );
      process.exit(1);
    }

    validated.push(trimmed);
  }

  return validated;
}

export function determinePriority(
  explicitPriority: string | undefined,
  parentId: string | undefined,
  allSpecs: Spec[]
): Priority {
  if (explicitPriority !== undefined) {
    const parsed = parseInt(explicitPriority, 10);
    if (isValidPriority(parsed)) {
      return parsed;
    }
  }
  if (parentId !== undefined && parentId !== null) {
    const parentSpec = allSpecs.find((s) => s.id === parentId);
    if (parentSpec) {
      return parentSpec.priority;
    }
  }
  return DEFAULT_PRIORITY;
}

export interface SectionOverrides {
  overview?: string;
  background?: string;
  goals?: string[];
  requirements?: string;
  tasks?: string[];
  prerequisites?: string;
  questions?: string[];
}

function heading(key: string): string {
  return SECTION_HEADINGS[key] ?? key;
}

function applyOverrides(content: string, overrides: SectionOverrides): string {
  let result = content;
  if (overrides.overview !== undefined) {
    result = setSection(result, heading('overview'), overrides.overview + '\n');
  }
  if (overrides.background !== undefined) {
    result = setSection(result, heading('background'), overrides.background + '\n');
  }
  if (overrides.goals !== undefined) {
    result = setSection(result, heading('goals'), overrides.goals.map(g => `- ${g}`).join('\n') + '\n');
  }
  if (overrides.requirements !== undefined) {
    result = setSection(result, heading('requirements'), overrides.requirements + '\n');
  }
  if (overrides.tasks !== undefined) {
    result = setSection(result, heading('tasks'), overrides.tasks.map(t => `- [ ] ${t}`).join('\n') + '\n');
  }
  if (overrides.prerequisites !== undefined) {
    result = setSection(result, heading('prerequisites'), overrides.prerequisites + '\n');
  }
  if (overrides.questions !== undefined) {
    result = setSection(result, heading('questions'), overrides.questions.map(q => `- ${q}`).join('\n') + '\n');
  }
  return result;
}

function applyMessages(content: string, messages: string[], overviewText: string | undefined): string {
  const messagesStr = messages.join('\n') + '\n';
  if (overviewText !== undefined) {
    return setSection(content, heading('overview'), overviewText + '\n\n' + messagesStr);
  }
  return setSection(content, heading('overview'), '[2-3 sentences: what this is and why it matters]\n\n' + messagesStr);
}

export function generateSpecTemplate(
  title: string,
  messages?: string[],
  overrides?: SectionOverrides,
): string {
  let content = `# Spec: ${title}

## ${heading('overview')}
[2-3 sentences: what this is and why it matters]

## ${heading('background')}
[Why this is being built now. Business context, user pain points.]

## ${heading('goals')}
- [Specific, measurable objective]

## ${heading('requirements')}

### Feature Area
1. When [trigger], [component] shall [response].
2. [Component] shall [always-true constraint].

Example:
- When user submits form, the validator shall check all required fields within 50ms.
- The auth module shall hash passwords using bcrypt with cost factor 12.

Note: Use specific component names ("Tier 1", "the backend server") instead of generic "system".
Avoid vague responses like "shall work well" - use measurable, testable criteria.

## Tasks

### ${heading('tasks')}
- [ ] First small task
- [ ] Second small task

### Child Specs
[None yet]

## ${heading('prerequisites')}
[What must be done first, if any]

## ${heading('questions')}
- [Unresolved items]
`;

  if (overrides !== undefined) {
    content = applyOverrides(content, overrides);
  }

  if (messages !== undefined && messages.length > 0) {
    content = applyMessages(content, messages, overrides?.overview);
  }

  return content;
}

interface ParsedValues {
  overview?: string;
  background?: string;
  goals?: string[];
  requirements?: string;
  tasks?: string[];
  prerequisites?: string;
  questions?: string[];
  [key: string]: unknown;
}

function validateContentFlags(values: ParsedValues): string | null {
  const stringFlags = ['overview', 'background', 'requirements', 'prerequisites'] as const;
  for (const flag of stringFlags) {
    const val = values[flag];
    if (typeof val === 'string' && val.trim() === '') {
      return `Error: --${flag} requires non-empty text`;
    }
  }
  const arrayFlags = ['goals', 'tasks', 'questions'] as const;
  for (const flag of arrayFlags) {
    const vals = values[flag];
    if (!Array.isArray(vals)) continue;
    const emptyItem = vals.find(v => v.trim() === '');
    if (emptyItem !== undefined) {
      return `Error: --${flag} requires non-empty text`;
    }
  }
  return null;
}

function buildOverrides(values: ParsedValues): SectionOverrides {
  const overrides: SectionOverrides = {};
  if (values.overview !== undefined) overrides.overview = values.overview;
  if (values.background !== undefined) overrides.background = values.background;
  if (values.goals !== undefined) overrides.goals = values.goals;
  if (values.requirements !== undefined) overrides.requirements = values.requirements;
  if (values.tasks !== undefined) overrides.tasks = values.tasks;
  if (values.prerequisites !== undefined) overrides.prerequisites = values.prerequisites;
  if (values.questions !== undefined) overrides.questions = values.questions;
  return overrides;
}

export const command: CommandHandler = {
  name: 'create',
  description: 'Create a new spec',

  getHelp(): CommandHelp {
    return {
      name: 'sc create',
      synopsis:
        'sc create [--status <status>] [--priority <level>] [--parent <id>] [--title <text>] [--message <text>] [--overview <text>] [--goals <text>] ...',
      description: `Create a new spec with auto-generated ID and template content.

Without --parent, creates a root-level spec.
With --parent, creates a child spec in the hierarchy.

The spec is created with a status (default: ready) and populated with a standard template
including sections for Overview, Requirements (EARS format), and Tasks.

Content flags (--overview, --goals, etc.) replace the boilerplate placeholder text in
the corresponding section. Repeatable flags (--goals, --tasks, --questions) can be
specified multiple times to add multiple items.

Optional --message flags append context lines to the Overview section. If --overview is
also provided, -m lines append after the overview text.`,
      flags: [
        {
          flag: '--status <status>, -s',
          description: `Set initial spec status (default: ready). Valid: ${STATUSES.join(', ')}`,
        },
        {
          flag: '--priority <1-10>',
          description: `Set initial priority (default: inherits from parent, or ${DEFAULT_PRIORITY} for root specs). Higher = more urgent (10 highest, 1 lowest).`,
        },
        {
          flag: '--parent <id>, -p',
          description: 'Create as child of specified parent spec',
        },
        {
          flag: '--title <text>, -t',
          description: 'Set spec title (skips interactive prompt)',
        },
        {
          flag: '--message <text>, -m',
          description:
            'Add context line to Overview section (repeatable). Each -m adds a separate line after the placeholder or overview text.',
        },
        {
          flag: '--overview <text>',
          description: 'Set Overview section content (replaces boilerplate)',
        },
        {
          flag: '--background <text>',
          description: 'Set Background & Context section content (replaces boilerplate)',
        },
        {
          flag: '--goals <text>',
          description: 'Add a goal bullet (repeatable). Each --goals adds a "- " line.',
        },
        {
          flag: '--requirements <text>',
          description: 'Set entire Requirements section body (replaces boilerplate including EARS examples)',
        },
        {
          flag: '--tasks <text>',
          description: 'Add a task checkbox (repeatable). Each --tasks adds a "- [ ] " line under Inline Tasks.',
        },
        {
          flag: '--prerequisites <text>',
          description: 'Set Prerequisites section content (replaces boilerplate)',
        },
        {
          flag: '--questions <text>',
          description: 'Add an open question bullet (repeatable). Each --questions adds a "- " line.',
        },
      ],
      examples: [
        '# Interactive creation (prompts for title)',
        'sc create',
        '',
        '# Create with title',
        'sc create -t "Implement OAuth Flow"',
        '',
        '# Create with content (no boilerplate)',
        'sc create -t "User Auth" --overview "Add JWT-based authentication" --goals "Support login/logout" --goals "Session persistence" --tasks "Implement login endpoint" --tasks "Add JWT middleware"',
        '',
        '# Create high-priority spec (10 = highest)',
        'sc create -t "Critical Bug Fix" --priority 10',
        '',
        '# Create with context messages',
        'sc create -t "Database Migration" -m "Required for schema v2"',
        '',
        '# Overview + context messages (messages append after overview)',
        'sc create -t "API Refactor" --overview "Restructure API layer" -m "PR: https://github.com/org/repo/pull/789"',
        '',
        '# Create spec with specific status',
        'sc create --status blocked -t "Premium Features" -m "Waiting on payment gateway"',
        '',
        '# Create as child spec with parent ID (inherits parent priority)',
        'sc create -p a1b2c3 -t "OAuth Callback Handler"',
        '',
        '# EARS requirements inline',
        'sc create -t "Form Validation" --requirements "### Input Validation\\n1. When user submits form, the validator shall check all required fields."',
      ],
      notes: [
        'IDs are auto-generated as 6-character alphanumeric identifiers.',
        'File structure: docs/specs/<slug>-<id>/<slug>-<id>.md',
        'If --status is invalid, shows available options and exits with error.',
        'Messages are appended after the Overview placeholder and preserved as literal text.',
        `Empty or whitespace-only messages are rejected. Max ${MAX_MESSAGE_COUNT} messages, ${MAX_MESSAGE_LENGTH_BYTES / 1000}KB each.`,
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const { values } = parseArgs({
      args,
      options: {
        parent: { type: 'string', short: 'p' },
        title: { type: 'string', short: 't' },
        status: { type: 'string', short: 's' },
        priority: { type: 'string' },
        message: { type: 'string', short: 'm', multiple: true },
        overview: { type: 'string' },
        background: { type: 'string' },
        goals: { type: 'string', multiple: true },
        requirements: { type: 'string' },
        tasks: { type: 'string', multiple: true },
        prerequisites: { type: 'string' },
        questions: { type: 'string', multiple: true },
      },
      allowPositionals: true,
    });

    // Validate status if provided
    const statusInput = values.status ?? 'ready';
    if (!isValidStatus(statusInput)) {
      console.error(`Error: "${values.status}" is not a valid status\n`);
      console.error('Valid statuses are:');
      STATUSES.forEach((s) => console.error(`  ${s}`));
      const help = this.getHelp?.();
      if (help) {
        printCommandUsage(help);
      }
      return 1;
    }

    // Validate priority if provided
    if (values.priority !== undefined) {
      const parsedPriority = parseInt(values.priority, 10);
      if (!isValidPriority(parsedPriority)) {
        console.error(`Error: "${values.priority}" is not a valid priority\n`);
        console.error(`Priority must be an integer from ${MIN_PRIORITY} to ${MAX_PRIORITY} (higher = more urgent)`);
        return 1;
      }
    }

    const title = values.title ?? (await promptForTitle());
    if (title === '') {
      console.error('Error: Title is required');
      return 1;
    }

    const { specs } = await readAllSpecs();
    const existingIds = new Set(specs.map((s) => s.id));
    const id = generateId(existingIds, specs.length);

    const slug = slugify(title);
    const dirPath = await createSpecDirectory(slug, id, values.parent);

    const fileName = `${slug}-${id}.md`;
    const filePath = join(dirPath, fileName);

    const contentError = validateContentFlags(values);
    if (contentError !== null) {
      console.error(contentError);
      return 1;
    }

    const validatedMessages = validateMessages(values.message);
    const priority = determinePriority(values.priority, values.parent, specs);
    const overrides = buildOverrides(values);

    const spec: Spec = {
      id,
      status: statusInput,
      parent: values.parent ?? null,
      blockedBy: [],
      priority,
      pr: null,
      title,
      content: generateSpecTemplate(title, validatedMessages, overrides),
      filePath,
    };

    await writeSpec(spec);

    console.log(`✓ Created: ${spec.filePath}`);
    console.log(`  ID: ${spec.id}`);
    console.log(`  Title: ${spec.title}`);
    console.log(`  Priority: ${spec.priority}`);
    console.log('');
    console.log('📝 Remember to commit your new spec:');
    console.log(`   git add ${dirPath}/`);
    console.log(`   git commit -m "spec: add ${slug}"`);

    return 0;
  },
};
