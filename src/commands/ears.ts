/**
 * sc ears - Convert text to EARS format
 */

import type { CommandHandler } from '../types';
import { detectEarsPattern, EARS_PATTERN_TEMPLATES } from '../ears/patterns';
import { convertToEars } from '../ears/conversion';

export const command: CommandHandler = {
  name: 'ears',
  description: 'Convert text to EARS format',

  async execute(args: string[]): Promise<number> {
    const text = args.join(' ');

    if (!text) {
      console.log('EARS (Easy Approach to Requirements Syntax)');
      console.log('════════════════════════════════════════════\n');
      console.log('Usage: sc ears "<requirement text>"\n');
      console.log('The 6 EARS Patterns:\n');

      const patterns = [
        { name: 'Ubiquitous', template: EARS_PATTERN_TEMPLATES.ubiquitous },
        { name: 'State-driven', template: EARS_PATTERN_TEMPLATES.state_driven },
        { name: 'Event-driven', template: EARS_PATTERN_TEMPLATES.event_driven },
        { name: 'Optional', template: EARS_PATTERN_TEMPLATES.optional },
        { name: 'Unwanted', template: EARS_PATTERN_TEMPLATES.unwanted },
        { name: 'Complex', template: EARS_PATTERN_TEMPLATES.complex },
      ];

      for (const p of patterns) {
        console.log(`  ${p.name}:`);
        console.log(`    ${p.template}\n`);
      }

      console.log('Examples:');
      console.log('  sc ears "users can login with email"');
      console.log('  sc ears "show error when validation fails"');

      return 0;
    }

    const existingPattern = detectEarsPattern(text);
    if (existingPattern) {
      console.log(`✓ Already in EARS format: ${existingPattern}`);
      console.log(`  "${text}"`);
      return 0;
    }

    console.log('Converting to EARS format...\n');
    console.log(`Original: "${text}"\n`);

    const result = await convertToEars(text);

    if (result.converted) {
      console.log(`Suggested (${result.pattern}):`);
      console.log(`  "${result.converted}"`);
    } else {
      console.log(result.message);
      console.log('\nSuggested patterns based on your text:\n');

      const lower = text.toLowerCase();

      if (lower.includes('when') || lower.includes('click') || lower.includes('submit')) {
        console.log('  Event-driven:');
        console.log(`    When [trigger], the system shall [response].`);
      }

      if (lower.includes('if') || lower.includes('error') || lower.includes('fail')) {
        console.log('  Unwanted behavior:');
        console.log(`    If [condition], then the system shall [response].`);
      }

      if (lower.includes('while') || lower.includes('during')) {
        console.log('  State-driven:');
        console.log(`    While [state], the system shall [response].`);
      }

      console.log('  Ubiquitous (always true):');
      console.log(`    The system shall [response].`);
    }

    return 0;
  },
};
