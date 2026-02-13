import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { command } from './doctor';
import { setSpecsRoot, writeSpec, readAllSpecs } from '../spec-filesystem';
import type { Spec } from '../types';

let testDir: string;
let specsDir: string;
let originalConsoleLog: typeof console.log;
let logMessages: string[] = [];

function makeSpec(id: string, overrides: Partial<Spec> = {}): Spec {
  return {
    id,
    status: 'ready',
    parent: null,
    blockedBy: [],
    priority: 5,
    pr: null,
    title: `Spec ${id}`,
    content: `# Spec: Spec ${id}`,
    filePath: join(specsDir, `spec-${id}`, `spec-${id}.md`),
    ...overrides,
  };
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'sc-doctor-test-'));
  specsDir = join(testDir, 'docs', 'specs');
  setSpecsRoot(specsDir);

  originalConsoleLog = console.log;
  logMessages = [];

  Object.defineProperty(console, 'log', {
    value: (...args: unknown[]) => {
      logMessages.push(args.join(' '));
    },
    configurable: true,
  });
});

afterEach(async () => {
  console.log = originalConsoleLog;
  mock.restore();
  await rm(testDir, { recursive: true, force: true });
});

describe('sc doctor - unclosed parent detection', () => {
  test('no issues when no parent specs exist', async () => {
    const leaf1 = makeSpec('leaf1', { status: 'closed' });
    const leaf2 = makeSpec('leaf2', { status: 'ready' });
    await writeSpec(leaf1);
    await writeSpec(leaf2);

    await command.execute([]);
    const output = logMessages.join('\n');

    expect(output).not.toContain('unclosed_parent');
  });

  test('no issues when parent is already closed', async () => {
    const parent = makeSpec('parent', { status: 'closed' });
    const child = makeSpec('child', { status: 'closed', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child);

    await command.execute([]);
    const output = logMessages.join('\n');

    expect(output).not.toContain('unclosed_parent');
  });

  test('all children closed → fixable issue targeting closed', async () => {
    const parent = makeSpec('parent', { status: 'ready' });
    const child1 = makeSpec('child1', { status: 'closed', parent: 'parent' });
    const child2 = makeSpec('child2', { status: 'closed', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child1);
    await writeSpec(child2);

    await command.execute([]);
    const output = logMessages.join('\n');

    expect(output).toContain('unclosed_parent');
    expect(output).toContain('All children closed');
    expect(output).toContain('parent');
  });

  test('all children not_planned → fixable issue targeting not_planned', async () => {
    const parent = makeSpec('parent', { status: 'ready' });
    const child1 = makeSpec('child1', { status: 'not_planned', parent: 'parent' });
    const child2 = makeSpec('child2', { status: 'not_planned', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child1);
    await writeSpec(child2);

    await command.execute([]);
    const output = logMessages.join('\n');

    expect(output).toContain('unclosed_parent');
    expect(output).toContain('All children not_planned');
  });

  test('mixed terminal statuses → non-fixable advisory issue', async () => {
    const parent = makeSpec('parent', { status: 'ready' });
    const child1 = makeSpec('child1', { status: 'closed', parent: 'parent' });
    const child2 = makeSpec('child2', { status: 'not_planned', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child1);
    await writeSpec(child2);

    await command.execute([]);
    const output = logMessages.join('\n');

    expect(output).toContain('unclosed_parent');
    expect(output).toContain('manual review needed');
  });

  test('all children deferred → advisory suggesting deferral', async () => {
    const parent = makeSpec('parent', { status: 'ready' });
    const child1 = makeSpec('child1', { status: 'deferred', parent: 'parent' });
    const child2 = makeSpec('child2', { status: 'deferred', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child1);
    await writeSpec(child2);

    await command.execute([]);
    const output = logMessages.join('\n');

    expect(output).toContain('unclosed_parent');
    expect(output).toContain('consider deferring parent too');
  });

  test('mixed closed and deferred children → non-fixable advisory', async () => {
    const parent = makeSpec('parent', { status: 'ready' });
    const child1 = makeSpec('child1', { status: 'closed', parent: 'parent' });
    const child2 = makeSpec('child2', { status: 'deferred', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child1);
    await writeSpec(child2);

    await command.execute([]);
    const output = logMessages.join('\n');

    expect(output).toContain('unclosed_parent');
    expect(output).toContain('manual review needed');
  });

  test('some children not terminal → no unclosed_parent issue', async () => {
    const parent = makeSpec('parent', { status: 'ready' });
    const child1 = makeSpec('child1', { status: 'closed', parent: 'parent' });
    const child2 = makeSpec('child2', { status: 'ready', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child1);
    await writeSpec(child2);

    await command.execute([]);
    const output = logMessages.join('\n');

    expect(output).not.toContain('unclosed_parent');
  });

  test('--fix auto-closes parent when all children closed', async () => {
    const parent = makeSpec('parent', { status: 'ready' });
    const child1 = makeSpec('child1', { status: 'closed', parent: 'parent' });
    const child2 = makeSpec('child2', { status: 'closed', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child1);
    await writeSpec(child2);

    await command.execute(['--fix']);

    const specs = await readAllSpecs();
    const updatedParent = specs.find(s => s.id === 'parent');
    expect(updatedParent?.status).toBe('closed');
  });

  test('--fix auto-closes parent to not_planned when all children not_planned', async () => {
    const parent = makeSpec('parent', { status: 'ready' });
    const child1 = makeSpec('child1', { status: 'not_planned', parent: 'parent' });
    const child2 = makeSpec('child2', { status: 'not_planned', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child1);
    await writeSpec(child2);

    await command.execute(['--fix']);

    const specs = await readAllSpecs();
    const updatedParent = specs.find(s => s.id === 'parent');
    expect(updatedParent?.status).toBe('not_planned');
  });

  test('--fix does not auto-close mixed terminal statuses', async () => {
    const parent = makeSpec('parent', { status: 'ready' });
    const child1 = makeSpec('child1', { status: 'closed', parent: 'parent' });
    const child2 = makeSpec('child2', { status: 'not_planned', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child1);
    await writeSpec(child2);

    await command.execute(['--fix']);

    const specs = await readAllSpecs();
    const updatedParent = specs.find(s => s.id === 'parent');
    expect(updatedParent?.status).toBe('ready');
  });

  test('--fix skips in_progress parent regardless of worktree state', async () => {
    const parent = makeSpec('parent', { status: 'in_progress' });
    const child1 = makeSpec('child1', { status: 'closed', parent: 'parent' });
    const child2 = makeSpec('child2', { status: 'closed', parent: 'parent' });
    await writeSpec(parent);
    await writeSpec(child1);
    await writeSpec(child2);

    await command.execute(['--fix']);

    const specs = await readAllSpecs();
    const updatedParent = specs.find(s => s.id === 'parent');
    expect(updatedParent?.status).toBe('in_progress');

    const output = logMessages.join('\n');
    expect(output).toContain('in_progress');
    expect(output).toContain('Skipping');
  });

  test('detects stale blocked specs with all blockers resolved', async () => {
    const blocker = makeSpec('blocker', { status: 'closed' });
    const blocked = makeSpec('blocked', { status: 'blocked', blockedBy: ['blocker'] });
    await writeSpec(blocker);
    await writeSpec(blocked);

    await command.execute([]);
    const output = logMessages.join('\n');

    expect(output).toContain('stale_blocked');
    expect(output).toContain('blocked');
  });

  test('does not flag manually-blocked specs (empty blockedBy)', async () => {
    const manual = makeSpec('manual', { status: 'blocked', blockedBy: [] });
    await writeSpec(manual);

    await command.execute([]);
    const output = logMessages.join('\n');

    expect(output).not.toContain('stale_blocked');
  });

  test('--fix promotes stale blocked specs to ready', async () => {
    const blocker = makeSpec('blocker', { status: 'closed' });
    const blocked = makeSpec('blocked', { status: 'blocked', blockedBy: ['blocker'] });
    await writeSpec(blocker);
    await writeSpec(blocked);

    await command.execute(['--fix']);

    const specs = await readAllSpecs();
    const updated = specs.find(s => s.id === 'blocked');
    expect(updated?.status).toBe('ready');
  });

  test('cascade: closing mid-level parent triggers grandparent closure', async () => {
    const grandparent = makeSpec('gp', { status: 'ready' });
    const midParent = makeSpec('mid', { status: 'ready', parent: 'gp' });
    const leaf = makeSpec('leaf', { status: 'closed', parent: 'mid' });
    await writeSpec(grandparent);
    await writeSpec(midParent);
    await writeSpec(leaf);

    await command.execute(['--fix']);

    const specs = await readAllSpecs();
    const updatedMid = specs.find(s => s.id === 'mid');
    const updatedGp = specs.find(s => s.id === 'gp');
    expect(updatedMid?.status).toBe('closed');
    expect(updatedGp?.status).toBe('closed');

    const output = logMessages.join('\n');
    expect(output).toContain('[cascade]');
  });
});
