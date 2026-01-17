/**
 * EARS requirement validation.
 * Validates requirements against EARS patterns and provides suggestions.
 */

import { detectEarsPattern, EARS_PATTERN_TEMPLATES } from './patterns';
import { performSemanticValidation } from './semantic-validator';
import type { Spec, ValidationResult, ValidationIssue } from '../types';

export function validateRequirement(text: string): ValidationResult {
  const trimmed = text.trim();
  const issues: ValidationIssue[] = [];

  if (trimmed.length === 0) {
    return {
      valid: false,
      issues: [
        {
          severity: 'error',
          message: 'Requirement is empty',
        },
      ],
    };
  }

  const pattern = detectEarsPattern(trimmed);

  if (!pattern) {
    const suggestions = generateSuggestions(trimmed);
    return {
      valid: false,
      issues: [
        {
          severity: 'error',
          message: 'Requirement does not follow EARS syntax',
          suggestion: suggestions.join(' | '),
        },
      ],
    };
  }

  const semanticIssues = performSemanticValidation(trimmed, pattern);
  issues.push(...semanticIssues);

  if (/(?:the\s+)?system\s+shall/i.test(trimmed)) {
    issues.push({
      severity: 'warning',
      message: 'Consider using specific component name instead of "system"',
      suggestion: 'Example: "Tier 1 shall" or "the backend server shall"',
    });
  }

  if (trimmed.length > 200) {
    issues.push({
      severity: 'warning',
      message: 'Requirement is very long - consider splitting into multiple requirements',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    valid: !hasErrors,
    pattern,
    issues,
  };
}

function generateSuggestions(text: string): string[] {
  const suggestions: string[] = [];
  const lower = text.toLowerCase();

  const patterns = [
    {
      keywords: ['when', 'click', 'submit'],
      template: EARS_PATTERN_TEMPLATES.event_driven,
      name: 'event-driven',
    },
    {
      keywords: ['while', 'during', 'state'],
      template: EARS_PATTERN_TEMPLATES.state_driven,
      name: 'state-driven',
    },
    {
      keywords: ['if', 'error', 'fail'],
      template: EARS_PATTERN_TEMPLATES.unwanted,
      name: 'unwanted behavior',
    },
    {
      keywords: ['optional', 'feature', 'where'],
      template: EARS_PATTERN_TEMPLATES.optional,
      name: 'optional',
    },
  ];

  for (const pattern of patterns) {
    if (pattern.keywords.some(keyword => lower.includes(keyword))) {
      suggestions.push(`Try ${pattern.name}: "${pattern.template}"`);
    }
  }

  if (suggestions.length === 0) {
    suggestions.push(
      `Try ubiquitous: "${EARS_PATTERN_TEMPLATES.ubiquitous}"`
    );
  }

  return suggestions;
}

export function extractRequirements(content: string): string[] {
  const requirements: string[] = [];

  const lines = content.split('\n');
  let inRequirementsSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.toLowerCase().includes('## requirements')) {
      inRequirementsSection = true;
      continue;
    }

    if (inRequirementsSection && trimmed.startsWith('## ')) {
      inRequirementsSection = false;
      continue;
    }

    if (!inRequirementsSection) {
      continue;
    }

    if (trimmed.startsWith('### ')) {
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch?.[1]) {
      requirements.push(numberedMatch[1]);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch?.[1]) {
      requirements.push(bulletMatch[1]);
    }
  }

  return requirements;
}

export function validateSpecRequirements(spec: Spec): ValidationResult[] {
  const requirements = extractRequirements(spec.content);
  return requirements.map((req) => validateRequirement(req));
}
