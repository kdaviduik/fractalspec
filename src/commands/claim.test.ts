import { describe, expect, test, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { command } from './claim';
import { setSpecsRoot, writeSpec } from '../spec-filesystem';
import type { Spec } from '../types';
import * as claimLogic from '../claim-logic';
import * as gitOps from '../git-operations';

let testDir: string;
let specsDir: string;
let originalConsoleError: typeof console.error;
let originalConsoleLog: typeof console.log;
let errorMessages: string[] = [];
let logMessages: string[] = [];

function makeSpec(id: string, overrides: Partial<Spec> = {}): Spec {
  return {
    id,
    status: 'ready',
    parent: null,
    blockedBy: [],
    priority: 5,
    pr: null,
    title: `Test ${id}`,
    content: `# Spec: Test ${id}`,
    filePath: join(specsDir, `test-${id}`, `test-${id}.md`),
    ...overrides,
  };
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'sc-claim-cmd-test-'));
  specsDir = join(testDir, 'docs', 'specs');
  setSpecsRoot(specsDir);

  originalConsoleError = console.error;
  originalConsoleLog = console.log;
  errorMessages = [];
  logMessages = [];

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
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  mock.restore();
  await rm(testDir, { recursive: true, force: true });
});

describe('sc claim - help', () => {
  test('provides help documentation', () => {
    const help = command.getHelp?.();
    expect(help).toBeDefined();
    expect(help?.synopsis).toContain('--cd');
  });

  test('includes --cd flag in flags list', () => {
    const help = command.getHelp?.();
    expect(help?.flags?.some((f) => f.flag.includes('--cd'))).toBe(true);
    expect(help?.flags?.some((f) => f.flag.includes('-C'))).toBe(true);
  });

  test('includes eval example in help', () => {
    const help = command.getHelp?.();
    const examples = help?.examples?.join(' ') ?? '';
    expect(examples).toContain('eval');
  });

  test('includes notes about --cd behavior', () => {
    const help = command.getHelp?.();
    const notes = help?.notes?.join(' ') ?? '';
    expect(notes).toContain('--cd');
    expect(notes).toContain('stderr');
    expect(notes).toContain('stdout');
  });
});

describe('sc claim - validation errors', () => {
  test('returns error when no spec ID provided', async () => {
    const result = await command.execute([]);
    expect(result).toBe(1);
  });

  test('returns error when spec not found', async () => {
    const result = await command.execute(['nonexistent']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('Spec not found');
  });

  test('returns error when spec not found with --cd (stdout empty)', async () => {
    const result = await command.execute(['--cd', 'nonexistent']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('Spec not found');
    expect(logMessages).toHaveLength(0);
  });

  test('returns error when claim fails', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: false,
      branchName: '',
      error: 'Already claimed',
    });

    const result = await command.execute(['a1b2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('Failed to claim');
  });

  test('returns error when claim fails with --cd (stdout empty)', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: false,
      branchName: '',
      error: 'Already claimed',
    });

    const result = await command.execute(['--cd', 'a1b2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('Failed to claim');
    expect(logMessages).toHaveLength(0);
  });
});

describe('sc claim - default behavior (without --cd)', () => {
  test('outputs human-readable success message', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue('/abs/path/work-test-a1b2-a1b2');

    const result = await command.execute(['a1b2']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Claimed: Test a1b2');
    expect(logMessages.join(' ')).toContain('in_progress');
    expect(logMessages.join(' ')).toContain('To start working');
    expect(logMessages.join(' ')).toContain('cd');
  });

  test('outputs worktree path in cd instruction', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue('/abs/path/work-test-a1b2-a1b2');

    await command.execute(['a1b2']);
    expect(logMessages.join(' ')).toContain('/abs/path/work-test-a1b2-a1b2');
  });
});

describe('sc claim --cd flag', () => {
  test('outputs only cd command to stdout on success', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue('/abs/path/work-test-a1b2-a1b2');

    const result = await command.execute(['--cd', 'a1b2']);
    expect(result).toBe(0);
    expect(logMessages).toHaveLength(1);
    expect(logMessages[0]).toBe("cd '/abs/path/work-test-a1b2-a1b2'");
  });

  test('outputs status info to stderr on success', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue('/abs/path/work-test-a1b2-a1b2');

    await command.execute(['--cd', 'a1b2']);
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0]).toContain('Claimed: Test a1b2');
    expect(errorMessages[0]).toContain('in_progress');
  });

  test('outputs absolute path (starts with /)', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue('/home/user/work-test-a1b2-a1b2');

    await command.execute(['--cd', 'a1b2']);
    expect(logMessages[0]).toMatch(/^cd '\/.*'$/);
  });

  test('properly single-quotes path for shell safety', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue('/path/to/work-test-a1b2-a1b2');

    await command.execute(['--cd', 'a1b2']);
    expect(logMessages[0]).toBe("cd '/path/to/work-test-a1b2-a1b2'");
  });

  test('escapes embedded single quotes in path', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue("/path/with'quote/work-a1b2");

    await command.execute(['--cd', 'a1b2']);
    expect(logMessages[0]).toBe("cd '/path/with'\\''quote/work-a1b2'");
  });
});

describe('sc claim --cd flag position variations', () => {
  test('accepts --cd before spec ID', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue('/abs/path/work-test-a1b2-a1b2');

    const result = await command.execute(['--cd', 'a1b2']);
    expect(result).toBe(0);
    expect(logMessages[0]).toContain("cd '");
  });

  test('accepts --cd after spec ID', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue('/abs/path/work-test-a1b2-a1b2');

    const result = await command.execute(['a1b2', '--cd']);
    expect(result).toBe(0);
    expect(logMessages[0]).toContain("cd '");
  });

  test('accepts -C short flag before spec ID', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue('/abs/path/work-test-a1b2-a1b2');

    const result = await command.execute(['-C', 'a1b2']);
    expect(result).toBe(0);
    expect(logMessages[0]).toContain("cd '");
  });

  test('accepts -C short flag after spec ID', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });
    spyOn(gitOps, 'getWorkWorktreePath').mockResolvedValue('/abs/path/work-test-a1b2-a1b2');

    const result = await command.execute(['a1b2', '-C']);
    expect(result).toBe(0);
    expect(logMessages[0]).toContain("cd '");
  });
});

describe('sc claim - error cases with --cd (stdout must be empty)', () => {
  test('stdout empty on invalid spec ID with --cd', async () => {
    const result = await command.execute(['--cd', 'INVALID123']);
    expect(result).toBe(1);
    expect(logMessages).toHaveLength(0);
    expect(errorMessages.length).toBeGreaterThan(0);
  });

  test('stdout empty when no spec ID with --cd', async () => {
    const result = await command.execute(['--cd']);
    expect(result).toBe(1);
    expect(logMessages).toHaveLength(0);
  });

  test('stdout empty when claim fails with --cd', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: false,
      branchName: '',
      error: 'Spec already claimed',
    });

    const result = await command.execute(['--cd', 'a1b2']);
    expect(result).toBe(1);
    expect(logMessages).toHaveLength(0);
    expect(errorMessages.join(' ')).toContain('Failed to claim');
  });
});
