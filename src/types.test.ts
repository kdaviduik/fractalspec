import { describe, expect, test } from 'bun:test';
import {
  isValidStatus,
  isValidEarsPattern,
  isValidPriority,
  isValidSpecFrontmatter,
  validateSpecFrontmatter,
  getStatusIcon,
  STATUSES,
  EARS_PATTERNS,
  MIN_PRIORITY,
  MAX_PRIORITY,
  DEFAULT_PRIORITY,
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
  test('accepts all valid priorities (1-10)', () => {
    for (let p = MIN_PRIORITY; p <= MAX_PRIORITY; p++) {
      expect(isValidPriority(p)).toBe(true);
    }
  });

  test('rejects priorities outside 1-10 range', () => {
    expect(isValidPriority(0)).toBe(false);
    expect(isValidPriority(11)).toBe(false);
    expect(isValidPriority(-1)).toBe(false);
    expect(isValidPriority(100)).toBe(false);
  });

  test('rejects non-integer numbers', () => {
    expect(isValidPriority(5.5)).toBe(false);
    expect(isValidPriority(1.1)).toBe(false);
    expect(isValidPriority(9.9)).toBe(false);
  });

  test('rejects non-number values', () => {
    expect(isValidPriority(null)).toBe(false);
    expect(isValidPriority(undefined)).toBe(false);
    expect(isValidPriority('5')).toBe(false);
    expect(isValidPriority('high')).toBe(false);
    expect(isValidPriority({})).toBe(false);
    expect(isValidPriority([5])).toBe(false);
  });

  test('priority constants are correct', () => {
    expect(MIN_PRIORITY).toBe(1);
    expect(MAX_PRIORITY).toBe(10);
    expect(DEFAULT_PRIORITY).toBe(5);
  });
});

describe('SpecFrontmatter validation', () => {
  test('accepts valid frontmatter with all fields', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(true);
  });

  test('accepts valid frontmatter with parent and blockedBy', () => {
    const frontmatter = {
      id: 'c3d4',
      status: 'blocked',
      parent: 'a1b2',
      blockedBy: ['e5f6', 'g7h8'],
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(true);
  });

  test('rejects frontmatter with missing id', () => {
    const frontmatter = {
      status: 'ready',
      parent: null,
      blockedBy: [],
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(false);
  });

  test('rejects frontmatter with invalid status', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'invalid_status',
      parent: null,
      blockedBy: [],
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(false);
  });

  test('accepts frontmatter with valid priority', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 8,
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(true);
  });

  test('accepts frontmatter without priority (optional, parser defaults it)', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(true);
  });

  test('rejects frontmatter with non-numeric priority', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 'banana',
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(false);
  });

  test('rejects frontmatter with out-of-range priority', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 0,
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(false);
  });

  test('rejects frontmatter with non-integer priority', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5.5,
    };

    expect(isValidSpecFrontmatter(frontmatter)).toBe(false);
  });

  test('rejects frontmatter with non-array blockedBy', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: 'not-an-array',
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

describe('validateSpecFrontmatter', () => {
  test('returns empty array for valid frontmatter', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
    };
    expect(validateSpecFrontmatter(frontmatter)).toEqual([]);
  });

  test('returns error with field "status" for invalid status', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'done',
      parent: null,
      blockedBy: [],
    };
    const errors = validateSpecFrontmatter(frontmatter);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const statusError = errors.find(e => e.field === 'status');
    if (statusError === undefined) { expect(statusError).toBeDefined(); return; }
    expect(statusError.message).toContain('ready');
    expect(statusError.message).toContain('closed');
    expect(statusError.actualValue).toBe('done');
  });

  test('returns error with field "id" for missing id', () => {
    const frontmatter = {
      status: 'ready',
      parent: null,
      blockedBy: [],
    };
    const errors = validateSpecFrontmatter(frontmatter);
    const idError = errors.find(e => e.field === 'id');
    if (idError === undefined) { expect(idError).toBeDefined(); return; }
    expect(idError.message).toContain('non-empty string');
  });

  test('returns error with field "id" for empty id', () => {
    const frontmatter = {
      id: '',
      status: 'ready',
      parent: null,
      blockedBy: [],
    };
    const errors = validateSpecFrontmatter(frontmatter);
    const idError = errors.find(e => e.field === 'id');
    expect(idError).toBeDefined();
  });

  test('returns error with field "parent" for invalid parent type', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: 123,
      blockedBy: [],
    };
    const errors = validateSpecFrontmatter(frontmatter);
    const parentError = errors.find(e => e.field === 'parent');
    if (parentError === undefined) { expect(parentError).toBeDefined(); return; }
    expect(parentError.message).toContain('string or null');
  });

  test('returns multiple errors when multiple fields are invalid', () => {
    const frontmatter = {
      id: '',
      status: 'done',
      parent: 123,
      blockedBy: 'not-an-array',
    };
    const errors = validateSpecFrontmatter(frontmatter);
    expect(errors.length).toBeGreaterThanOrEqual(4);
    const fields = errors.map(e => e.field);
    expect(fields).toContain('id');
    expect(fields).toContain('status');
    expect(fields).toContain('parent');
    expect(fields).toContain('blockedBy');
  });

  test('isValidSpecFrontmatter returns false when validateSpecFrontmatter returns errors', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'done',
      parent: null,
      blockedBy: [],
    };
    expect(validateSpecFrontmatter(frontmatter).length).toBeGreaterThan(0);
    expect(isValidSpecFrontmatter(frontmatter)).toBe(false);
  });

  test('returns error for non-object value', () => {
    const errors = validateSpecFrontmatter('not-an-object');
    expect(errors.length).toBe(1);
    const firstError = errors[0];
    if (firstError === undefined) { expect(firstError).toBeDefined(); return; }
    expect(firstError.field).toBe('frontmatter');
  });

  test('returns error for invalid priority', () => {
    const frontmatter = {
      id: 'a1b2',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 99,
    };
    const errors = validateSpecFrontmatter(frontmatter);
    const priorityError = errors.find(e => e.field === 'priority');
    if (priorityError === undefined) { expect(priorityError).toBeDefined(); return; }
    expect(priorityError.actualValue).toBe('99');
  });
});

describe('getStatusIcon', () => {
  test('maps ready to ○', () => {
    expect(getStatusIcon('ready')).toBe('○');
  });

  test('maps in_progress to ◐', () => {
    expect(getStatusIcon('in_progress')).toBe('◐');
  });

  test('maps blocked to ⊘', () => {
    expect(getStatusIcon('blocked')).toBe('⊘');
  });

  test('maps closed to ●', () => {
    expect(getStatusIcon('closed')).toBe('●');
  });

  test('maps deferred to ◇', () => {
    expect(getStatusIcon('deferred')).toBe('◇');
  });

  test('maps not_planned to ✕', () => {
    expect(getStatusIcon('not_planned')).toBe('✕');
  });
});
