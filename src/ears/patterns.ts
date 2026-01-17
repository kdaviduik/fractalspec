/**
 * EARS (Easy Approach to Requirements Syntax) pattern detection.
 * Implements the 6 EARS patterns for requirement validation.
 */

import type { EarsPattern } from '../types';

export const EARS_PATTERN_TEMPLATES = {
  ubiquitous: '[component] shall <response>',
  state_driven: 'While <state>, [component] shall <response>',
  event_driven: 'When <trigger>, [component] shall <response>',
  optional: 'Where <feature>, [component] shall <response>',
  unwanted: 'If <condition>, then [component] shall <response>',
  complex: 'While <state>, when <trigger>, [component] shall <response>',
} as const;

interface PatternMatcher {
  pattern: EarsPattern;
  regex: RegExp;
}

/**
 * Flexible subject pattern allowing multi-word component names.
 * Optionally matches "the", then one or more words, spaces, or hyphens.
 * Examples: "the system", "Tier 1", "the backend server", "the Quick Capture component"
 */
const SUBJECT_PATTERN = String.raw`(?:the\s+)?(?:[\w\s-]+?)`;

const PATTERN_MATCHERS: PatternMatcher[] = [
  {
    pattern: 'complex',
    regex: new RegExp(`^while\\s+.+,\\s*when\\s+.+,\\s*${SUBJECT_PATTERN}\\s+shall\\s+`, 'i'),
  },
  {
    pattern: 'state_driven',
    regex: new RegExp(`^while\\s+.+,\\s*${SUBJECT_PATTERN}\\s+shall\\s+`, 'i'),
  },
  {
    pattern: 'event_driven',
    regex: new RegExp(`^when\\s+.+,\\s*${SUBJECT_PATTERN}\\s+shall\\s+`, 'i'),
  },
  {
    pattern: 'optional',
    regex: new RegExp(`^where\\s+.+,\\s*${SUBJECT_PATTERN}\\s+shall\\s+`, 'i'),
  },
  {
    pattern: 'unwanted',
    regex: new RegExp(`^if\\s+.+,\\s*(?:then\\s+)?${SUBJECT_PATTERN}\\s+shall\\s+`, 'i'),
  },
  {
    pattern: 'ubiquitous',
    regex: new RegExp(`^${SUBJECT_PATTERN}\\s+shall\\s+`, 'i'),
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
