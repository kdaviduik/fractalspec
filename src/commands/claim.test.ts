import { describe, expect, test, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { command } from './claim';
import { setSpecsRoot, writeSpec } from '../spec-filesystem';
import type { Spec, ClaimResult } from '../types';
import * as claimLogic from '../claim-logic';

let testDir: string;
let specsDir: string;
let errorMessages: string[];
let logMessages: string[];
const origError = console.error;
const origLog = console.log;

function makeSpec(id: string, overrides: Partial<Spec> = {}): Spec {
  return {
    id, status: 'ready', parent: null, blockedBy: [], priority: 5, pr: null,
    title: `Test ${id}`, content: `# Spec: Test ${id}`,
    filePath: join(specsDir, `test-${id}`, `test-${id}.md`), ...overrides,
  };
}

function mockClaim(result: ClaimResult) {
  return spyOn(claimLogic, 'claimSpec').mockResolvedValue(result);
}

const statusOnlyResult = (id: string): ClaimResult => ({
  success: true, mode: 'status_only', branchName: `work-test-${id}-${id}`,
});
const branchResult = (id: string): ClaimResult => ({
  success: true, mode: 'branch', branchName: `work-test-${id}-${id}`,
});
const worktreeResult = (id: string): ClaimResult => ({
  success: true, mode: 'worktree', branchName: `work-test-${id}-${id}`,
  worktreePath: `/abs/path/work-test-${id}-${id}`,
});

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'sc-claim-cmd-test-'));
  specsDir = join(testDir, 'docs', 'specs');
  setSpecsRoot(specsDir);
  errorMessages = [];
  logMessages = [];
  Object.defineProperty(console, 'error', {
    value: (...a: unknown[]) => { errorMessages.push(a.join(' ')); }, configurable: true,
  });
  Object.defineProperty(console, 'log', {
    value: (...a: unknown[]) => { logMessages.push(a.join(' ')); }, configurable: true,
  });
});

afterEach(async () => {
  console.error = origError;
  console.log = origLog;
  mock.restore();
  await rm(testDir, { recursive: true, force: true });
});

describe('sc claim - help', () => {
  test('synopsis includes --branch, --worktree, and --cd', () => {
    const h = command.getHelp?.();
    expect(h?.synopsis).toContain('--branch');
    expect(h?.synopsis).toContain('--worktree');
    expect(h?.synopsis).toContain('--cd');
  });

  test('flags list includes --branch/-B, --worktree/-W, --cd/-C', () => {
    const flags = command.getHelp?.()?.flags ?? [];
    const text = flags.map(f => f.flag).join(' ');
    expect(text).toContain('--branch');
    expect(text).toContain('-B');
    expect(text).toContain('--worktree');
    expect(text).toContain('-W');
    expect(text).toContain('--cd');
    expect(text).toContain('-C');
  });

  test('describes status-only as default, mentions all three modes', () => {
    const desc = command.getHelp?.()?.description ?? '';
    expect(desc).toContain('status');
    expect(desc).toContain('--branch');
    expect(desc).toContain('--worktree');
  });

  test('examples cover all three modes', () => {
    const ex = (command.getHelp?.()?.examples ?? []).join(' ');
    expect(ex).toContain('status-only');
    expect(ex).toContain('--branch');
    expect(ex).toContain('--worktree');
  });
});

describe('sc claim - validation errors', () => {
  test('no spec ID returns error', async () => {
    expect(await command.execute([])).toBe(1);
  });

  test('nonexistent spec returns error', async () => {
    expect(await command.execute(['nonexistent'])).toBe(1);
    expect(errorMessages.join(' ')).toContain('Spec not found');
  });

  test('--cd with nonexistent spec: stderr only, stdout empty', async () => {
    expect(await command.execute(['--cd', 'nonexistent'])).toBe(1);
    expect(logMessages).toHaveLength(0);
  });

  test('claim failure returns error', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);
    mockClaim({ success: false, mode: 'status_only', branchName: '', error: 'Already claimed' });
    expect(await command.execute(['a1b2'])).toBe(1);
    expect(errorMessages.join(' ')).toContain('Failed to claim');
  });

  test('claim failure with --cd: stdout empty', async () => {
    const spec = makeSpec('a1b2');
    await writeSpec(spec);
    mockClaim({ success: false, mode: 'status_only', branchName: '', error: 'Already claimed' });
    expect(await command.execute(['--cd', 'a1b2'])).toBe(1);
    expect(logMessages).toHaveLength(0);
  });
});

describe('sc claim - parent spec guard', () => {
  test('rejects parent specs with children', async () => {
    await writeSpec(makeSpec('p1b2', { title: 'Parent' }));
    await writeSpec(makeSpec('c1d2', { parent: 'p1b2' }));
    expect(await command.execute(['p1b2'])).toBe(1);
    expect(errorMessages.join(' ')).toContain('child specs');
    expect(errorMessages.join(' ')).toContain('sc list --tree');
  });

  test('--cd returns empty stdout for parent specs', async () => {
    await writeSpec(makeSpec('p1b2', { title: 'Parent' }));
    await writeSpec(makeSpec('c1d2', { parent: 'p1b2' }));
    expect(await command.execute(['--cd', 'p1b2'])).toBe(1);
    expect(logMessages).toHaveLength(0);
  });

  test('succeeds for leaf specs', async () => {
    await writeSpec(makeSpec('l1f2'));
    mockClaim(statusOnlyResult('l1f2'));
    expect(await command.execute(['l1f2'])).toBe(0);
  });
});

describe('sc claim - default behavior (status-only)', () => {
  test('outputs status without branch or worktree info', async () => {
    await writeSpec(makeSpec('a1b2'));
    mockClaim(statusOnlyResult('a1b2'));
    expect(await command.execute(['a1b2'])).toBe(0);
    const out = logMessages.join(' ');
    expect(out).toContain('Claimed: Test a1b2');
    expect(out).toContain('in_progress');
    expect(out).not.toContain('Branch:');
    expect(out).not.toContain('Worktree');
  });

  test('--cd outputs status to stderr only, empty stdout', async () => {
    await writeSpec(makeSpec('a1b2'));
    mockClaim(statusOnlyResult('a1b2'));
    expect(await command.execute(['--cd', 'a1b2'])).toBe(0);
    expect(logMessages).toHaveLength(0);
    expect(errorMessages.join(' ')).toContain('Claimed: Test a1b2');
  });

  test('passes useBranch=false, useWorktree=false by default', async () => {
    await writeSpec(makeSpec('a1b2'));
    const spy = mockClaim(statusOnlyResult('a1b2'));
    await command.execute(['a1b2']);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1b2' }),
      { useBranch: false, useWorktree: false },
    );
  });
});

describe('sc claim --branch flag', () => {
  test('passes useBranch=true to claimSpec', async () => {
    await writeSpec(makeSpec('a1b2'));
    const spy = mockClaim(branchResult('a1b2'));
    await command.execute(['--branch', 'a1b2']);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1b2' }),
      { useBranch: true, useWorktree: false },
    );
  });

  test('-B short flag works', async () => {
    await writeSpec(makeSpec('a1b2'));
    const spy = mockClaim(branchResult('a1b2'));
    await command.execute(['-B', 'a1b2']);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1b2' }),
      { useBranch: true, useWorktree: false },
    );
  });

  test('outputs branch name in success message', async () => {
    await writeSpec(makeSpec('a1b2'));
    mockClaim(branchResult('a1b2'));
    expect(await command.execute(['--branch', 'a1b2'])).toBe(0);
    const out = logMessages.join(' ');
    expect(out).toContain('Claimed: Test a1b2');
    expect(out).toContain('Branch: work-test-a1b2-a1b2');
  });

  test('--branch --worktree passes both flags', async () => {
    await writeSpec(makeSpec('a1b2'));
    const spy = mockClaim(worktreeResult('a1b2'));
    await command.execute(['--branch', '--worktree', 'a1b2']);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1b2' }),
      { useBranch: true, useWorktree: true },
    );
  });
});

describe('sc claim --worktree flag', () => {
  test('passes useWorktree=true to claimSpec', async () => {
    await writeSpec(makeSpec('a1b2'));
    const spy = mockClaim(worktreeResult('a1b2'));
    await command.execute(['--worktree', 'a1b2']);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1b2' }),
      { useBranch: false, useWorktree: true },
    );
  });

  test('outputs worktree path and cd instructions', async () => {
    await writeSpec(makeSpec('a1b2'));
    mockClaim(worktreeResult('a1b2'));
    expect(await command.execute(['--worktree', 'a1b2'])).toBe(0);
    const out = logMessages.join(' ');
    expect(out).toContain('Worktree: /abs/path/work-test-a1b2-a1b2');
    expect(out).toContain('To start working');
    expect(out).toContain('sc init --help');
  });

  test('--cd with worktree outputs cd command to stdout', async () => {
    await writeSpec(makeSpec('a1b2'));
    mockClaim(worktreeResult('a1b2'));
    expect(await command.execute(['--cd', '--worktree', 'a1b2'])).toBe(0);
    expect(logMessages).toHaveLength(1);
    expect(logMessages[0]).toBe("cd '/abs/path/work-test-a1b2-a1b2'");
    expect(errorMessages[0]).toContain('Claimed: Test a1b2');
  });

  test('escapes embedded single quotes in path', async () => {
    await writeSpec(makeSpec('a1b2'));
    mockClaim({ success: true, mode: 'worktree', branchName: 'work-test-a1b2-a1b2', worktreePath: "/path/with'quote/work-a1b2" });
    await command.execute(['--cd', '--worktree', 'a1b2']);
    expect(logMessages[0]).toBe("cd '/path/with'\\''quote/work-a1b2'");
  });
});

describe('sc claim - flag positions and short flags', () => {
  test('accepts flags before and after spec ID', async () => {
    await writeSpec(makeSpec('a1b2'));
    mockClaim(worktreeResult('a1b2'));
    expect(await command.execute(['--worktree', 'a1b2'])).toBe(0);
    expect(await command.execute(['a1b2', '--worktree'])).toBe(0);
    expect(await command.execute(['-W', 'a1b2'])).toBe(0);
  });

  test('accepts --branch/-B and --cd/-C at any position', async () => {
    await writeSpec(makeSpec('a1b2'));
    mockClaim(branchResult('a1b2'));
    expect(await command.execute(['--branch', 'a1b2'])).toBe(0);
    expect(await command.execute(['a1b2', '-B'])).toBe(0);
    mockClaim(statusOnlyResult('a1b2'));
    expect(await command.execute(['--cd', 'a1b2'])).toBe(0);
    expect(await command.execute(['a1b2', '-C'])).toBe(0);
  });
});

describe('sc claim - output routing uses result.mode', () => {
  test('worktree output shown when result.mode is worktree (e.g. bare repo escalation)', async () => {
    await writeSpec(makeSpec('a1b2'));
    mockClaim(worktreeResult('a1b2'));
    expect(await command.execute(['--branch', 'a1b2'])).toBe(0);
    expect(logMessages.join(' ')).toContain('Worktree:');
    expect(logMessages.join(' ')).not.toContain('Branch:');
  });
});
