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

  if (lower.includes('when') || lower.includes('click') || lower.includes('submit')) {
    suggestions.push(
      `Try event-driven: "${EARS_PATTERN_TEMPLATES.event_driven}"`
    );
  }

  if (lower.includes('while') || lower.includes('during') || lower.includes('state')) {
    suggestions.push(
      `Try state-driven: "${EARS_PATTERN_TEMPLATES.state_driven}"`
    );
  }

  if (lower.includes('if') || lower.includes('error') || lower.includes('fail')) {
    suggestions.push(
      `Try unwanted behavior: "${EARS_PATTERN_TEMPLATES.unwanted}"`
    );
  }

  if (lower.includes('optional') || lower.includes('feature') || lower.includes('where')) {
    suggestions.push(`Try optional: "${EARS_PATTERN_TEMPLATES.optional}"`);
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
