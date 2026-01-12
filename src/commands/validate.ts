/**
 * sc validate - Validate EARS format
 */

import { parseArgs } from 'util';
import type { CommandHandler } from '../types';
import { findSpecFile, readAllSpecs } from '../spec-filesystem';
import { validateSpecRequirements, extractRequirements } from '../ears/validation';

export const command: CommandHandler = {
  name: 'validate',
  description: 'Validate EARS format',

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

    if (specId) {
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
    if (!result || !requirement) continue;

    const status = result.valid ? '✓' : '✗';
    const patternInfo = result.pattern ? ` (${result.pattern})` : '';

    console.log(`\n${status} Requirement ${i + 1}${patternInfo}`);
    console.log(`  "${requirement.slice(0, 60)}${requirement.length > 60 ? '...' : ''}"`);

    if (!result.valid) {
      hasErrors = true;
      for (const error of result.errors) {
        console.log(`  ⚠ ${error}`);
      }
      for (const suggestion of result.suggestions) {
        console.log(`  → ${suggestion}`);
      }
    }
  }

  const validCount = results.filter((r) => r.valid).length;
  console.log(`\nSummary: ${validCount}/${results.length} requirements valid`);

  return hasErrors ? 1 : 0;
}

async function validateAllSpecs(): Promise<number> {
  const specs = await readAllSpecs();

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
