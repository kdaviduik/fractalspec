import { describe, expect, test } from 'bun:test';
import { detectEarsPattern, EARS_PATTERN_TEMPLATES } from './patterns';

describe('EARS_PATTERN_TEMPLATES', () => {
  test('contains all 6 patterns', () => {
    expect(Object.keys(EARS_PATTERN_TEMPLATES)).toHaveLength(6);
    expect(EARS_PATTERN_TEMPLATES.ubiquitous).toBeDefined();
    expect(EARS_PATTERN_TEMPLATES.state_driven).toBeDefined();
    expect(EARS_PATTERN_TEMPLATES.event_driven).toBeDefined();
    expect(EARS_PATTERN_TEMPLATES.optional).toBeDefined();
    expect(EARS_PATTERN_TEMPLATES.unwanted).toBeDefined();
    expect(EARS_PATTERN_TEMPLATES.complex).toBeDefined();
  });
});

describe('detectEarsPattern', () => {
  describe('ubiquitous pattern', () => {
    test('detects "The system shall" format', () => {
      const result = detectEarsPattern(
        'The system shall respond to API requests within 200ms.'
      );
      expect(result).toBe('ubiquitous');
    });

    test('detects "The application shall" format', () => {
      const result = detectEarsPattern(
        'The application shall encrypt all user passwords.'
      );
      expect(result).toBe('ubiquitous');
    });
  });

  describe('event_driven pattern', () => {
    test('detects "When... shall" format', () => {
      const result = detectEarsPattern(
        'When the user clicks "Submit", the system shall validate all form fields.'
      );
      expect(result).toBe('event_driven');
    });

    test('detects "When... the system shall" format', () => {
      const result = detectEarsPattern(
        'When an error occurs, the system shall log the stack trace.'
      );
      expect(result).toBe('event_driven');
    });
  });

  describe('state_driven pattern', () => {
    test('detects "While... shall" format', () => {
      const result = detectEarsPattern(
        'While the user is unauthenticated, the system shall redirect protected routes to login.'
      );
      expect(result).toBe('state_driven');
    });

    test('detects "While... the application shall" format', () => {
      const result = detectEarsPattern(
        'While the server is starting, the application shall display a loading indicator.'
      );
      expect(result).toBe('state_driven');
    });
  });

  describe('optional pattern', () => {
    test('detects "Where... shall" format', () => {
      const result = detectEarsPattern(
        'Where premium features are enabled, the system shall allow unlimited storage.'
      );
      expect(result).toBe('optional');
    });
  });

  describe('unwanted pattern', () => {
    test('detects "If... then... shall" format', () => {
      const result = detectEarsPattern(
        'If the database connection fails, then the system shall retry 3 times with exponential backoff.'
      );
      expect(result).toBe('unwanted');
    });

    test('detects "If... the system shall" format', () => {
      const result = detectEarsPattern(
        'If validation fails, the system shall display error messages.'
      );
      expect(result).toBe('unwanted');
    });
  });

  describe('complex pattern', () => {
    test('detects "While... when... shall" format', () => {
      const result = detectEarsPattern(
        'While the cart contains items, when the user clicks "Checkout", the system shall initiate payment flow.'
      );
      expect(result).toBe('complex');
    });
  });

  describe('non-EARS text', () => {
    test('returns null for plain text', () => {
      const result = detectEarsPattern('Users can login with email.');
      expect(result).toBeNull();
    });

    test('returns null for incomplete patterns', () => {
      const result = detectEarsPattern('The system should do something.');
      expect(result).toBeNull();
    });

    test('returns null for empty string', () => {
      const result = detectEarsPattern('');
      expect(result).toBeNull();
    });
  });

  describe('case insensitivity', () => {
    test('handles lowercase "when"', () => {
      const result = detectEarsPattern(
        'when the user submits, the system shall save data.'
      );
      expect(result).toBe('event_driven');
    });

    test('handles mixed case', () => {
      const result = detectEarsPattern(
        'WHEN something happens, THE SYSTEM SHALL respond.'
      );
      expect(result).toBe('event_driven');
    });
  });

  describe('multi-word subjects', () => {
    test('accepts "Tier 1" as subject (ubiquitous)', () => {
      const result = detectEarsPattern(
        'Tier 1 shall parse items synchronously extracting dates.'
      );
      expect(result).toBe('ubiquitous');
    });

    test('accepts "the backend server" as subject (ubiquitous)', () => {
      const result = detectEarsPattern(
        'The backend server shall authenticate via JWT within 100ms.'
      );
      expect(result).toBe('ubiquitous');
    });

    test('accepts "the Quick Capture component" as subject (ubiquitous)', () => {
      const result = detectEarsPattern(
        'The Quick Capture component shall display a floating action button.'
      );
      expect(result).toBe('ubiquitous');
    });

    test('accepts multi-word subject with event-driven pattern', () => {
      const result = detectEarsPattern(
        'When items are captured, Tier 1 shall parse synchronously.'
      );
      expect(result).toBe('event_driven');
    });

    test('accepts multi-word subject with state-driven pattern', () => {
      const result = detectEarsPattern(
        'While users type, the Quick Capture component shall run instant parsing.'
      );
      expect(result).toBe('state_driven');
    });

    test('accepts multi-word subject with optional pattern', () => {
      const result = detectEarsPattern(
        'Where premium features are enabled, the analytics dashboard shall show advanced metrics.'
      );
      expect(result).toBe('optional');
    });

    test('accepts multi-word subject with unwanted pattern', () => {
      const result = detectEarsPattern(
        'If the database connection fails, then the error handler shall retry 3 times.'
      );
      expect(result).toBe('unwanted');
    });

    test('accepts multi-word subject with complex pattern', () => {
      const result = detectEarsPattern(
        'While the cart contains items, when the user clicks Checkout, the payment processor shall initiate payment flow.'
      );
      expect(result).toBe('complex');
    });

    test('accepts hyphenated component names', () => {
      const result = detectEarsPattern(
        'The auto-save feature shall persist changes every 30 seconds.'
      );
      expect(result).toBe('ubiquitous');
    });

    test('still accepts single-word subjects', () => {
      const result = detectEarsPattern(
        'When X happens, the system shall respond.'
      );
      expect(result).toBe('event_driven');
    });
  });
});
