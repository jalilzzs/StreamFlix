// ==========================================
// StreamFlix Security
// Client-side security helpers
// ==========================================

/**
 * Remove dangerous control characters from user-controlled text.
 */
export function sanitizeText(value) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

/**
 * Safely encode a value before putting it into a URL.
 */
export function safeUrlPart(value) {
  return encodeURIComponent(sanitizeText(String(value ?? '')));
}

/**
 * Allow only http/https URLs.
 */
export function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' ||
      url.protocol === 'http:'
    );
  } catch {
    return false;
  }
}

/**
 * Safely open an external URL.
 */
export function openSafeUrl(url) {
  if (!isSafeHttpUrl(url)) {
    return false;
  }

  window.open(
    url,
    '_blank',
    'noopener,noreferrer'
  );

  return true;
}

/**
 * Prevent javascript:, data:, vbscript: and other
 * dangerous protocols from being used accidentally.
 */
export function sanitizeUrl(value) {
  if (!value) return '';

  try {
    const url = new URL(value, window.location.origin);

    const allowedProtocols = ['http:', 'https:'];

    if (!allowedProtocols.includes(url.protocol)) {
      return '';
    }

    return url.href;
  } catch {
    return '';
  }
}

/**
 * Check whether a URL belongs to the current site.
 */
export function isSameOrigin(url) {
  try {
    const parsed = new URL(url, window.location.origin);

    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Generate a cryptographically secure random ID.
 */
export function secureRandomId(length = 16) {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Protect localStorage/sessionStorage from accidental
 * insertion of undefined/null values.
 */
export function safeStorageSet(storage, key, value) {
  if (!storage || !key) return false;

  try {
    const cleanKey = sanitizeText(key);

    if (!cleanKey) return false;

    storage.setItem(
      cleanKey,
      typeof value === 'string'
        ? value
        : JSON.stringify(value)
    );

    return true;
  } catch {
    return false;
  }
}

/**
 * Safely read JSON from storage.
 */
export function safeStorageGet(storage, key, fallback = null) {
  if (!storage || !key) return fallback;

  try {
    const value = storage.getItem(key);

    if (value === null) {
      return fallback;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch {
    return fallback;
  }
}

/**
 * Basic email validation.
 * This is only client-side validation.
 * Real validation must still happen server-side.
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;

  const value = email.trim();

  if (value.length > 254) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Limit user-controlled strings to a safe maximum length.
 */
export function limitText(value, maxLength = 1000) {
  if (typeof value !== 'string') return '';

  return sanitizeText(value).slice(0, maxLength);
}

/**
 * Safe JSON parsing.
 */
export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * Prevent accidental use of dangerous HTML.
 *
 * IMPORTANT:
 * React already escapes normal JSX text automatically.
 * Do not use dangerouslySetInnerHTML with untrusted content.
 */
export function containsDangerousHtml(value) {
  if (typeof value !== 'string') return false;

  return /<\s*(script|iframe|object|embed|style|link|meta|base|form)\b/i.test(
    value
  );
}

/**
 * Security initialization.
 *
 * This does NOT replace server-side HTTP security headers.
 * Those will be configured separately on Render.
 */
export function initSecurity() {
  if (typeof window === 'undefined') {
    return;
  }

  // Remove accidental browser opener relationship
  // from links dynamically created by the application.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target?.closest?.('a');

      if (!target) return;

      if (target.target === '_blank') {
        target.rel = 'noopener noreferrer';
      }
    },
    true
  );
}

export default {
  sanitizeText,
  safeUrlPart,
  isSafeHttpUrl,
  openSafeUrl,
  sanitizeUrl,
  isSameOrigin,
  secureRandomId,
  safeStorageSet,
  safeStorageGet,
  isValidEmail,
  limitText,
  safeJsonParse,
  containsDangerousHtml,
  initSecurity,
};
