/**
 * Filesystem operations for specs.
 * Handles reading, writing, and finding spec files.
 */

import { mkdir, readdir } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { parseSpec } from './spec-parser';
import { serializeSpec } from './spec-serializer';
import type { Spec } from './types';

let specsRoot = 'docs/specs';

export function getSpecsRoot(): string {
  return specsRoot;
}

export function setSpecsRoot(path: string): void {
  specsRoot = path;
}

export async function createSpecDirectory(
  slug: string,
  id: string,
  parentId?: string
): Promise<string> {
  const dirName = `${slug}-${id}`;

  let basePath = specsRoot;
  if (parentId) {
    const allSpecs = await readAllSpecs();
    const parent = allSpecs.find((s) => s.id === parentId);
    if (parent) {
      basePath = dirname(parent.filePath);
    }
  }

  const dirPath = join(basePath, dirName);
  await mkdir(dirPath, { recursive: true });
  return dirPath;
}

export async function writeSpec(spec: Spec): Promise<void> {
  const dirPath = dirname(spec.filePath);
  await mkdir(dirPath, { recursive: true });

  const content = serializeSpec(spec);
  await Bun.write(spec.filePath, content);
}

async function findSpecFilesRecursive(dir: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const nested = await findSpecFilesRecursive(fullPath);
        results.push(...nested);
        continue;
      }

      if (entry.name.endsWith('.md') && entry.name === `${basename(dir)}.md`) {
        results.push(fullPath);
      }
    }
  } catch {
    return [];
  }

  return results;
}

export async function readAllSpecs(): Promise<Spec[]> {
  const specFiles = await findSpecFilesRecursive(specsRoot);
  const specs: Spec[] = [];

  for (const filePath of specFiles) {
    try {
      const content = await Bun.file(filePath).text();
      const spec = parseSpec(filePath, content);
      specs.push(spec);
    } catch {
      continue;
    }
  }

  return specs;
}

export async function getSpecCount(): Promise<number> {
  const specs = await readAllSpecs();
  return specs.length;
}

export async function findSpecFile(idPrefix: string): Promise<Spec | null> {
  const specs = await readAllSpecs();

  const exactMatch = specs.find((s) => s.id === idPrefix);
  if (exactMatch) {
    return exactMatch;
  }

  const prefixMatches = specs.filter((s) => s.id.startsWith(idPrefix));
  if (prefixMatches.length === 1 && prefixMatches[0]) {
    return prefixMatches[0];
  }

  return null;
}
