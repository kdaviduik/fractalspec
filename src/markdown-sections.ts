/**
 * Markdown section parsing and replacement for spec documents.
 * Handles extracting, replacing, and appending to sections by heading name.
 */

/** Maps CLI flag names to their canonical heading text in spec templates. */
export const SECTION_HEADINGS: Record<string, string> = {
  overview: 'Overview',
  background: 'Background & Context',
  goals: 'Goals',
  requirements: 'Requirements (EARS format)',
  tasks: 'Inline Tasks',
  prerequisites: 'Prerequisites',
  questions: 'Open Questions',
};

/** All known heading names that should be checked for boilerplate. */
const CHECKABLE_SECTIONS = Object.values(SECTION_HEADINGS);

/**
 * Boilerplate patterns — lines matching ANY of these are considered template placeholders.
 * A section is boilerplate if ALL its non-empty lines match at least one pattern.
 */
const BOILERPLATE_PATTERNS: RegExp[] = [
  // Bracket placeholders: [2-3 sentences...], [None yet], [What must be done first, if any], etc.
  /^\s*-?\s*\[(?!x\]|X\]| \])[^\]]*\]\s*$/,
  // Template task checkboxes
  /^\s*- \[ \] First small task\s*$/,
  /^\s*- \[ \] Second small task\s*$/,
  // EARS example/template lines
  /^\s*#+\s*Feature Area\s*$/,
  /^\d+\.\s*(?:When )?\[(?:trigger|component|response|always-true constraint)\]/i,
  /^\s*Example:\s*$/,
  /^\s*- When user submits form, the validator shall/,
  /^\s*- The auth module shall hash passwords using bcrypt/,
  /^\s*Note: Use specific component names/,
  /^\s*Avoid vague responses like/,
];

function isBoilerplateLine(line: string): boolean {
  return BOILERPLATE_PATTERNS.some(pattern => pattern.test(line));
}

interface SectionMatch {
  headingLine: string;
  headingLevel: number;
  bodyStart: number;
  bodyEnd: number;
}

function parseHeading(line: string): { level: number; text: string } | null {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (match === null) return null;
  const prefix = match[1];
  const text = match[2];
  if (prefix === undefined || text === undefined) return null;
  return { level: prefix.length, text };
}

function findSection(content: string, sectionName: string): SectionMatch | null {
  const lines = content.split('\n');
  const lowerName = sectionName.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const heading = parseHeading(line);
    if (heading === null) continue;
    if (heading.text.toLowerCase() !== lowerName) continue;

    const bodyStart = i + 1;
    let bodyEnd = lines.length;

    for (let j = bodyStart; j < lines.length; j++) {
      const nextLine = lines[j];
      if (nextLine === undefined) continue;
      const nextHeading = parseHeading(nextLine);
      if (nextHeading !== null && nextHeading.level <= heading.level) {
        bodyEnd = j;
        break;
      }
    }

    return { headingLine: line, headingLevel: heading.level, bodyStart, bodyEnd };
  }

  return null;
}

/**
 * Extract section body by heading text. Case-insensitive.
 * Returns null if the section is not found.
 */
export function getSection(content: string, sectionName: string): string | null {
  const match = findSection(content, sectionName);
  if (match === null) return null;

  const lines = content.split('\n');
  return lines.slice(match.bodyStart, match.bodyEnd).join('\n');
}

/**
 * Replace a section's body, preserving the heading line.
 * If the section doesn't exist, appends it at the end with ## level.
 */
export function setSection(content: string, sectionName: string, newBody: string): string {
  const match = findSection(content, sectionName);

  if (match === null) {
    const suffix = content.endsWith('\n') ? '' : '\n';
    return `${content}${suffix}\n## ${sectionName}\n${newBody}`;
  }

  const lines = content.split('\n');
  const before = lines.slice(0, match.bodyStart);
  const after = lines.slice(match.bodyEnd);
  const newBodyLines = newBody.endsWith('\n') ? newBody : newBody + '\n';

  return [...before, newBodyLines, ...after].join('\n');
}

/**
 * Append content to a section. If the section body is only boilerplate, replaces instead.
 * If the section doesn't exist, creates it.
 */
export function appendToSection(content: string, sectionName: string, newBody: string): string {
  const existingBody = getSection(content, sectionName);

  if (existingBody === null || isSectionBoilerplate(existingBody)) {
    return setSection(content, sectionName, newBody);
  }

  const combined = existingBody.trimEnd() + '\n\n' + newBody;
  return setSection(content, sectionName, combined);
}

/**
 * Check if a section body consists entirely of boilerplate placeholder text.
 * Returns true if ALL non-empty lines match known boilerplate patterns,
 * or if the body is empty/whitespace-only.
 */
export function isSectionBoilerplate(body: string): boolean {
  const lines = body.split('\n').filter(line => line.trim() !== '');

  if (lines.length === 0) return true;

  return lines.every(line => isBoilerplateLine(line));
}

/**
 * Find all known section headings that still contain boilerplate.
 * Used by `sc doctor` to detect unfilled specs.
 */
export function findBoilerplateSections(content: string): string[] {
  const results: string[] = [];

  for (const sectionName of CHECKABLE_SECTIONS) {
    const body = getSection(content, sectionName);
    if (body !== null && isSectionBoilerplate(body)) {
      results.push(sectionName);
    }
  }

  return results;
}
