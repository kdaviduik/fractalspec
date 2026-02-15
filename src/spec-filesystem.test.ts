import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createSpecDirectory,
  readAllSpecs,
  writeSpec,
  getSpecCount,
  findSpecFile,
  setSpecsRoot,
  getSpecsRoot,
} from './spec-filesystem';
import type { Spec } from './types';

async function directoryExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

let testDir: string;
let specsDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'sc-test-'));
  specsDir = join(testDir, 'docs', 'specs');
  setSpecsRoot(specsDir);
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('getSpecsRoot and setSpecsRoot', () => {
  test('returns configured specs root', async () => {
    expect(await getSpecsRoot()).toBe(specsDir);
  });
});

describe('createSpecDirectory', () => {
  test('creates directory with slug-id format', async () => {
    const dirPath = await createSpecDirectory('my-feature', 'a1b2');

    expect(dirPath).toBe(join(specsDir, 'my-feature-a1b2'));

    const exists = await directoryExists(dirPath);
    expect(exists).toBe(true);
  });

  test('creates nested directory for child specs', async () => {
    const parentDir = await createSpecDirectory('parent', 'a1b2');

    const parentSpec: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Parent',
      content: '# Spec: Parent',
      filePath: join(parentDir, 'parent-a1b2.md'),
    };
    await writeSpec(parentSpec);

    const childPath = await createSpecDirectory('child', 'c3d4', 'a1b2');

    expect(childPath).toBe(join(specsDir, 'parent-a1b2', 'child-c3d4'));
    expect(await directoryExists(childPath)).toBe(true);
  });
});

describe('writeSpec', () => {
  test('writes spec file to correct location', async () => {
    const spec: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Test Feature',
      content: '# Spec: Test Feature\n\nTest content.',
      filePath: join(specsDir, 'test-feature-a1b2', 'test-feature-a1b2.md'),
    };

    await writeSpec(spec);

    const file = Bun.file(spec.filePath);
    const exists = await file.exists();
    expect(exists).toBe(true);

    const content = await file.text();
    expect(content).toContain('id: a1b2');
    expect(content).toContain('# Spec: Test Feature');
  });
});

describe('readAllSpecs', () => {
  test('returns { specs, failures } with empty arrays when no specs exist', async () => {
    const result = await readAllSpecs();
    expect(result.specs).toEqual([]);
    expect(result.failures).toEqual([]);
  });

  test('reads all specs from directory tree', async () => {
    const spec1: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'First',
      content: '# Spec: First',
      filePath: join(specsDir, 'first-a1b2', 'first-a1b2.md'),
    };

    const spec2: Spec = {
      id: 'c3d4',
      status: 'blocked',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Second',
      content: '# Spec: Second',
      filePath: join(specsDir, 'second-c3d4', 'second-c3d4.md'),
    };

    await createSpecDirectory('first', 'a1b2');
    await createSpecDirectory('second', 'c3d4');
    await writeSpec(spec1);
    await writeSpec(spec2);

    const { specs } = await readAllSpecs();

    expect(specs).toHaveLength(2);
    const ids = specs.map((s) => s.id).sort();
    expect(ids).toEqual(['a1b2', 'c3d4']);
  });

  test('reads nested child specs', async () => {
    const parent: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Parent',
      content: '# Spec: Parent',
      filePath: join(specsDir, 'parent-a1b2', 'parent-a1b2.md'),
    };

    const child: Spec = {
      id: 'c3d4',
      status: 'ready',
      parent: 'a1b2',
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Child',
      content: '# Spec: Child',
      filePath: join(specsDir, 'parent-a1b2', 'child-c3d4', 'child-c3d4.md'),
    };

    await createSpecDirectory('parent', 'a1b2');
    await createSpecDirectory('child', 'c3d4', 'a1b2');
    await writeSpec(parent);
    await writeSpec(child);

    const { specs } = await readAllSpecs();

    expect(specs).toHaveLength(2);
  });

  test('returns parse failures for broken spec files', async () => {
    const validSpec: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Valid',
      content: '# Spec: Valid',
      filePath: join(specsDir, 'valid-a1b2', 'valid-a1b2.md'),
    };
    await createSpecDirectory('valid', 'a1b2');
    await writeSpec(validSpec);

    const brokenDir = join(specsDir, 'broken-x1y2');
    const { mkdir } = await import('fs/promises');
    await mkdir(brokenDir, { recursive: true });
    await Bun.write(join(brokenDir, 'broken-x1y2.md'), `---
id: x1y2
status: done
parent: null
blockedBy: []
---

# Spec: Broken
`);

    const { specs, failures } = await readAllSpecs();
    expect(specs).toHaveLength(1);
    const firstSpec = specs[0];
    if (firstSpec === undefined) { expect(firstSpec).toBeDefined(); return; }
    expect(firstSpec.id).toBe('a1b2');
    expect(failures).toHaveLength(1);
    const firstFailure = failures[0];
    if (firstFailure === undefined) { expect(firstFailure).toBeDefined(); return; }
    expect(firstFailure.filePath).toContain('broken-x1y2');
    expect(firstFailure.error).toContain('status');
  });

  test('includes field and actualValue in failures for ParseErrors', async () => {
    const brokenDir = join(specsDir, 'broken-z9z9');
    const { mkdir } = await import('fs/promises');
    await mkdir(brokenDir, { recursive: true });
    await Bun.write(join(brokenDir, 'broken-z9z9.md'), `---
id: z9z9
status: wip
parent: null
blockedBy: []
---

# Spec: WIP
`);

    const { failures } = await readAllSpecs();
    expect(failures).toHaveLength(1);
    const failure = failures[0];
    if (failure === undefined) { expect(failure).toBeDefined(); return; }
    expect(failure.field).toBe('status');
    expect(failure.actualValue).toBe('wip');
  });

  test('captures malformed YAML errors in failures', async () => {
    const brokenDir = join(specsDir, 'bad-yaml-q1q1');
    const { mkdir } = await import('fs/promises');
    await mkdir(brokenDir, { recursive: true });
    await Bun.write(join(brokenDir, 'bad-yaml-q1q1.md'), `---
id: [invalid yaml
status: ready
---

# Spec: Bad YAML
`);

    const { failures } = await readAllSpecs();
    expect(failures).toHaveLength(1);
    const failure = failures[0];
    if (failure === undefined) { expect(failure).toBeDefined(); return; }
    expect(failure.filePath).toContain('bad-yaml-q1q1');
    expect(failure.field).toBeUndefined();
  });
});

describe('getSpecCount', () => {
  test('returns 0 when no specs exist', async () => {
    const count = await getSpecCount();
    expect(count).toBe(0);
  });

  test('returns correct count of specs', async () => {
    const spec1: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'First',
      content: '# Spec: First',
      filePath: join(specsDir, 'first-a1b2', 'first-a1b2.md'),
    };

    const spec2: Spec = {
      id: 'c3d4',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Second',
      content: '# Spec: Second',
      filePath: join(specsDir, 'second-c3d4', 'second-c3d4.md'),
    };

    await createSpecDirectory('first', 'a1b2');
    await createSpecDirectory('second', 'c3d4');
    await writeSpec(spec1);
    await writeSpec(spec2);

    const count = await getSpecCount();
    expect(count).toBe(2);
  });
});

describe('findSpecFile', () => {
  test('finds spec by full ID', async () => {
    const spec: Spec = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Test',
      content: '# Spec: Test',
      filePath: join(specsDir, 'test-a1b2', 'test-a1b2.md'),
    };

    await createSpecDirectory('test', 'a1b2');
    await writeSpec(spec);

    const result = await findSpecFile('a1b2');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('a1b2');
  });

  test('finds spec by partial ID', async () => {
    const spec: Spec = {
      id: 'a1b2c3',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Test',
      content: '# Spec: Test',
      filePath: join(specsDir, 'test-a1b2c3', 'test-a1b2c3.md'),
    };

    await createSpecDirectory('test', 'a1b2c3');
    await writeSpec(spec);

    const result = await findSpecFile('a1b2');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('a1b2c3');
  });

  test('returns null for non-existent ID', async () => {
    const result = await findSpecFile('nonexistent');
    expect(result).toBeNull();
  });
});
