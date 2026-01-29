import { describe, expect, test } from 'bun:test';
import {
  validateRequirement,
  validateSpecRequirements,
  extractRequirements,
} from './validation';
import type { Spec } from '../types';

describe('validateRequirement', () => {
  test('returns valid for EARS-formatted requirement', () => {
    const result = validateRequirement(
      'When the user clicks submit, the system shall save the form.'
    );

    expect(result.valid).toBe(true);
    expect(result.pattern).toBe('event_driven');
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  test('warns about generic "system" usage', () => {
    const result = validateRequirement(
      'When the user clicks submit, the system shall save the form.'
    );

    expect(result.valid).toBe(true);
    const warnings = result.issues.filter((i) => i.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]?.message).toContain('specific component name');
  });

  test('accepts specific component names without warning', () => {
    const result = validateRequirement(
      'When the user clicks submit, Tier 1 shall save the form.'
    );

    expect(result.valid).toBe(true);
    const warnings = result.issues.filter((i) => i.severity === 'warning');
    expect(warnings).toHaveLength(0);
  });

  test('returns invalid for non-EARS requirement', () => {
    const result = validateRequirement('Users can login with email.');

    expect(result.valid).toBe(false);
    expect(result.pattern).toBeUndefined();
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });

  test('provides suggestion for non-EARS requirement', () => {
    const result = validateRequirement('The system should save data.');

    expect(result.valid).toBe(false);
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.suggestion).toBeDefined();
  });

  test('warns about very long requirements', () => {
    const longReq =
      'When the user submits the form, the system shall validate all fields including email, password, name, address, phone number, and any other custom fields that may have been added by the administrator and then save the data to the database after ensuring all constraints are met.';

    const result = validateRequirement(longReq);

    expect(result.valid).toBe(true);
    const warnings = result.issues.filter((i) => i.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('very long'))).toBe(true);
  });

  test('handles empty string', () => {
    const result = validateRequirement('');

    expect(result.valid).toBe(false);
    const errors = result.issues.filter((i) => i.severity === 'error');
    expect(errors.some((e) => e.message === 'Requirement is empty')).toBe(true);
  });
});

describe('extractRequirements', () => {
  test('extracts numbered requirements from content', () => {
    const content = `## Requirements

1. When the user logs in, the system shall create a session.
2. The system shall encrypt all passwords.
3. If an error occurs, the system shall log it.
`;

    const requirements = extractRequirements(content);

    expect(requirements).toHaveLength(3);
    expect(requirements[0]).toContain('When the user logs in');
    expect(requirements[1]).toContain('The system shall encrypt');
    expect(requirements[2]).toContain('If an error occurs');
  });

  test('extracts bullet point requirements', () => {
    const content = `## Requirements

- When the user submits, the system shall validate.
- The system shall respond within 200ms.
`;

    const requirements = extractRequirements(content);

    expect(requirements).toHaveLength(2);
  });

  test('returns empty array when no requirements section', () => {
    const content = `## Overview

Just some overview content.
`;

    const requirements = extractRequirements(content);

    expect(requirements).toHaveLength(0);
  });

  test('handles EARS format prefix in list items', () => {
    const content = `## Requirements

### Authentication
1. When the user submits credentials, the system shall validate them.

### Security
2. The system shall hash all passwords.
`;

    const requirements = extractRequirements(content);

    expect(requirements).toHaveLength(2);
  });
});

describe('validateSpecRequirements', () => {
  test('validates all requirements in spec', () => {
    const spec: Spec = {
      id: 'test',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Test',
      content: `# Spec: Test

## Requirements

1. When the user logs in, the system shall create a session.
2. Users can do things.
`,
      filePath: '/test.md',
    };

    const results = validateSpecRequirements(spec);

    expect(results).toHaveLength(2);
    expect(results[0]?.valid).toBe(true);
    expect(results[1]?.valid).toBe(false);
  });

  test('returns empty array for spec with no requirements', () => {
    const spec: Spec = {
      id: 'test',
      status: 'ready',
      parent: null,
      blockedBy: [],
      priority: 5,
      pr: null,
      title: 'Test',
      content: '# Spec: Test\n\nNo requirements here.',
      filePath: '/test.md',
    };

    const results = validateSpecRequirements(spec);

    expect(results).toHaveLength(0);
  });
});
