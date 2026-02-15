/**
 * sc validate - Validate EARS format
 */

import { parseArgs } from 'util';
import type { CommandHandler, ValidationResult } from '../types';
import type { CommandHelp } from '../help.js';
import { dim } from '../help.js';
import { findSpecFile, readAllSpecs } from '../spec-filesystem';
import { validateSpecRequirements, extractRequirements } from '../ears/validation';

function displayRequirementResult(
  result: ValidationResult,
  requirement: string,
  index: number
): boolean {
  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  const patternInfo = result.pattern !== undefined ? ` (${result.pattern})` : '';

  if (errors.length > 0) {
    console.log(`\n✗ Requirement ${index + 1}${patternInfo}`);
    console.log(`  "${requirement.slice(0, 60)}${requirement.length > 60 ? '...' : ''}"`);

    for (const error of errors) {
      console.log(`  ❌ ${error.message}`);
      if (error.suggestion !== undefined) {
        console.log(`     → ${error.suggestion}`);
      }
    }
    return true;
  }

  if (warnings.length > 0) {
    console.log(`\n⚠ Requirement ${index + 1}${patternInfo}`);
    console.log(`  "${requirement.slice(0, 60)}${requirement.length > 60 ? '...' : ''}"`);

    for (const warning of warnings) {
      console.log(`  ${dim(`⚠️  ${warning.message}`)}`);
      if (warning.suggestion !== undefined) {
        console.log(`     ${dim(`→ ${warning.suggestion}`)}`);
      }
    }
    return false;
  }

  console.log(`\n✓ Requirement ${index + 1}${patternInfo}`);
  console.log(`  "${requirement.slice(0, 60)}${requirement.length > 60 ? '...' : ''}"`);

  return false;
}

export const command: CommandHandler = {
  name: 'validate',
  description: 'Validate EARS format',

  getHelp(): CommandHelp {
    return {
      name: 'sc validate',
      synopsis: 'sc validate [id] [--fix]',
      description: `Validate requirement statements against EARS format patterns.

Without arguments: validates all specs in the repository.
With <id>: validates a single spec and shows detailed errors.

Checks that each requirement matches one of the six EARS patterns:
  - Ubiquitous, Event-driven, State-driven, Optional, Unwanted, Complex

The validator distinguishes between errors and warnings:
  - Errors: Missing EARS structure, vague responses ("shall work well"), empty requirements
  - Warnings: Generic "system" usage, very long requirements (>200 chars)

Validation passes with warnings but fails with errors.`,
      flags: [
        {
          flag: '--fix',
          description: '(Planned) Auto-fix format issues where possible',
        },
      ],
      examples: [
        '# Validate all specs',
        'sc validate',
        '',
        '# Validate single spec with detailed output',
        'sc validate a1b2c3',
      ],
      notes: [
        'Exits with code 1 if any validation errors (not warnings) are found.',
        'Warnings indicate style improvements but do not fail validation.',
        'Use "sc ears" to see pattern reference and get conversion help.',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const { values, positionals } = parseArgs({
      args,
      options: {
        fix: { type: 'boolean' },
      },
      allowPositionals: true,
    });

    const specId = positionals[0];

    if (values.fix) {
      console.log('Auto-fix not yet implemented. Please fix requirements manually.');
    }

    if (specId !== undefined) {
      return validateSingleSpec(specId);
    }

    return validateAllSpecs();
  },
};

async function validateSingleSpec(specId: string): Promise<number> {
  const spec = await findSpecFile(specId);
  if (!spec) {
    console.error(`Spec not found: ${specId}`);
    return 1;
  }

  console.log(`\nValidating: ${spec.title} (${spec.id})`);
  console.log('═'.repeat(50));

  const requirements = extractRequirements(spec.content);
  if (requirements.length === 0) {
    console.log('No requirements found in this spec.');
    return 0;
  }

  const results = validateSpecRequirements(spec);
  let hasErrors = false;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const requirement = requirements[i];
    if (result === undefined || requirement === undefined) continue;

    const hasError = displayRequirementResult(result, requirement, i);
    if (hasError) {
      hasErrors = true;
    }
  }

  const validCount = results.filter((r) => r.valid).length;
  console.log(`\nSummary: ${validCount}/${results.length} requirements valid`);

  return hasErrors ? 1 : 0;
}

async function validateAllSpecs(): Promise<number> {
  const { specs } = await readAllSpecs();

  if (specs.length === 0) {
    console.log('No specs found.');
    return 0;
  }

  console.log(`\nValidating ${specs.length} specs...`);
  console.log('═'.repeat(50));

  let totalReqs = 0;
  let validReqs = 0;
  let specsWithIssues = 0;

  for (const spec of specs) {
    const results = validateSpecRequirements(spec);
    if (results.length === 0) continue;

    const valid = results.filter((r) => r.valid).length;
    totalReqs += results.length;
    validReqs += valid;

    if (valid < results.length) {
      specsWithIssues++;
      console.log(`✗ ${spec.id}: ${valid}/${results.length} valid - ${spec.title}`);
    } else {
      console.log(`✓ ${spec.id}: ${valid}/${results.length} valid - ${spec.title}`);
    }
  }

  console.log(`\nTotal: ${validReqs}/${totalReqs} requirements valid`);
  console.log(`Specs with issues: ${specsWithIssues}`);

  return specsWithIssues > 0 ? 1 : 0;
}
