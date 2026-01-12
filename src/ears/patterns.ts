/**
 * EARS (Easy Approach to Requirements Syntax) pattern detection.
 * Implements the 6 EARS patterns for requirement validation.
 */

import type { EarsPattern } from '../types';

export const EARS_PATTERN_TEMPLATES = {
  ubiquitous: 'The <system> shall <response>',
  state_driven: 'While <state>, the <system> shall <response>',
  event_driven: 'When <trigger>, the <system> shall <response>',
  optional: 'Where <feature>, the <system> shall <response>',
  unwanted: 'If <condition>, then the <system> shall <response>',
  complex: 'While <state>, when <trigger>, the <system> shall <response>',
} as const;

interface PatternMatcher {
  pattern: EarsPattern;
  regex: RegExp;
}

const PATTERN_MATCHERS: PatternMatcher[] = [
  {
    pattern: 'complex',
    regex: /^while\s+.+,\s*when\s+.+,\s*the\s+\w+\s+shall\s+/i,
  },
  {
    pattern: 'state_driven',
    regex: /^while\s+.+,\s*the\s+\w+\s+shall\s+/i,
  },
  {
    pattern: 'event_driven',
    regex: /^when\s+.+,\s*the\s+\w+\s+shall\s+/i,
  },
  {
    pattern: 'optional',
    regex: /^where\s+.+,\s*the\s+\w+\s+shall\s+/i,
  },
  {
    pattern: 'unwanted',
    regex: /^if\s+.+,\s*(then\s+)?the\s+\w+\s+shall\s+/i,
  },
  {
    pattern: 'ubiquitous',
    regex: /^the\s+\w+\s+shall\s+/i,
  },
];

export function detectEarsPattern(text: string): EarsPattern | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  for (const matcher of PATTERN_MATCHERS) {
    if (matcher.regex.test(trimmed)) {
      return matcher.pattern;
    }
  }

  return null;
}
