import { describe, expect, test } from 'bun:test';
import {
  getRequiredIdLength,
  generateId,
  isValidId,
  ID_LENGTH_THRESHOLDS,
} from './id-generation';

describe('getRequiredIdLength', () => {
  test('returns 4 chars for 0-500 specs', () => {
    expect(getRequiredIdLength(0)).toBe(4);
    expect(getRequiredIdLength(100)).toBe(4);
    expect(getRequiredIdLength(500)).toBe(4);
  });

  test('returns 5 chars for 501-5000 specs', () => {
    expect(getRequiredIdLength(501)).toBe(5);
    expect(getRequiredIdLength(1000)).toBe(5);
    expect(getRequiredIdLength(5000)).toBe(5);
  });

  test('returns 6 chars for 5001-15000 specs', () => {
    expect(getRequiredIdLength(5001)).toBe(6);
    expect(getRequiredIdLength(10000)).toBe(6);
    expect(getRequiredIdLength(15000)).toBe(6);
  });

  test('returns 7 chars for 15001+ specs', () => {
    expect(getRequiredIdLength(15001)).toBe(7);
    expect(getRequiredIdLength(50000)).toBe(7);
  });

  test('ID_LENGTH_THRESHOLDS matches expected boundaries', () => {
    expect(ID_LENGTH_THRESHOLDS).toEqual([
      { maxCount: 500, length: 4 },
      { maxCount: 5000, length: 5 },
      { maxCount: 15000, length: 6 },
    ]);
  });
});

describe('isValidId', () => {
  test('accepts lowercase alphanumeric IDs', () => {
    expect(isValidId('a1b2')).toBe(true);
    expect(isValidId('xyz123')).toBe(true);
    expect(isValidId('0000')).toBe(true);
    expect(isValidId('abcd')).toBe(true);
  });

  test('rejects IDs with uppercase letters', () => {
    expect(isValidId('A1b2')).toBe(false);
    expect(isValidId('ABCD')).toBe(false);
  });

  test('rejects IDs with special characters', () => {
    expect(isValidId('a-b2')).toBe(false);
    expect(isValidId('a_b2')).toBe(false);
    expect(isValidId('a.b2')).toBe(false);
  });

  test('rejects empty IDs', () => {
    expect(isValidId('')).toBe(false);
  });
});

describe('generateId', () => {
  test('generates ID of correct length for small spec count', () => {
    const id = generateId(new Set(), 100);
    expect(id.length).toBe(4);
  });

  test('generates ID of correct length for medium spec count', () => {
    const id = generateId(new Set(), 1000);
    expect(id.length).toBe(5);
  });

  test('generates ID of correct length for large spec count', () => {
    const id = generateId(new Set(), 10000);
    expect(id.length).toBe(6);
  });

  test('generates only lowercase alphanumeric characters', () => {
    const id = generateId(new Set(), 100);
    expect(isValidId(id)).toBe(true);
    expect(id).toMatch(/^[a-z0-9]+$/);
  });

  test('avoids collision with existing IDs', () => {
    const existingIds = new Set(['a1b2', 'c3d4', 'e5f6']);
    const id = generateId(existingIds, 100);
    expect(existingIds.has(id)).toBe(false);
  });

  test('generates unique IDs on repeated calls', () => {
    const generatedIds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = generateId(generatedIds, 100);
      expect(generatedIds.has(id)).toBe(false);
      generatedIds.add(id);
    }
    expect(generatedIds.size).toBe(100);
  });

  test('increases length if too many collisions at base length', () => {
    const existingIds = new Set<string>();

    // Generate many 4-char IDs (but not all possible ones)
    // The function should still find a unique one, potentially at longer length
    for (let i = 0; i < 1000; i++) {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let id = '';
      for (let j = 0; j < 4; j++) {
        id += chars[Math.floor(Math.random() * chars.length)];
      }
      existingIds.add(id);
    }

    const newId = generateId(existingIds, 100);
    expect(existingIds.has(newId)).toBe(false);
    expect(isValidId(newId)).toBe(true);
  });
});
