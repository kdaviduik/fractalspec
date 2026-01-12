/**
 * sc create - Create a new spec
 */

import { parseArgs } from 'util';
import { join } from 'path';
import type { CommandHandler, Spec } from '../types';
import { generateId } from '../id-generation';
import {
  createSpecDirectory,
  getSpecsRoot,
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
1. When [trigger], the system shall [response].
2. The system shall [always-true constraint].

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

  async execute(args: string[]): Promise<number> {
    const { values } = parseArgs({
      args,
      options: {
        parent: { type: 'string', short: 'p' },
        title: { type: 'string', short: 't' },
      },
      allowPositionals: true,
    });

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
      status: 'ready',
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
