/**
 * SSRF protection — block requests to private/internal network addresses.
 */
const PRIVATE_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/0\./,
  /^https?:\/\/\[::1\]/,
  /^https?:\/\/169\.254\./,       // AWS metadata
  /^https?:\/\/metadata\./i,      // Cloud metadata
  /^file:/i,
  /^ftp:/i,
];

export function isPrivateUrl(url: string): boolean {
  return PRIVATE_PATTERNS.some((p) => p.test(url));
}
