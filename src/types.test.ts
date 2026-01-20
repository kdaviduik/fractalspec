import { describe, expect, test } from 'bun:test';
import {
  isValidStatus,
  isValidEarsPattern,
  isValidPriority,
  isValidSpecFrontmatter,
  STATUSES,
  EARS_PATTERNS,
  PRIORITIES,
} from './types';

describe('Status validation', () => {
  test('accepts all valid statuses', () => {
    const validStatuses = [
      'ready',
      'in_progress',
      'blocked',
      'closed',
      'deferred',
      'not_planned',
    ];

    for (const status of validStatuses) {
      expect(isValidStatus(status)).toBe(true);
    }
  });

  test('rejects invalid statuses', () => {
    expect(isValidStatus('invalid')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus('READY')).toBe(false);
    expect(isValidStatus('in-progress')).toBe(false);
  });

  test('STATUSES constant contains all valid statuses', () => {
    expect(STATUSES).toHaveLength(6);
    expect(STATUSES).toContain('ready');
    expect(STATUSES).toContain('in_progress');
    expect(STATUSES).toContain('blocked');
    expect(STATUSES).toContain('closed');
    expect(STATUSES).toContain('deferred');
    expect(STATUSES).toContain('not_planned');
  });
});

describe('EARS pattern validation', () => {
  test('accepts all valid EARS patterns', () => {
    const validPatterns = [
      'ubiquitous',
      'state_driven',
      'event_driven',
      'optional',
      'unwanted',
      'complex',
    ];

    for (const pattern of validPatterns) {
      expect(isValidEarsPattern(pattern)).toBe(true);
    }
  });

  test('rejects invalid EARS patterns', () => {
    expect(isValidEarsPattern('invalid')).toBe(false);
    expect(isValidEarsPattern('')).toBe(false);
    expect(isValidEarsPattern('UBIQUITOUS')).toBe(false);
    expect(isValidEarsPattern('event-driven')).toBe(false);
  });

  test('EARS_PATTERNS constant contains all valid patterns', () => {
    expect(EARS_PATTERNS).toHaveLength(6);
    expect(EARS_PATTERNS).toContain('ubiquitous');
    expect(EARS_PATTERNS).toContain('state_driven');
    expect(EARS_PATTERNS).toContain('event_driven');
    expect(EARS_PATTERNS).toContain('optional');
    expect(EARS_PATTERNS).toContain('unwanted');
    expect(EARS_PATTERNS).toContain('complex');
  });
});

describe('Priority validation', () => {
  test('accepts all valid priorities', () => {
    const validPriorities = ['critical', 'high', 'normal', 'low'];

    for (const priority of validPriorities) {
      expect(isValidPriority(priority)).toBe(true);
    }
  });

  test('rejects invalid priorities', () => {
    expect(isValidPriority('invalid')).toBe(false);
    expect(isValidPriority('')).toBe(false);
    expect(isValidPriority('CRITICAL')).toBe(false);
    expect(isValidPriority('HIGH')).toBe(false);
    expect(isValidPriority('medium')).toBe(false);
    expect(isValidPriority('urgent')).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(isValidPriority(null)).toBe(false);
    expect(isValidPriority(undefined)).toBe(false);
    expect(isValidPriority(1)).toBe(false);
    expect(isValidPriority({})).toBe(false);
    expect(isValidPriority(['normal'])).toBe(false);
  });

  test('PRIORITIES constant contains all valid priorities in order', () => {
    expect(PRIORITIES).toHaveLength(4);
    expect(PRIORITIES[0]).toBe('critical');
    expect(PRIORITIES[1]).toBe('high');
    expect(PRIORITIES[2]).toBe('normal');
    expect(PRIORITIES[3]).toBe('low');
  });
});

describe('SpecFrontmatter validation', () => {
  test('accepts valid frontmatter with all fields', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blocks: [],
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(true);
  });

  test('accepts valid frontmatter with parent and blocks', () => {
    const frontmatter = {
      id: 'c3d4',
      status: 'blocked',
      parent: 'a1b2',
      blocks: ['e5f6', 'g7h8'],
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(true);
  });

  test('rejects frontmatter with missing id', () => {
    const frontmatter = {
      status: 'ready',
      parent: null,
      blocks: [],
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(false);
  });

  test('rejects frontmatter with invalid status', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'invalid_status',
      parent: null,
      blocks: [],
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(false);
  });

  test('rejects frontmatter with non-array blocks', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blocks: 'not-an-array',
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(false);
  });

  test('rejects null frontmatter', () => {
    expect(isValidSpecFrontmatter(null)).toBe(false);
  });

  test('rejects non-object frontmatter', () => {
    expect(isValidSpecFrontmatter('string')).toBe(false);
    expect(isValidSpecFrontmatter(123)).toBe(false);
    expect(isValidSpecFrontmatter(undefined)).toBe(false);
  });
});
