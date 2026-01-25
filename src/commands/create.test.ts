import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  command,
  validateMessages,
  generateSpecTemplate,
  determinePriority,
} from './create';
import { STATUSES, DEFAULT_PRIORITY } from '../types';
import type { Spec, Priority } from '../types';

describe('create command - status flag', () => {
  it('should provide help documentation with --status flag', () => {
    const help = command.getHelp?.();
    expect(help).toBeDefined();
    expect(help?.synopsis).toContain('--status');
    expect(help?.flags).toBeDefined();

    const statusFlag = help?.flags?.find((f) => f.flag.includes('--status'));
    expect(statusFlag).toBeDefined();
    expect(statusFlag?.description).toContain('ready');
    expect(statusFlag?.description).toContain('blocked');
  });

  it('should include status examples in help documentation', () => {
    const help = command.getHelp?.();
    expect(help?.examples).toBeDefined();

    const examplesText = help?.examples?.join('\n') ?? '';
    expect(examplesText).toContain('--status');
    expect(examplesText).toContain('blocked');
  });

  it('should list all valid statuses in flag description', () => {
    const help = command.getHelp?.();
    const statusFlag = help?.flags?.find((f) => f.flag.includes('--status'));

    for (const status of STATUSES) {
      expect(statusFlag?.description).toContain(status);
    }
  });

  it('should mention status is settable at creation in help notes', () => {
    const help = command.getHelp?.();
    expect(help?.notes).toBeDefined();

    const notesText = help?.notes?.join('\n') ?? '';
    expect(notesText).toContain('status');
  });
});

describe('create command - message flag', () => {
  it('should provide help documentation with -m flag', () => {
    const help = command.getHelp?.();
    expect(help).toBeDefined();
    expect(help?.synopsis).toContain('--message');
    expect(help?.flags).toBeDefined();

    const messageFlag = help?.flags?.find((f) => f.flag.includes('--message'));
    expect(messageFlag).toBeDefined();
    expect(messageFlag?.description).toContain('repeatable');
  });

  it('should include message examples in help documentation', () => {
    const help = command.getHelp?.();
    expect(help?.examples).toBeDefined();

    const examplesText = help?.examples?.join('\n') ?? '';
    expect(examplesText).toContain('-m');
    expect(examplesText).toContain('PR:');
  });
});

describe('validateMessages', () => {
  let originalExit: typeof process.exit;
  let originalConsoleError: typeof console.error;
  let exitCode: number | null = null;
  let errorMessages: string[] = [];

  beforeEach(() => {
    originalExit = process.exit;
    originalConsoleError = console.error;
    exitCode = null;
    errorMessages = [];

    // Mock process.exit to capture exit code
    Object.defineProperty(process, 'exit', {
      value: (code?: number) => {
        exitCode = code ?? 0;
        throw new Error(`Process.exit called with code ${code}`);
      },
      configurable: true,
    });

    // Mock console.error to capture error messages
    Object.defineProperty(console, 'error', {
      value: (...args: unknown[]) => {
        errorMessages.push(args.join(' '));
      },
      configurable: true,
    });
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalConsoleError;
  });

  it('should return empty array for undefined messages', () => {
    const result = validateMessages(undefined);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty array', () => {
    const result = validateMessages([]);
    expect(result).toEqual([]);
  });

  it('should return trimmed messages', () => {
    const result = validateMessages(['  message1  ', '  message2  ']);
    expect(result).toEqual(['message1', 'message2']);
  });

  it('should reject empty string message', () => {
    expect(() => validateMessages([''])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('cannot be empty or whitespace');
  });

  it('should reject whitespace-only message', () => {
    expect(() => validateMessages(['   '])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('cannot be empty or whitespace');
  });

  it('should reject when exceeding max message count', () => {
    const messages = Array(101).fill('message');
    expect(() => validateMessages(messages)).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('Maximum 100 messages allowed');
  });

  it('should reject when message exceeds max length', () => {
    const longMessage = 'x'.repeat(10001);
    expect(() => validateMessages([longMessage])).toThrow();
    expect(exitCode).toBe(1);
    expect(errorMessages.join(' ')).toContain('exceeds 10000 character limit');
  });

  it('should accept exactly 100 messages', () => {
    const messages = Array(100).fill('message');
    const result = validateMessages(messages);
    expect(result.length).toBe(100);
  });

  it('should accept message at max length', () => {
    const maxMessage = 'x'.repeat(10000);
    const result = validateMessages([maxMessage]);
    expect(result).toEqual([maxMessage]);
  });
});

describe('generateSpecTemplate', () => {
  it('should generate template without messages', () => {
    const result = generateSpecTemplate('Test Title');
    expect(result).toContain('# Spec: Test Title');
    expect(result).toContain(
      '## Overview\n[2-3 sentences: what this is and why it matters]\n',
    );
    expect(result).toContain('## Background & Context');
    expect(result).toContain('## Requirements (EARS format)');
  });

  it('should generate template with single message', () => {
    const result = generateSpecTemplate('Test Title', ['PR: https://github.com/org/repo/pull/123']);
    expect(result).toContain('# Spec: Test Title');
    expect(result).toContain(
      '## Overview\n[2-3 sentences: what this is and why it matters]\n\nPR: https://github.com/org/repo/pull/123\n',
    );
  });

  it('should generate template with multiple messages in order', () => {
    const result = generateSpecTemplate('Test Title', [
      'PR: https://github.com/org/repo/pull/123',
      'Related to issue #456',
      'Depends on spec ABC123',
    ]);
    expect(result).toContain('# Spec: Test Title');
    expect(result).toContain(
      '## Overview\n[2-3 sentences: what this is and why it matters]\n\nPR: https://github.com/org/repo/pull/123\nRelated to issue #456\nDepends on spec ABC123\n',
    );
  });

  it('should preserve special characters in messages', () => {
    const result = generateSpecTemplate('Test Title', [
      'URL: https://example.com?foo=bar&baz=qux',
      '# Not a markdown header',
      '**Not bold**',
      '`Not code`',
    ]);
    expect(result).toContain('URL: https://example.com?foo=bar&baz=qux');
    expect(result).toContain('# Not a markdown header');
    expect(result).toContain('**Not bold**');
    expect(result).toContain('`Not code`');
  });

  it('should not corrupt frontmatter with YAML-like content in messages', () => {
    const result = generateSpecTemplate('Test Title', [
      '---',
      'This looks like YAML',
      'key: value',
    ]);
    expect(result).toContain('# Spec: Test Title');
    expect(result).toContain('---\nThis looks like YAML\nkey: value');
    // Verify the Overview section contains the messages
    expect(result).toMatch(/## Overview\n\[2-3 sentences[^\n]*\]\n\n---\nThis looks like YAML\nkey: value\n/);
  });

  it('should separate messages with newlines', () => {
    const result = generateSpecTemplate('Test Title', ['Line 1', 'Line 2', 'Line 3']);
    expect(result).toContain('Line 1\nLine 2\nLine 3');
  });

  it('should have blank line between placeholder and first message', () => {
    const result = generateSpecTemplate('Test Title', ['First message']);
    expect(result).toMatch(/\[2-3 sentences: what this is and why it matters\]\n\nFirst message/);
  });
});

describe('determinePriority', () => {
  function makeSpec(id: string, priority: Priority): Spec {
    return {
      id,
      status: 'ready',
      parent: null,
      blocks: [],
      priority,
      pr: null,
      title: `Spec ${id}`,
      content: `# Spec: Spec ${id}`,
      filePath: `/path/${id}.md`,
    };
  }

  it('should use explicit numeric priority when provided', () => {
    const specs: Spec[] = [];
    const result = determinePriority('8', undefined, specs);
    expect(result).toBe(8);
  });

  it('should use explicit priority even when parent exists', () => {
    const specs = [makeSpec('parent', 10)];
    const result = determinePriority('2', 'parent', specs);
    expect(result).toBe(2);
  });

  it('should inherit priority from parent when no explicit priority', () => {
    const specs = [makeSpec('parent', 8)];
    const result = determinePriority(undefined, 'parent', specs);
    expect(result).toBe(8);
  });

  it('should inherit highest priority (10) from parent', () => {
    const specs = [makeSpec('parent', 10)];
    const result = determinePriority(undefined, 'parent', specs);
    expect(result).toBe(10);
  });

  it('should default to DEFAULT_PRIORITY (5) when no parent and no explicit priority', () => {
    const specs: Spec[] = [];
    const result = determinePriority(undefined, undefined, specs);
    expect(result).toBe(DEFAULT_PRIORITY);
  });

  it('should default to DEFAULT_PRIORITY when parent does not exist', () => {
    const specs = [makeSpec('other', 8)];
    const result = determinePriority(undefined, 'nonexistent', specs);
    expect(result).toBe(DEFAULT_PRIORITY);
  });

  it('should ignore invalid (non-numeric) priority and inherit from parent', () => {
    const specs = [makeSpec('parent', 8)];
    const result = determinePriority('invalid', 'parent', specs);
    expect(result).toBe(8);
  });

  it('should ignore invalid priority and default to DEFAULT_PRIORITY when no parent', () => {
    const specs: Spec[] = [];
    const result = determinePriority('invalid', undefined, specs);
    expect(result).toBe(DEFAULT_PRIORITY);
  });

  it('should ignore out-of-range priority (0) and inherit from parent', () => {
    const specs = [makeSpec('parent', 7)];
    const result = determinePriority('0', 'parent', specs);
    expect(result).toBe(7);
  });

  it('should ignore out-of-range priority (11) and default to DEFAULT_PRIORITY', () => {
    const specs: Spec[] = [];
    const result = determinePriority('11', undefined, specs);
    expect(result).toBe(DEFAULT_PRIORITY);
  });
});
