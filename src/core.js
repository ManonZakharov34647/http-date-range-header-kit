const IMF_FIXDATE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

const TOKEN_CHARS = new Set(
  "!#$%&'*+-.^_`|~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split('')
);

/**
 * Returns true when every character of s is a valid RFC 7230 token character.
 * We avoid a regex here because the token set includes characters that are
 * awkward to escape and easy to get wrong in a character class.
 */
function isToken(s) {
  if (s.length === 0) return false;
  for (const ch of s) {
    if (!TOKEN_CHARS.has(ch)) return false;
  }
  return true;
}

/**
 * True for a syntactically valid entity-tag: W/"opaque" or "opaque".
 * The opaque part must be non-empty and contain only obs-text (0x80-0xFF),
 * visible ASCII, space, or horizontal tab. We reject empty tags because an
 * empty opaque-tag is legal in the grammar but useless to a range server and
 * almost always a sign of a truncated header.
 */
export function isEntityTag(value) {
  if (typeof value !== 'string') return false;
  let i = 0;
  let weak = false;
  if (value.startsWith('W/')) {
    weak = true;
    i = 2;
  }
  const start = i;
  if (value[i] !== '"') return false;
  i += 1;
  let end = -1;
  for (; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 0x22) {
      end = i;
      break;
    }
    // DQUOTE is not allowed inside an opaque-tag; the loop stops at the first one.
    if (code < 0x20 && code !== 0x09) return false;
    if (code === 0x7f) return false;
  }
  if (end === -1) return false;
  if (end === start + 1) return false; // empty tag
  return end === value.length - 1;
}

/**
 * True for an IMF-fixdate HTTP-date. We do not accept the two obsolete
 * RFC 850 / asctime formats because If-Range is defined over HTTP-date, and
 * every deployed origin emits IMF-fixdate. Accepting the obsolete forms would
 * force a date parser into this module for no practical gain.
 */
export function isHttpDate(value) {
  if (typeof value !== 'string') return false;
  return IMF_FIXDATE.test(value);
}

/**
 * Formats a Date as an IMF-fixdate string in GMT. The Date object is read as
 * UTC, so the result does not depend on the host timezone. We format manually
 * rather than via toUTCString because toUTCString is allowed to produce
 * "GMT" or "UTC" depending on the engine, and we need a stable contract.
 */
export function formatHttpDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('formatHttpDate expects a valid Date');
  }
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  return (
    days[date.getUTCDay()] +
    ', ' +
    pad(date.getUTCDate()) +
    ' ' +
    months[date.getUTCMonth()] +
    ' ' +
    date.getUTCFullYear() +
    ' ' +
    pad(date.getUTCHours()) +
    ':' +
    pad(date.getUTCMinutes()) +
    ':' +
    pad(date.getUTCSeconds()) +
    ' GMT'
  );
}

/**
 * Parses a single If-Range header value.
 *
 * The header is either an entity-tag or an HTTP-date. We return a tagged
 * object so callers can branch without re-checking the string. The decision
 * to reject ambiguous values (e.g. a date followed by junk) is deliberate:
 * a range server that guesses on malformed If-Range can serve the wrong bytes.
 *
 * @param {string} value raw header value, as received on the wire
 * @returns {{kind: 'entity-tag', value: string, weak: boolean, opaque: string}
 *          | {kind: 'http-date', value: string, date: Date}
 *          | {kind: 'invalid', value: string, reason: string}}
 */
export function parseIfRange(value) {
  if (typeof value !== 'string') {
    return { kind: 'invalid', value: String(value), reason: 'not-a-string' };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { kind: 'invalid', value, reason: 'empty' };
  }
  if (isEntityTag(trimmed)) {
    const weak = trimmed.startsWith('W/');
    const opaque = trimmed.slice(weak ? 3 : 1, -1);
    return { kind: 'entity-tag', value: trimmed, weak, opaque };
  }
  if (isHttpDate(trimmed)) {
    const date = new Date(trimmed);
    // The regex already constrains the shape; a NaN here would mean the
    // engine's Date parser disagrees with IMF-fixdate, which we treat as
    // invalid rather than silently returning a bad Date.
    if (Number.isNaN(date.getTime())) {
      return { kind: 'invalid', value, reason: 'unparseable-date' };
    }
    return { kind: 'http-date', value: trimmed, date };
  }
  return { kind: 'invalid', value, reason: 'not-tag-or-date' };
}
