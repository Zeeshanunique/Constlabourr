/**
 * Normalizes Indian mobile phone numbers to a consistent 10-digit format.
 * Strips all non-digit characters, leading +91 / 91 country codes, and leading 0.
 *
 * Examples:
 * "+919835812224" -> "9835812224"
 * "919835812224"  -> "9835812224"
 * "09835812224"   -> "9835812224"
 * "9835812224"    -> "9835812224"
 * "+91 98358 12224" -> "9835812224"
 */
export function normalizePhoneNumber(raw: string | null | undefined): string {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  } else if (digits.length > 10) {
    digits = digits.slice(-10);
  }
  return digits;
}
