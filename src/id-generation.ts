/**
 * Adaptive ID generation for specs.
 * Uses beads-style adaptive length based on spec count.
 */

import { randomUUID } from 'crypto';

export const ID_LENGTH_THRESHOLDS = [
  { maxCount: 500, length: 4 },
  { maxCount: 5000, length: 5 },
  { maxCount: 15000, length: 6 },
] as const;

const DEFAULT_LENGTH = 7;
const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const RETRIES_PER_LENGTH = 10;
const MAX_LENGTH_INCREASES = 3;

export function getRequiredIdLength(specCount: number): number {
  for (const threshold of ID_LENGTH_THRESHOLDS) {
    if (specCount <= threshold.maxCount) {
      return threshold.length;
    }
  }
  return DEFAULT_LENGTH;
}

export function isValidId(id: string): boolean {
  if (id.length === 0) {
    return false;
  }
  return /^[a-z0-9]+$/.test(id);
}

function generateRandomId(length: number): string {
  const uuid = randomUUID().replace(/-/g, '');
  let result = '';

  for (let i = 0; i < length && i < uuid.length; i++) {
    const charCode = parseInt(uuid[i] ?? '0', 16);
    result += CHARS[charCode % CHARS.length];
  }

  while (result.length < length) {
    const randomIndex = Math.floor(Math.random() * CHARS.length);
    result += CHARS[randomIndex];
  }

  return result;
}

export function generateId(existingIds: Set<string>, specCount: number): string {
  const baseLength = getRequiredIdLength(specCount);

  for (let lengthIncrease = 0; lengthIncrease <= MAX_LENGTH_INCREASES; lengthIncrease++) {
    const currentLength = baseLength + lengthIncrease;

    for (let retry = 0; retry < RETRIES_PER_LENGTH; retry++) {
      const candidate = generateRandomId(currentLength);
      if (!existingIds.has(candidate)) {
        return candidate;
      }
    }
  }

  const finalLength = baseLength + MAX_LENGTH_INCREASES + 1;
  return generateRandomId(finalLength);
}
