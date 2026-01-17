/**
 * Semantic validation for EARS requirements.
 * Validates structure and meaning, not just syntax.
 */

import type { EarsPattern, ValidationIssue } from '../types';

export function performSemanticValidation(
  text: string,
  pattern: EarsPattern
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const shallMatch = text.match(/shall\s+(.+)/i);
  if (!shallMatch) {
    issues.push({
      severity: 'error',
      message: 'Missing "shall" - requirement is not mandatory',
    });
    return issues;
  }

  const response = shallMatch[1].trim();

  const vaguePatterns: Array<{ pattern: RegExp; suggestion: string }> = [
    {
      pattern: /^(?:work|function|operate|be)\s+(?:well|properly|correctly|good|better)/i,
      suggestion:
        'Use specific, measurable criteria (e.g., "respond within 200ms", "validate all 5 fields")',
    },
    {
      pattern: /^be\s+(?:fast|slow|quick|user-friendly|easy|intuitive)/i,
      suggestion:
        'Specify measurable criteria (e.g., "respond within 200ms", "complete in 3 clicks or fewer")',
    },
    {
      pattern: /^support\s*$/i,
      suggestion: 'Specify what will be supported and how (e.g., "support CSV and JSON export formats")',
    },
    {
      pattern: /^handle\s*$/i,
      suggestion:
        'Specify what will be handled and how (e.g., "handle errors by retrying 3 times")',
    },
  ];

  for (const { pattern, suggestion } of vaguePatterns) {
    if (pattern.test(response)) {
      issues.push({
        severity: 'error',
        message: `Response "${response}" is not testable`,
        suggestion,
      });
      return issues;
    }
  }

  if (response.split(/\s+/).length < 2) {
    issues.push({
      severity: 'warning',
      message: 'Response is very terse - consider adding detail',
      suggestion: 'Specify what, how, or to what extent',
    });
  }

  return issues;
}
