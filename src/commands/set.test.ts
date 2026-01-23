import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm, readdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { command } from './set';
import {
  createSpecDirectory,
  writeSpec,
  setSpecsRoot,
  findSpecFile,
} from '../spec-filesystem';
import type { Spec } from '../types';
import { STATUSES } from '../types';

let testDir: string;
let specsDir: string;
let originalExit: typeof process.exit;
let originalConsoleError: typeof console.error;
let originalConsoleLog: typeof console.log;
let exitCode: number | null = null;
let errorMessages: string[] = [];
let logMessages: string[] = [];

function makeSpec(
  id: string,
  overrides: Partial<Spec> = {}
): Spec {
  return {
    id,
    status: 'ready',
    parent: null,
    blocks: [],
    priority: 5,
    title: `Spec ${id}`,
    content: `# Spec: Spec ${id}`,
    filePath: join(specsDir, `spec-${id}`, `spec-${id}.md`),
    ...overrides,
  };
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'sc-set-test-'));
  specsDir = join(testDir, 'docs', 'specs');
  setSpecsRoot(specsDir);

  originalExit = process.exit;
  originalConsoleError = console.error;
  originalConsoleLog = console.log;
  exitCode = null;
  errorMessages = [];
  logMessages = [];

  Object.defineProperty(process, 'exit', {
    value: (code?: number) => {
      exitCode = code ?? 0;
      throw new Error(`Process.exit called with code ${code}`);
    },
    configurable: true,
  });

  Object.defineProperty(console, 'error', {
    value: (...args: unknown[]) => {
      errorMessages.push(args.join(' '));
    },
    configurable: true,
  });

  Object.defineProperty(console, 'log', {
    value: (...args: unknown[]) => {
      logMessages.push(args.join(' '));
    },
    configurable: true,
  });
});

afterEach(async () => {
  process.exit = originalExit;
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  await rm(testDir, { recursive: true, force: true });
});

describe('sc set - help', () => {
  test('provides help documentation', () => {
    const help = command.getHelp?.();
    expect(help).toBeDefined();
    expect(help?.synopsis).toContain('--priority');
    expect(help?.synopsis).toContain('--status');
    expect(help?.synopsis).toContain('--parent');
    expect(help?.synopsis).toContain('--block');
    expect(help?.synopsis).toContain('--unblock');
  });

  test('includes all status values in help', () => {
    const help = command.getHelp?.();
    const statusFlag = help?.flags?.find((f) => f.flag.includes('--status'));
    expect(statusFlag).toBeDefined();
    for (const status of STATUSES) {
      expect(statusFlag?.description).toContain(status);
    }
  });

  test('includes examples', () => {
    const help = command.getHelp?.();
    expect(help?.examples).toBeDefined();
    expect(help?.examples?.length).toBeGreaterThan(0);
  });
});

describe('sc set - validation errors', () => {
  test('returns error when no spec ID provided', async () => {
    const result = await command.execute([]);
    expect(result).toBe(1);
  });

  test('returns error when no flags provided', async () => {
    const spec = makeSpec('a1b2');
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('At least one flag is required');
  });

  test('returns error when spec not found', async () => {
    const result = await command.execute(['nonexistent', '--priority', '8']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('Spec not found');
  });

  test('rejects empty spec ID', async () => {
    expect(() => command.execute(['', '--priority', '5'])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('cannot be empty');
  });
});

describe('sc set --priority', () => {
  test('sets priority to valid value', async () => {
    const spec = makeSpec('a1b2', { priority: 5 });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--priority', '8']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Priority set to 8');

    const updated = await findSpecFile('a1b2');
    expect(updated?.priority).toBe(8);
  });

  test('rejects invalid priority 0', async () => {
    expect(() => command.execute(['a1b2', '--priority', '0'])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('Invalid priority');
  });

  test('rejects invalid priority 11', async () => {
    expect(() => command.execute(['a1b2', '--priority', '11'])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('Invalid priority');
  });

  test('rejects non-numeric priority', async () => {
    expect(() => command.execute(['a1b2', '--priority', 'high'])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('Invalid priority');
  });

  test('idempotent: setting same priority twice succeeds', async () => {
    const spec = makeSpec('a1b2', { priority: 8 });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--priority', '8']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('already 8');
  });
});

describe('sc set --status', () => {
  test('sets status to valid value', async () => {
    const spec = makeSpec('a1b2', { status: 'ready' });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--status', 'blocked']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Status set to blocked');

    const updated = await findSpecFile('a1b2');
    expect(updated?.status).toBe('blocked');
  });

  test('sets status to deferred', async () => {
    const spec = makeSpec('a1b2', { status: 'ready' });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--status', 'deferred']);
    expect(result).toBe(0);

    const updated = await findSpecFile('a1b2');
    expect(updated?.status).toBe('deferred');
  });

  test('sets status to not_planned', async () => {
    const spec = makeSpec('a1b2', { status: 'ready' });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--status', 'not_planned']);
    expect(result).toBe(0);

    const updated = await findSpecFile('a1b2');
    expect(updated?.status).toBe('not_planned');
  });

  test('rejects invalid status', async () => {
    expect(() => command.execute(['a1b2', '--status', 'invalid'])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('Invalid status');
  });

  test('idempotent: setting same status twice succeeds', async () => {
    const spec = makeSpec('a1b2', { status: 'blocked' });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--status', 'blocked']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('already blocked');
  });
});

describe('sc set --parent', () => {
  test('sets parent to valid spec', async () => {
    const parent = makeSpec('p1', { title: 'Parent' });
    const child = makeSpec('c1', { title: 'Child' });
    await createSpecDirectory('spec', 'p1');
    await createSpecDirectory('spec', 'c1');
    await writeSpec(parent);
    await writeSpec(child);

    const result = await command.execute(['c1', '--parent', 'p1']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Parent set to p1');

    const updated = await findSpecFile('c1');
    expect(updated?.parent).toBe('p1');
  });

  test('removes parent with --parent none', async () => {
    const parent = makeSpec('p1');
    const child = makeSpec('c1', { parent: 'p1' });
    await createSpecDirectory('spec', 'p1');
    await createSpecDirectory('spec', 'c1');
    await writeSpec(parent);
    await writeSpec(child);

    const result = await command.execute(['c1', '--parent', 'none']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Removed parent');

    const updated = await findSpecFile('c1');
    expect(updated?.parent).toBeNull();
  });

  test('returns error when parent spec not found', async () => {
    const spec = makeSpec('a1b2');
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--parent', 'nonexistent']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('Parent spec not found');
  });

  test('rejects empty parent ID', async () => {
    expect(() => command.execute(['a1b2', '--parent', ''])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('cannot be empty');
  });

  test('idempotent: setting same parent twice succeeds', async () => {
    const parent = makeSpec('p1');
    const child = makeSpec('c1', { parent: 'p1' });
    await createSpecDirectory('spec', 'p1');
    await createSpecDirectory('spec', 'c1');
    await writeSpec(parent);
    await writeSpec(child);

    const result = await command.execute(['c1', '--parent', 'p1']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('already p1');
  });

  test('idempotent: --parent none on root spec succeeds', async () => {
    const spec = makeSpec('a1b2', { parent: null });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--parent', 'none']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Already a root spec');
  });

  test('detects parent cycle A->B->A', async () => {
    const specA = makeSpec('aaa1', { parent: null });
    const specB = makeSpec('bbb2', { parent: 'aaa1' });
    await createSpecDirectory('spec', 'aaa1');
    await createSpecDirectory('spec', 'bbb2');
    await writeSpec(specA);
    await writeSpec(specB);

    const result = await command.execute(['aaa1', '--parent', 'bbb2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('would create a cycle');
  });

  test('detects parent cycle A->B->C->A', async () => {
    const specA = makeSpec('aaa1', { parent: null });
    const specB = makeSpec('bbb2', { parent: 'aaa1' });
    const specC = makeSpec('ccc3', { parent: 'bbb2' });
    await createSpecDirectory('spec', 'aaa1');
    await createSpecDirectory('spec', 'bbb2');
    await createSpecDirectory('spec', 'ccc3');
    await writeSpec(specA);
    await writeSpec(specB);
    await writeSpec(specC);

    const result = await command.execute(['aaa1', '--parent', 'ccc3']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('would create a cycle');
  });
});

describe('sc set --block', () => {
  test('adds blocking dependency', async () => {
    const spec = makeSpec('a1b2', { blocks: [] });
    const blocker = makeSpec('b3c4');
    await createSpecDirectory('spec', 'a1b2');
    await createSpecDirectory('spec', 'b3c4');
    await writeSpec(spec);
    await writeSpec(blocker);

    const result = await command.execute(['a1b2', '--block', 'b3c4']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Added blocker b3c4');

    const updated = await findSpecFile('a1b2');
    expect(updated?.blocks).toContain('b3c4');
  });

  test('returns error when blocker spec not found', async () => {
    const spec = makeSpec('a1b2');
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--block', 'nonexistent']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('Blocker spec not found');
  });

  test('rejects self-blocking', async () => {
    const spec = makeSpec('a1b2');
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--block', 'a1b2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('cannot block itself');
  });

  test('rejects empty block ID', async () => {
    expect(() => command.execute(['a1b2', '--block', ''])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('cannot be empty');
  });

  test('idempotent: adding existing blocker succeeds', async () => {
    const spec = makeSpec('a1b2', { blocks: ['b3c4'] });
    const blocker = makeSpec('b3c4');
    await createSpecDirectory('spec', 'a1b2');
    await createSpecDirectory('spec', 'b3c4');
    await writeSpec(spec);
    await writeSpec(blocker);

    const result = await command.execute(['a1b2', '--block', 'b3c4']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Already blocked by b3c4');
  });

  test('detects blocker cycle A blocks B blocks A', async () => {
    const specA = makeSpec('aaa1', { blocks: [] });
    const specB = makeSpec('bbb2', { blocks: ['aaa1'] });
    await createSpecDirectory('spec', 'aaa1');
    await createSpecDirectory('spec', 'bbb2');
    await writeSpec(specA);
    await writeSpec(specB);

    const result = await command.execute(['aaa1', '--block', 'bbb2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('would create a cycle');
  });
});

describe('sc set --unblock', () => {
  test('removes blocking dependency', async () => {
    const spec = makeSpec('a1b2', { blocks: ['b3c4'] });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--unblock', 'b3c4']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Removed blocker b3c4');

    const updated = await findSpecFile('a1b2');
    expect(updated?.blocks).not.toContain('b3c4');
  });

  test('rejects empty unblock ID', async () => {
    expect(() => command.execute(['a1b2', '--unblock', ''])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('cannot be empty');
  });

  test('idempotent: removing non-existent blocker succeeds', async () => {
    const spec = makeSpec('a1b2', { blocks: [] });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--unblock', 'b3c4']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Not blocked by b3c4');
  });
});

describe('sc set - multiple flags', () => {
  test('combines priority and status changes', async () => {
    const spec = makeSpec('a1b2', { priority: 5, status: 'ready' });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    const result = await command.execute(['a1b2', '--priority', '10', '--status', 'in_progress']);
    expect(result).toBe(0);

    const updated = await findSpecFile('a1b2');
    expect(updated?.priority).toBe(10);
    expect(updated?.status).toBe('in_progress');
  });
});

describe('sc set - atomic writes', () => {
  test('no temp files remain after successful write', async () => {
    const spec = makeSpec('a1b2', { priority: 5 });
    await createSpecDirectory('spec', 'a1b2');
    await writeSpec(spec);

    await command.execute(['a1b2', '--priority', '8']);

    const specDirPath = join(specsDir, 'spec-a1b2');
    const files = await readdir(specDirPath);
    const tempFiles = files.filter((f) => f.startsWith('.tmp-'));
    expect(tempFiles).toHaveLength(0);
  });
});
