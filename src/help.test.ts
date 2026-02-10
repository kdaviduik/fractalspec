import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { bold, underline, dim, isNoColorSet } from './help';

describe('isNoColorSet', () => {
  let originalNoColor: string | undefined;

  beforeEach(() => {
    originalNoColor = process.env['NO_COLOR'];
  });

  afterEach(() => {
    if (originalNoColor === undefined) {
      delete process.env['NO_COLOR'];
    } else {
      process.env['NO_COLOR'] = originalNoColor;
    }
  });

  test('returns true when NO_COLOR is set to non-empty string', () => {
    process.env['NO_COLOR'] = '1';
    expect(isNoColorSet()).toBe(true);
  });

  test('returns true when NO_COLOR is set to "true"', () => {
    process.env['NO_COLOR'] = 'true';
    expect(isNoColorSet()).toBe(true);
  });

  test('returns false when NO_COLOR is not set', () => {
    delete process.env['NO_COLOR'];
    expect(isNoColorSet()).toBe(false);
  });

  test('returns false when NO_COLOR is empty string (per no-color.org spec)', () => {
    process.env['NO_COLOR'] = '';
    expect(isNoColorSet()).toBe(false);
  });
});

describe('ANSI formatting with NO_COLOR', () => {
  let originalNoColor: string | undefined;

  beforeEach(() => {
    originalNoColor = process.env['NO_COLOR'];
  });

  afterEach(() => {
    if (originalNoColor === undefined) {
      delete process.env['NO_COLOR'];
    } else {
      process.env['NO_COLOR'] = originalNoColor;
    }
  });

  test('bold returns plain text when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    expect(bold('hello')).toBe('hello');
  });

  test('bold returns ANSI-wrapped text when NO_COLOR is unset', () => {
    delete process.env['NO_COLOR'];
    expect(bold('hello')).toContain('\x1b[1m');
  });

  test('bold returns ANSI-wrapped text when NO_COLOR is empty string', () => {
    process.env['NO_COLOR'] = '';
    expect(bold('hello')).toContain('\x1b[1m');
  });

  test('underline returns plain text when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    expect(underline('hello')).toBe('hello');
  });

  test('underline returns ANSI-wrapped text when NO_COLOR is empty string', () => {
    process.env['NO_COLOR'] = '';
    expect(underline('hello')).toContain('\x1b[4m');
  });

  test('dim returns plain text when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    expect(dim('hello')).toBe('hello');
  });

  test('dim returns ANSI-wrapped text when NO_COLOR is empty string', () => {
    process.env['NO_COLOR'] = '';
    expect(dim('hello')).toContain('\x1b[2m');
  });
});
