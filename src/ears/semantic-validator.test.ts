import { describe, expect, test } from 'bun:test';
import { performSemanticValidation } from './semantic-validator';

describe('performSemanticValidation', () => {
  describe('vague responses', () => {
    test('rejects "shall work well"', () => {
      const result = performSemanticValidation(
        'The system shall work well',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.message).toContain('not testable');
      expect(errors[0]?.suggestion).toBeDefined();
    });

    test('rejects "shall function properly"', () => {
      const result = performSemanticValidation(
        'The system shall function properly',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.message).toContain('not testable');
    });

    test('rejects "shall be fast"', () => {
      const result = performSemanticValidation(
        'The system shall be fast',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.message).toContain('not testable');
    });

    test('rejects "shall be user-friendly"', () => {
      const result = performSemanticValidation(
        'The interface shall be user-friendly',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
    });

    test('rejects bare "shall support"', () => {
      const result = performSemanticValidation(
        'The system shall support',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.suggestion).toContain('what will be supported');
    });

    test('rejects bare "shall handle"', () => {
      const result = performSemanticValidation(
        'The system shall handle',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.suggestion).toContain('what will be handled');
    });
  });

  describe('specific, testable responses', () => {
    test('accepts "shall respond within 200ms"', () => {
      const result = performSemanticValidation(
        'The system shall respond within 200ms',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    test('accepts "shall validate all 5 fields"', () => {
      const result = performSemanticValidation(
        'The system shall validate all 5 fields',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    test('accepts "shall support CSV and JSON export formats"', () => {
      const result = performSemanticValidation(
        'The system shall support CSV and JSON export formats',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    test('accepts "shall handle errors by retrying 3 times"', () => {
      const result = performSemanticValidation(
        'The system shall handle errors by retrying 3 times',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    test('accepts detailed response with specific behavior', () => {
      const result = performSemanticValidation(
        'When the user clicks submit, the system shall validate email format using RFC 5322 standard',
        'event_driven'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('terse responses', () => {
    test('warns about single-word response', () => {
      const result = performSemanticValidation(
        'The system shall authenticate',
        'ubiquitous'
      );

      const warnings = result.filter((i) => i.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]?.message).toContain('very terse');
    });

    test('does not warn about detailed responses', () => {
      const result = performSemanticValidation(
        'The system shall authenticate using JWT tokens',
        'ubiquitous'
      );

      const warnings = result.filter((i) => i.severity === 'warning');
      const terseWarnings = warnings.filter((w) => w.message.includes('terse'));
      expect(terseWarnings).toHaveLength(0);
    });
  });

  describe('missing "shall"', () => {
    test('returns error if "shall" is missing', () => {
      const result = performSemanticValidation(
        'The system must respond within 200ms',
        'ubiquitous'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.message).toContain('Missing "shall"');
    });

    test('accepts requirements with "shall"', () => {
      const result = performSemanticValidation(
        'The system shall respond within 200ms',
        'ubiquitous'
      );

      const shallErrors = result.filter(
        (i) => i.severity === 'error' && i.message.includes('Missing "shall"')
      );
      expect(shallErrors).toHaveLength(0);
    });
  });

  describe('pattern-specific validation', () => {
    test('validates event-driven pattern', () => {
      const result = performSemanticValidation(
        'When the user clicks submit, the system shall validate all fields',
        'event_driven'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    test('validates state-driven pattern', () => {
      const result = performSemanticValidation(
        'While the user is authenticated, the system shall display navigation menu',
        'state_driven'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });

    test('validates complex pattern', () => {
      const result = performSemanticValidation(
        'While the cart contains items, when the user clicks checkout, the system shall initiate payment flow',
        'complex'
      );

      const errors = result.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });
});
