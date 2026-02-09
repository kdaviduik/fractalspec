import { describe, expect, test, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { command } from './claim';
import { setSpecsRoot, writeSpec } from '../spec-filesystem';
import type { Spec } from '../types';
import * as claimLogic from '../claim-logic';

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
    expect(help?.synopsis).toContain('--worktree');
    expect(help?.synopsis).toContain('--cd');
  });

  test('includes --worktree flag in flags list', () => {
    const help = command.getHelp?.();
    expect(help?.flags?.some((f) => f.flag.includes('--worktree'))).toBe(true);
    expect(help?.flags?.some((f) => f.flag.includes('-W'))).toBe(true);
  });

  test('includes --cd flag in flags list', () => {
    const help = command.getHelp?.();
    expect(help?.flags?.some((f) => f.flag.includes('--cd'))).toBe(true);
    expect(help?.flags?.some((f) => f.flag.includes('-C'))).toBe(true);
  });

  test('includes branch mode as default in description', () => {
    const help = command.getHelp?.();
    expect(help?.description).toContain('branch');
    expect(help?.description).toContain('--worktree');
  });

  test('includes examples for both modes', () => {
    const help = command.getHelp?.();
    const examples = help?.examples?.join(' ') ?? '';
    expect(examples).toContain('--worktree');
    expect(examples).toContain('sc claim a1b2c3');
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

describe('sc claim - parent spec guard', () => {
  test('returns error when spec has children', async () => {
    const parent = makeSpec('p1b2', { title: 'Parent Feature' });
    const child = makeSpec('c1d2', { parent: 'p1b2', title: 'Child Task' });
    await writeSpec(parent);
    await writeSpec(child);

    const result = await command.execute(['p1b2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('child specs');
    expect(errorMessages.join(' ')).toContain('not directly actionable');
  });

  test('error message suggests sc list --tree', async () => {
    const parent = makeSpec('p1b2', { title: 'Parent Feature' });
    const child = makeSpec('c1d2', { parent: 'p1b2', title: 'Child Task' });
    await writeSpec(parent);
    await writeSpec(child);

    await command.execute(['p1b2']);
    expect(errorMessages.join(' ')).toContain('sc list --tree');
  });

  test('--cd returns empty stdout for parent specs', async () => {
    const parent = makeSpec('p1b2', { title: 'Parent Feature' });
    const child = makeSpec('c1d2', { parent: 'p1b2', title: 'Child Task' });
    await writeSpec(parent);
    await writeSpec(child);

    const result = await command.execute(['--cd', 'p1b2']);
    expect(result).toBe(1);
    expect(logMessages).toHaveLength(0);
  });

  test('succeeds for leaf specs', async () => {
    const leaf = makeSpec('l1f2', { title: 'Leaf Task' });
    await writeSpec(leaf);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-leaf-task-l1f2',
    });

    const result = await command.execute(['l1f2']);
    expect(result).toBe(0);
  });
});

describe('sc claim - default behavior (branch mode)', () => {
  test('outputs branch name in success message', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });

    const result = await command.execute(['a1b2']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Claimed: Test a1b2');
    expect(logMessages.join(' ')).toContain('in_progress');
    expect(logMessages.join(' ')).toContain('Branch: work-test-a1b2-a1b2');
  });

  test('does not show worktree path or cd instructions', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });

    await command.execute(['a1b2']);
    expect(logMessages.join(' ')).not.toContain('To start working');
    expect(logMessages.join(' ')).not.toContain('sc init');
  });

  test('--cd in branch mode outputs status to stderr only', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });

    const result = await command.execute(['--cd', 'a1b2']);
    expect(result).toBe(0);
    expect(logMessages).toHaveLength(0);
    expect(errorMessages.join(' ')).toContain('Claimed: Test a1b2');
  });
});

describe('sc claim --worktree flag', () => {
  test('passes useWorktree to claimSpec', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const claimSpy = spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
      worktreePath: '/abs/path/work-test-a1b2-a1b2',
    });

    await command.execute(['--worktree', 'a1b2']);
    expect(claimSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1b2' }),
      { useWorktree: true },
    );
  });

  test('default mode passes useWorktree=false', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const claimSpy = spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });

    await command.execute(['a1b2']);
    expect(claimSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1b2' }),
      { useWorktree: false },
    );
  });

  test('outputs worktree path and cd instructions', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
      worktreePath: '/abs/path/work-test-a1b2-a1b2',
    });

    const result = await command.execute(['--worktree', 'a1b2']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Claimed: Test a1b2');
    expect(logMessages.join(' ')).toContain('in_progress');
    expect(logMessages.join(' ')).toContain('Worktree: /abs/path/work-test-a1b2-a1b2');
    expect(logMessages.join(' ')).toContain('To start working');
    expect(logMessages.join(' ')).toContain('sc init --help');
  });

  test('--cd with worktree outputs cd command to stdout', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
      worktreePath: '/abs/path/work-test-a1b2-a1b2',
    });

    const result = await command.execute(['--cd', '--worktree', 'a1b2']);
    expect(result).toBe(0);
    expect(logMessages).toHaveLength(1);
    expect(logMessages[0]).toBe("cd '/abs/path/work-test-a1b2-a1b2'");
    expect(errorMessages).toHaveLength(1);
    expect(errorMessages[0]).toContain('Claimed: Test a1b2');
  });

  test('properly single-quotes path for shell safety', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
      worktreePath: '/path/to/work-test-a1b2-a1b2',
    });

    await command.execute(['--cd', '--worktree', 'a1b2']);
    expect(logMessages[0]).toBe("cd '/path/to/work-test-a1b2-a1b2'");
  });

  test('escapes embedded single quotes in path', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
      worktreePath: "/path/with'quote/work-a1b2",
    });

    await command.execute(['--cd', '--worktree', 'a1b2']);
    expect(logMessages[0]).toBe("cd '/path/with'\\''quote/work-a1b2'");
  });
});

describe('sc claim - flag position variations', () => {
  test('accepts --worktree before spec ID', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
      worktreePath: '/abs/path/work-test-a1b2-a1b2',
    });

    const result = await command.execute(['--worktree', 'a1b2']);
    expect(result).toBe(0);
  });

  test('accepts --worktree after spec ID', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
      worktreePath: '/abs/path/work-test-a1b2-a1b2',
    });

    const result = await command.execute(['a1b2', '--worktree']);
    expect(result).toBe(0);
  });

  test('accepts -W short flag', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
      worktreePath: '/abs/path/work-test-a1b2-a1b2',
    });

    const result = await command.execute(['-W', 'a1b2']);
    expect(result).toBe(0);
  });

  test('accepts --cd before spec ID', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });

    const result = await command.execute(['--cd', 'a1b2']);
    expect(result).toBe(0);
  });

  test('accepts -C short flag after spec ID', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    spyOn(claimLogic, 'claimSpec').mockResolvedValue({
      success: true,
      branchName: 'work-test-a1b2-a1b2',
    });

    const result = await command.execute(['a1b2', '-C']);
    expect(result).toBe(0);
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
