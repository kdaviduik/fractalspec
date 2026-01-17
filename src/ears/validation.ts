/**
 * EARS requirement validation.
 * Validates requirements against EARS patterns and provides suggestions.
 */

import { detectEarsPattern, EARS_PATTERN_TEMPLATES } from './patterns';
import type { Spec, ValidationResult } from '../types';

export function validateRequirement(text: string): ValidationResult {
  const trimmed = text.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      errors: ['Requirement is empty'],
      suggestions: [],
    };
  }

  const pattern = detectEarsPattern(trimmed);

  if (pattern) {
    return {
      valid: true,
      pattern,
      errors: [],
      suggestions: [],
    };
  }

  return {
    valid: false,
    errors: ['Requirement does not follow EARS syntax'],
    suggestions: generateSuggestions(trimmed),
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
