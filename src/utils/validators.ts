/** Validates terminal designation format: x.xx (e.g. 2.13, 1.04, 3.01) */
export function isValidTerminalDesignation(value: string): boolean {
  return /^\d+\.\d{2}$/.test(value.trim());
}

/** Validates a DA ID — must be letters followed by digits, e.g. DA001 */
export function isValidDAId(value: string): boolean {
  return /^[A-Za-z]{2}\d{3,}$/.test(value.trim());
}

/** Normalise DA ID to uppercase */
export function normaliseDAId(value: string): string {
  return value.trim().toUpperCase();
}
