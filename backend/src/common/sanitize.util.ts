/**
 * Lightweight XSS / HTML-injection sanitizer.
 *
 * Strategy: strip ALL HTML markup from every incoming string.
 * For a POS SaaS API serving a React frontend (no dangerouslySetInnerHTML),
 * stored raw HTML is the primary attack surface — eliminating it at ingress
 * gives defense-in-depth without depending on external packages.
 *
 * Attack vectors mitigated:
 *   <script>alert(1)</script>    → alert(1)
 *   <img src=x onerror=…>       → (empty)
 *   javascript:void(0)          → void(0)
 *   onload="…"                  → (stripped with enclosing tag)
 *   <!-- comment injection -->   → (stripped)
 */

// Order matters: strip block-level dangerous tags first, then all remaining tags
const RE_COMMENT  = /<!--[\s\S]*?-->/g;
const RE_SCRIPT   = /<script[\s\S]*?<\/script\s*>/gi;
const RE_STYLE    = /<style[\s\S]*?<\/style\s*>/gi;
const RE_IFRAME   = /<iframe[\s\S]*?<\/iframe\s*>/gi;
const RE_TAGS     = /<[^>]*>/g;              // all remaining angle-bracket markup
const RE_JS_PROTO = /javascript\s*:/gi;      // javascript: URLs
const RE_DATA_URI = /data\s*:[^,]*,/gi;      // data: URIs (used in XSS payloads)

export function sanitizeString(value: string): string {
  return value
    .replace(RE_COMMENT,  '')
    .replace(RE_SCRIPT,   '')
    .replace(RE_STYLE,    '')
    .replace(RE_IFRAME,   '')
    .replace(RE_TAGS,     '')
    .replace(RE_JS_PROTO, '')
    .replace(RE_DATA_URI, '')
    .trim();
}

/**
 * Recursively sanitizes every string in an arbitrarily nested object / array.
 * Non-string primitives (numbers, booleans, null, undefined) pass through unchanged.
 * Caps recursion at depth 10 to prevent DoS via deeply nested payloads.
 */
export function sanitizeObject<T>(value: T, depth = 0): T {
  if (depth > 10) return value;             // DoS guard — truncate deep nesting
  if (value === null || value === undefined) return value;
  if (typeof value === 'string')            return sanitizeString(value) as unknown as T;
  if (Array.isArray(value))                 return value.map((v) => sanitizeObject(v, depth + 1)) as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeObject(v, depth + 1);
    }
    return out as T;
  }
  return value;
}
