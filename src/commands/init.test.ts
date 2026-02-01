import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test';
import { command } from './init';

let originalConsoleError: typeof console.error;
let originalConsoleLog: typeof console.log;
let errorMessages: string[] = [];
let logMessages: string[] = [];

beforeEach(() => {
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

afterEach(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
  mock.restore();
});

describe('sc init - help', () => {
  test('provides help documentation', () => {
    const help = command.getHelp?.();
    expect(help).toBeDefined();
    expect(help?.name).toBe('sc init');
  });

  test('mentions bash, zsh, and fish in help', () => {
    const help = command.getHelp?.();
    const desc = help?.description ?? '';
    expect(desc).toContain('bash');
    expect(desc).toContain('zsh');
    expect(desc).toContain('fish');
  });

  test('includes setup examples for all shells', () => {
    const help = command.getHelp?.();
    const examples = help?.examples?.join('\n') ?? '';
    expect(examples).toContain('sc init bash');
    expect(examples).toContain('sc init zsh');
    expect(examples).toContain('sc init fish');
  });

  test('includes notes about bypassing the wrapper', () => {
    const help = command.getHelp?.();
    const notes = help?.notes?.join(' ') ?? '';
    expect(notes).toContain('command sc');
  });
});

describe('sc init - validation errors', () => {
  test('returns 1 when no shell argument provided', async () => {
    const result = await command.execute([]);
    expect(result).toBe(1);
    expect(logMessages).toHaveLength(0);
  });

  test('prints usage to stderr when no shell argument', async () => {
    await command.execute([]);
    expect(errorMessages.join(' ')).toContain('Usage');
  });

  test('returns 1 for unsupported shell', async () => {
    const result = await command.execute(['powershell']);
    expect(result).toBe(1);
    expect(logMessages).toHaveLength(0);
  });

  test('shows supported shells in error for unsupported shell', async () => {
    await command.execute(['powershell']);
    const errors = errorMessages.join(' ');
    expect(errors).toContain('bash');
    expect(errors).toContain('zsh');
    expect(errors).toContain('fish');
  });
});

describe('sc init bash', () => {
  test('outputs a shell function named sc', async () => {
    const result = await command.execute(['bash']);
    expect(result).toBe(0);
    const output = logMessages.join('\n');
    expect(output).toContain('sc()');
  });

  test('intercepts claim subcommand', async () => {
    await command.execute(['bash']);
    const output = logMessages.join('\n');
    expect(output).toContain('"$1" = "claim"');
  });

  test('uses command sc to bypass the function', async () => {
    await command.execute(['bash']);
    const output = logMessages.join('\n');
    expect(output).toContain('command sc');
  });

  test('passes --cd flag to claim', async () => {
    await command.execute(['bash']);
    const output = logMessages.join('\n');
    expect(output).toContain('--cd');
  });

  test('evals the output on success', async () => {
    await command.execute(['bash']);
    const output = logMessages.join('\n');
    expect(output).toContain('eval');
  });

  test('checks exit code before eval', async () => {
    await command.execute(['bash']);
    const output = logMessages.join('\n');
    expect(output).toContain('_sc_exit');
  });

  test('forwards non-claim commands unchanged', async () => {
    await command.execute(['bash']);
    const output = logMessages.join('\n');
    expect(output).toContain('command sc "$@"');
  });

  test('produces no stderr output', async () => {
    await command.execute(['bash']);
    expect(errorMessages).toHaveLength(0);
  });
});

describe('sc init zsh', () => {
  test('outputs a shell function named sc', async () => {
    const result = await command.execute(['zsh']);
    expect(result).toBe(0);
    const output = logMessages.join('\n');
    expect(output).toContain('sc()');
  });

  test('produces identical output to bash', async () => {
    await command.execute(['bash']);
    const bashOutput = logMessages.join('\n');
    logMessages = [];

    await command.execute(['zsh']);
    const zshOutput = logMessages.join('\n');

    expect(zshOutput).toBe(bashOutput);
  });
});

describe('sc init fish', () => {
  test('outputs a fish function named sc', async () => {
    const result = await command.execute(['fish']);
    expect(result).toBe(0);
    const output = logMessages.join('\n');
    expect(output).toContain('function sc');
  });

  test('uses fish argv syntax', async () => {
    await command.execute(['fish']);
    const output = logMessages.join('\n');
    expect(output).toContain('$argv');
  });

  test('uses fish status variable', async () => {
    await command.execute(['fish']);
    const output = logMessages.join('\n');
    expect(output).toContain('$status');
  });

  test('uses command sc to bypass the function', async () => {
    await command.execute(['fish']);
    const output = logMessages.join('\n');
    expect(output).toContain('command sc');
  });

  test('passes --cd flag to claim', async () => {
    await command.execute(['fish']);
    const output = logMessages.join('\n');
    expect(output).toContain('--cd');
  });

  test('evals the output on success', async () => {
    await command.execute(['fish']);
    const output = logMessages.join('\n');
    expect(output).toContain('eval');
  });

  test('produces no stderr output', async () => {
    await command.execute(['fish']);
    expect(errorMessages).toHaveLength(0);
  });
});
