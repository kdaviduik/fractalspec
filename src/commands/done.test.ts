import { describe, expect, test, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { command } from './done';
import { setSpecsRoot, writeSpec } from '../spec-filesystem';
import type { Spec } from '../types';
import * as claimLogic from '../claim-logic';
import type { SafetyCheckResult } from '../claim-logic';

let testDir: string;
let specsDir: string;
let originalConsoleError: typeof console.error;
let originalConsoleLog: typeof console.log;
let errorMessages: string[] = [];
let logMessages: string[] = [];

function makeSpec(id: string, overrides: Partial<Spec> = {}): Spec {
  return {
    id,
    status: 'in_progress',
    parent: null,
    blocks: [],
    priority: 5,
    pr: null,
    workstream: null,
    title: `Test ${id}`,
    content: `# Spec: Test ${id}`,
    filePath: join(specsDir, `test-${id}`, `test-${id}.md`),
    ...overrides,
  };
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'sc-done-test-'));
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

describe('sc done - help', () => {
  test('provides help documentation', () => {
    const help = command.getHelp?.();
    expect(help).toBeDefined();
    expect(help?.synopsis).toContain('--force');
    expect(help?.flags?.some((f) => f.flag.includes('--force'))).toBe(true);
  });

  test('includes safety check information in notes', () => {
    const help = command.getHelp?.();
    const notesText = help?.notes?.join(' ') ?? '';
    expect(notesText).toContain('Safety');
  });
});

describe('sc done - validation errors', () => {
  test('returns error when no spec ID provided', async () => {
    const result = await command.execute([]);
    expect(result).toBe(1);
  });

  test('returns error when spec not found', async () => {
    const result = await command.execute(['nonexistent']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('Spec not found');
  });

  test('returns error when spec not claimed', async () => {
    const spec = makeSpec('a1b2', { status: 'ready' });
    await writeSpec(spec);

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(false);

    const result = await command.execute(['a1b2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('not claimed');
  });
});

describe('sc done - safety checks', () => {
  test('errors when uncommitted changes exist without --force', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mockSafetyResult: SafetyCheckResult = {
      safe: false,
      issues: ['uncommitted changes'],
      worktreePath: '/path/to/worktree',
      branchName: 'work-test-a1b2-a1b2',
    };

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(true);
    spyOn(claimLogic, 'checkClaimSafety').mockResolvedValue(mockSafetyResult);

    const result = await command.execute(['a1b2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('uncommitted changes');
    expect(errorMessages.join(' ')).toContain('git add');
  });

  test('errors when unpushed commits exist without --force', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mockSafetyResult: SafetyCheckResult = {
      safe: false,
      issues: ['unpushed commits'],
      worktreePath: '/path/to/worktree',
      branchName: 'work-test-a1b2-a1b2',
    };

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(true);
    spyOn(claimLogic, 'checkClaimSafety').mockResolvedValue(mockSafetyResult);

    const result = await command.execute(['a1b2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('unpushed commits');
    expect(errorMessages.join(' ')).toContain('git push');
  });

  test('errors with both issues listed when multiple safety issues exist', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mockSafetyResult: SafetyCheckResult = {
      safe: false,
      issues: ['uncommitted changes', 'unpushed commits'],
      worktreePath: '/path/to/worktree',
      branchName: 'work-test-a1b2-a1b2',
    };

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(true);
    spyOn(claimLogic, 'checkClaimSafety').mockResolvedValue(mockSafetyResult);

    const result = await command.execute(['a1b2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('uncommitted changes');
    expect(errorMessages.join(' ')).toContain('unpushed commits');
  });

  test('errors when detached HEAD state without --force', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mockSafetyResult: SafetyCheckResult = {
      safe: false,
      issues: ['detached HEAD state'],
      worktreePath: '/path/to/worktree',
      branchName: 'work-test-a1b2-a1b2',
    };

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(true);
    spyOn(claimLogic, 'checkClaimSafety').mockResolvedValue(mockSafetyResult);

    const result = await command.execute(['a1b2']);
    expect(result).toBe(1);
    expect(errorMessages.join(' ')).toContain('detached HEAD');
  });

  test('succeeds with --force despite uncommitted changes', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mockSafetyResult: SafetyCheckResult = {
      safe: false,
      issues: ['uncommitted changes'],
      worktreePath: '/path/to/worktree',
      branchName: 'work-test-a1b2-a1b2',
    };

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(true);
    spyOn(claimLogic, 'checkClaimSafety').mockResolvedValue(mockSafetyResult);
    spyOn(claimLogic, 'completeSpec').mockResolvedValue();

    const result = await command.execute(['a1b2', '--force']);
    expect(result).toBe(0);
    expect(errorMessages.join(' ')).toContain('WARNING');
    expect(logMessages.join(' ')).toContain('Completed');
  });

  test('succeeds with -f short flag despite unpushed commits', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mockSafetyResult: SafetyCheckResult = {
      safe: false,
      issues: ['unpushed commits'],
      worktreePath: '/path/to/worktree',
      branchName: 'work-test-a1b2-a1b2',
    };

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(true);
    spyOn(claimLogic, 'checkClaimSafety').mockResolvedValue(mockSafetyResult);
    spyOn(claimLogic, 'completeSpec').mockResolvedValue();

    const result = await command.execute(['a1b2', '-f']);
    expect(result).toBe(0);
    expect(errorMessages.join(' ')).toContain('WARNING');
    expect(logMessages.join(' ')).toContain('Completed');
  });

  test('succeeds when worktree does not exist (postcondition satisfied)', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mockSafetyResult: SafetyCheckResult = {
      safe: true,
      issues: [],
      worktreePath: '/nonexistent/path',
      branchName: 'work-test-a1b2-a1b2',
    };

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(true);
    spyOn(claimLogic, 'checkClaimSafety').mockResolvedValue(mockSafetyResult);
    spyOn(claimLogic, 'completeSpec').mockResolvedValue();

    const result = await command.execute(['a1b2']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Completed');
  });

  test('succeeds when clean worktree with all commits pushed', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mockSafetyResult: SafetyCheckResult = {
      safe: true,
      issues: [],
      worktreePath: '/path/to/worktree',
      branchName: 'work-test-a1b2-a1b2',
    };

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(true);
    spyOn(claimLogic, 'checkClaimSafety').mockResolvedValue(mockSafetyResult);
    spyOn(claimLogic, 'completeSpec').mockResolvedValue();

    const result = await command.execute(['a1b2']);
    expect(result).toBe(0);
    expect(logMessages.join(' ')).toContain('Completed');
    expect(logMessages.join(' ')).toContain('closed');
  });
});

describe('sc done - flag parsing', () => {
  test('accepts --force flag before spec ID', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mockSafetyResult: SafetyCheckResult = {
      safe: false,
      issues: ['uncommitted changes'],
      worktreePath: '/path/to/worktree',
      branchName: 'work-test-a1b2-a1b2',
    };

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(true);
    spyOn(claimLogic, 'checkClaimSafety').mockResolvedValue(mockSafetyResult);
    spyOn(claimLogic, 'completeSpec').mockResolvedValue();

    const result = await command.execute(['--force', 'a1b2']);
    expect(result).toBe(0);
  });

  test('accepts --force flag after spec ID', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);

    const mockSafetyResult: SafetyCheckResult = {
      safe: false,
      issues: ['uncommitted changes'],
      worktreePath: '/path/to/worktree',
      branchName: 'work-test-a1b2-a1b2',
    };

    spyOn(claimLogic, 'isSpecClaimed').mockResolvedValue(true);
    spyOn(claimLogic, 'checkClaimSafety').mockResolvedValue(mockSafetyResult);
    spyOn(claimLogic, 'completeSpec').mockResolvedValue();

    const result = await command.execute(['a1b2', '--force']);
    expect(result).toBe(0);
  });
});
