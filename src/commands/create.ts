/**
 * sc create - Create a new spec
 */

import { parseArgs } from 'util';
import { join } from 'path';
import type { CommandHandler, Spec } from '../types';
import { STATUSES, isValidStatus } from '../types';
import type { CommandHelp } from '../help.js';
import { printCommandUsage } from '../help.js';
import { generateId } from '../id-generation';
import {
  createSpecDirectory,
  readAllSpecs,
  writeSpec,
} from '../spec-filesystem';

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

function generateSpecTemplate(title: string): string {
  return `# Spec: ${title}

## Overview
[2-3 sentences: what this is and why it matters]

## Background & Context
[Why this is being built now. Business context, user pain points.]

## Goals
- [Specific, measurable objective]

## Requirements (EARS format)

### Feature Area
1. When [trigger], [component] shall [response].
2. [Component] shall [always-true constraint].

Example:
- When user submits form, the validator shall check all required fields within 50ms.
- The auth module shall hash passwords using bcrypt with cost factor 12.

Note: Use specific component names ("Tier 1", "the backend server") instead of generic "system".
Avoid vague responses like "shall work well" - use measurable, testable criteria.

## Tasks

### Inline Tasks
- [ ] First small task
- [ ] Second small task

### Child Specs
[None yet]

## Prerequisites
[What must be done first, if any]

## Open Questions
- [Unresolved items]
`;
}

export const command: CommandHandler = {
  name: 'create',
  description: 'Create a new spec',

  getHelp(): CommandHelp {
    return {
      name: 'sc create',
      synopsis: 'sc create [--status <status>] [--parent <id>] [--title <text>]',
      description: `Create a new spec with auto-generated ID and template content.

Without --parent, creates a root-level spec.
With --parent, creates a child spec in the hierarchy.

The spec is created with a status (default: ready) and populated with a standard template
including sections for Overview, Requirements (EARS format), and Tasks.`,
      flags: [
        {
          flag: '--status <status>, -s',
          description: `Set initial spec status (default: ready). Valid: ${STATUSES.join(', ')}`,
        },
        {
          flag: '--parent <id>, -p',
          description: 'Create as child of specified parent spec',
        },
        {
          flag: '--title <text>, -t',
          description: 'Set spec title (skips interactive prompt)',
        },
      ],
      examples: [
        '# Create root spec (prompted for title)',
        'sc create',
        '',
        '# Create with title',
        'sc create -t "User Authentication"',
        '',
        '# Create spec with specific status',
        'sc create --status blocked -t "Future Implementation"',
        '',
        '# Create child spec with custom status',
        'sc create -p a1b2c3 --status deferred -t "Deferred Task"',
      ],
      notes: [
        'IDs are auto-generated as 6-character alphanumeric identifiers.',
        'File structure: docs/specs/<slug>-<id>/<slug>-<id>.md',
        'If --status is invalid, shows available options and exits with error.',
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
      },
      allowPositionals: true,
    });

    // Validate status if provided
    const statusInput = values.status ?? 'ready';
    if (!isValidStatus(statusInput)) {
      console.error(`Error: "${values.status}" is not a valid status\n`);
      console.error('Valid statuses are:');
      STATUSES.forEach((s) => console.error(`  ${s}`));
      printCommandUsage(this.getHelp!());
      return 1;
    }
    // TypeScript now knows statusInput is a valid Status (type narrowing)

    const title = values.title ?? (await promptForTitle());
    if (!title) {
      console.error('Title is required');
      return 1;
    }

    const specs = await readAllSpecs();
    const existingIds = new Set(specs.map((s) => s.id));
    const id = generateId(existingIds, specs.length);

    const slug = slugify(title);
    const dirPath = await createSpecDirectory(slug, id, values.parent);

    const fileName = `${slug}-${id}.md`;
    const filePath = join(dirPath, fileName);

    const spec: Spec = {
      id,
      status: statusInput,
      parent: values.parent ?? null,
      blocks: [],
      title,
      content: generateSpecTemplate(title),
      filePath,
    };

    await writeSpec(spec);

    console.log(`Created spec: ${spec.title}`);
    console.log(`  ID: ${spec.id}`);
    console.log(`  Path: ${spec.filePath}`);

    return 0;
  },
};
