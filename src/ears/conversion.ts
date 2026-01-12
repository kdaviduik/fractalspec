/**
 * EARS conversion using LLM.
 * Currently stubbed - will integrate with Claude API later.
 */

export interface ConversionResult {
  original: string;
  converted: string | null;
  pattern: string | null;
  message: string;
}

export async function convertToEars(text: string): Promise<ConversionResult> {
  return {
    original: text,
    converted: null,
    pattern: null,
    message:
      'LLM conversion not yet implemented. Please manually convert to EARS format.',
  };
}
