/**
 * Universal UUID v4 generator.
 * Works seamlessly across:
 * - Desktop & mobile browsers
 * - Secure contexts (HTTPS, localhost)
 * - Insecure contexts (HTTP on LAN IP, e.g. http://10.10.0.203:3000)
 * - Node.js SSR
 *
 * Browsers disable window.crypto.randomUUID() when accessing over plain HTTP
 * on a non-localhost IP address. This utility provides an RFC4122 v4 compliant
 * fallback so recording vehicles, expenses, and records never throws runtime errors.
 */
export function generateUUID(): string {
  // 1. Try native crypto.randomUUID (available in secure contexts / localhost)
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through if restricted by browser security policies
    }
  }

  // 2. Try crypto.getRandomValues if available
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.getRandomValues === 'function'
  ) {
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // Set version (4) and variant (RFC4122)
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    } catch {
      // Fall through to PRNG
    }
  }

  // 3. Robust RFC4122 v4 PRNG + high-resolution timer fallback
  let d = Date.now();
  let d2 =
    (typeof performance !== 'undefined' &&
      typeof performance.now === 'function' &&
      performance.now() * 1000) ||
    0;

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    let r = Math.random() * 16;
    if (d > 0) {
      r = (d + r) % 16 | 0;
      d = Math.floor(d / 16);
    } else {
      r = (d2 + r) % 16 | 0;
      d2 = Math.floor(d2 / 16);
    }
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
