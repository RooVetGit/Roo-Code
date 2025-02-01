/**
 * Code normalization functions for improving diff accuracy in JS/TS code.
 */

import crypto from 'crypto';

/**
 * Normalizes whitespace in JS/TS code to improve diff matching.
 * @param code The JS/TS code string.
 * @returns The code with normalized whitespace.
 */
export function normalizeWhitespace(code: string): string {
  return code.replace(/[\s\t\n]*/g, ' ');
}

/**
 * Hashes template literals in JS/TS code to simplify diff matching.
 * @param code The JS/TS code string.
 * @returns The code with template literals replaced by hashes and a mapping of hashes to original literals.
 */
export function hashTemplateLiterals(code: string): { code: string; literalMap: { [hash: string]: string } } {
  const literalMap: { [hash: string]: string } = {};
  let hashCounter = 0;

  const hashedCode = code.replace(/`([^`]*)`/g, (match, literalContent) => {
    const hash = `__TEMPLATE_LITERAL_HASH_${hashCounter++}__`;
    literalMap[hash] = match;
    return hash;
  });

  return { code: hashedCode, literalMap };
}
