/**
 * Filesystem operations for specs.
 * Handles reading, writing, and finding spec files.
 */

import { mkdir, readdir, rm, rename } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { randomUUID } from 'crypto';
import { parseSpec, ParseError } from './spec-parser';
import { serializeSpec } from './spec-serializer';
import type { Spec } from './types';
import { findGitRoot } from './git-operations';

export interface SpecParseFailure {
  filePath: string;
  error: string;
  field?: string | undefined;
  actualValue?: string | undefined;
}

export interface ReadAllSpecsResult {
  specs: Spec[];
  failures: SpecParseFailure[];
}

let cachedSpecsRoot: string | null = null;

export async function getSpecsRoot(): Promise<string> {
  if (cachedSpecsRoot !== null) return cachedSpecsRoot;
  const gitRoot = await findGitRoot();
  cachedSpecsRoot = join(gitRoot, 'docs', 'specs');
  return cachedSpecsRoot;
}

export function setSpecsRoot(path: string): void {
  cachedSpecsRoot = path;
}

export async function createSpecDirectory(
  slug: string,
  id: string,
  parentId?: string
): Promise<string> {
  const dirName = `${slug}-${id}`;

  let basePath = await getSpecsRoot();
  if (parentId !== undefined) {
    const { specs: allSpecs } = await readAllSpecs();
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

  // Atomic write: write to temp file in same directory, then rename
  // Rename is atomic on POSIX when source and target are on the same filesystem
  const tempPath = join(dirPath, `.tmp-${randomUUID()}.md`);
  await Bun.write(tempPath, content);
  await rename(tempPath, spec.filePath);
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

export async function readAllSpecs(): Promise<ReadAllSpecsResult> {
  const specsRootPath = await getSpecsRoot();
  const specFiles = await findSpecFilesRecursive(specsRootPath);
  const specs: Spec[] = [];
  const failures: SpecParseFailure[] = [];

  for (const filePath of specFiles) {
    try {
      const content = await Bun.file(filePath).text();
      const spec = parseSpec(filePath, content);
      specs.push(spec);
    } catch (err: unknown) {
      if (err instanceof ParseError) {
        failures.push({
          filePath,
          error: err.message,
          field: err.field,
          actualValue: err.actualValue,
        });
      } else {
        failures.push({
          filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { specs, failures };
}

export async function getSpecCount(): Promise<number> {
  const { specs } = await readAllSpecs();
  return specs.length;
}

export interface FindSpecResult {
  spec: Spec | null;
  failures: SpecParseFailure[];
}

export async function findSpecFile(idPrefix: string): Promise<Spec | null> {
  const { spec } = await findSpecFileWithFailures(idPrefix);
  return spec;
}

export async function findSpecFileWithFailures(idPrefix: string): Promise<FindSpecResult> {
  const { specs, failures } = await readAllSpecs();

  const exactMatch = specs.find((s) => s.id === idPrefix);
  if (exactMatch) {
    return { spec: exactMatch, failures };
  }

  const prefixMatches = specs.filter((s) => s.id.startsWith(idPrefix));
  if (prefixMatches.length === 1 && prefixMatches[0]) {
    return { spec: prefixMatches[0], failures };
  }

  return { spec: null, failures };
}

export async function deleteSpec(spec: Spec): Promise<void> {
  const specDir = dirname(spec.filePath);
  await rm(specDir, { recursive: true, force: true });
}

export async function readRawSpecContent(filePath: string): Promise<string> {
  return await Bun.file(filePath).text();
}
