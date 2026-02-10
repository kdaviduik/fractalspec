/**
 * sc ears - Convert text to EARS format
 */

import type { CommandHandler } from '../types';
import type { CommandHelp } from '../help.js';
import { detectEarsPattern, EARS_PATTERN_TEMPLATES } from '../ears/patterns';
import { convertToEars } from '../ears/conversion';

function displayEarsReference(): void {
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
}

function displayPatternSuggestions(text: string): void {
  console.log('\nSuggested patterns based on your text:\n');

  const lower = text.toLowerCase();

  if (lower.includes('when') || lower.includes('click') || lower.includes('submit')) {
    console.log('  Event-driven:');
    console.log(`    When [trigger], [component] shall [response].`);
    console.log(`    Example: When user clicks Submit, the form validator shall check all required fields.`);
  }

  if (lower.includes('if') || lower.includes('error') || lower.includes('fail')) {
    console.log('  Unwanted behavior:');
    console.log(`    If [condition], then [component] shall [response].`);
    console.log(`    Example: If validation fails, then the UI shall display field-specific error messages.`);
  }

  if (lower.includes('while') || lower.includes('during')) {
    console.log('  State-driven:');
    console.log(`    While [state], [component] shall [response].`);
    console.log(`    Example: While user is typing, the autocomplete component shall suggest matches.`);
  }

  console.log('  Ubiquitous (always true):');
  console.log(`    [Component] shall [response].`);
  console.log(`    Example: The auth module shall hash passwords using bcrypt.`);

  console.log('\nNote: Use specific component names instead of "system" when possible.');
  console.log('Avoid vague responses like "work well", "be fast" - use measurable criteria.');
}

export const command: CommandHandler = {
  name: 'ears',
  description: 'Convert text to EARS format',

  getHelp(): CommandHelp {
    return {
      name: 'sc ears',
      synopsis: 'sc ears [text]',
      description: `EARS format reference and conversion tool.

Without arguments: displays the six EARS patterns with templates.
With text: detects if text is already in EARS format, or suggests conversion.

EARS (Easy Approach to Requirements Syntax) ensures requirements are:
  - Unambiguous (single interpretation)
  - Testable (can verify compliance)
  - Complete (specifies trigger and response)

The validator supports multi-word component names ("Tier 1 shall", "the backend
server shall") and distinguishes between errors (missing EARS structure, vague
responses) and warnings (generic "system" usage, very long requirements).`,
      examples: [
        '# Show EARS pattern reference',
        'sc ears',
        '',
        '# Convert informal text to EARS',
        'sc ears "users can login with email"',
        '',
        '# Check if already in EARS format',
        'sc ears "When the user clicks submit, the form validator shall validate all fields"',
      ],
      notes: [
        'The conversion uses AI to suggest EARS-formatted requirements.',
        'Always review suggested conversions for accuracy and completeness.',
        'Prefer specific component names over generic "system" where possible.',
      ],
    };
  },

  async execute(args: string[]): Promise<number> {
    const text = args.join(' ');

    if (text === '') {
      displayEarsReference();
      return 0;
    }

    const existingPattern = detectEarsPattern(text);
    if (existingPattern !== null) {
      console.log(`✓ Already in EARS format: ${existingPattern}`);
      console.log(`  "${text}"`);
      return 0;
    }

    console.log('Converting to EARS format...\n');
    console.log(`Original: "${text}"\n`);

    const result = await convertToEars(text);

    if (result.converted !== undefined) {
      console.log(`Suggested (${result.pattern}):`);
      console.log(`  "${result.converted}"`);
    } else {
      console.log(result.message);
      displayPatternSuggestions(text);
    }

    return 0;
  },
};
