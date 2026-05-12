/**
 * Shared Firestore payload sanitizer.
 *
 * Firestore rejects `undefined` anywhere inside a document payload. This helper
 * strips undefined object fields recursively while preserving valid Firestore
 * values like Timestamp, Date, sentinels, document references, null, false, 0,
 * empty strings, and empty arrays.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizeForFirestore(value: unknown, depth = 0): unknown {
  if (depth > 20) return value;

  if (value === null) return null;
  if (value === undefined) return undefined;

  if (Array.isArray(value)) {
    return value.map((item) => {
      const sanitized = sanitizeForFirestore(item, depth + 1);
      return sanitized === undefined ? null : sanitized;
    });
  }

  // Preserve Firestore sentinels and class instances like Timestamp/Date by
  // only recursively sanitizing plain JSON-like objects.
  if (!isPlainObject(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    const sanitized = sanitizeForFirestore(nestedValue, depth + 1);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }
  }

  return result;
}

export function sanitizeDocument(
  document: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeForFirestore(document, 0) as Record<string, unknown>;
}
