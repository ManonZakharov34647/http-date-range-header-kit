# http-date-range-header-kit

Parses and validates HTTP `If-Range` header values, telling an entity-tag apart from an HTTP-date without pulling in a full HTTP stack.

```js
import { parseIfRange, formatHttpDate, isEntityTag, isHttpDate } from 'http-date-range-header-kit';

const tag = parseIfRange('W/"v1"');
// { kind: 'entity-tag', value: 'W/"v1"', weak: true, opaque: 'v1' }

const date = parseIfRange(formatHttpDate(new Date(Date.UTC(2024, 0, 2, 3, 4, 5))));
// { kind: 'http-date', value: 'Tue, 02 Jan 2024 03:04:05 GMT', date: 2024-01-02T03:04:05.000Z }

const bad = parseIfRange('Tue, 02 Jan 2024 03:04:05 GMT extra');
// { kind: 'invalid', value: 'Tue, 02 Jan 2024 03:04:05 GMT extra', reason: 'not-tag-or-date' }

isEntityTag('"v1"'); // true
isHttpDate('Tue, 02 Jan 2024 03:04:05 GMT'); // true
```

## Why this exists

A range server receiving `If-Range` has to answer one question before it can send a `206`: is the client holding the same representation it thinks it is? The header is a union of two grammars — an entity-tag (`"v1"` or `W/"v1"`) or an HTTP-date — and the two are easy to confuse because both are just strings on the wire. Guessing wrong means serving a partial body against a stale validator.

The trade-off is strictness. This library accepts only IMF-fixdate (`Tue, 02 Jan 2024 03:04:05 GMT`) and rejects the obsolete RFC 850 and asctime forms (`Tuesday, 02-Jan-24 03:04:05 GMT`, `Tue Jan  2 03:04:05 2024`). Those forms are legal in the older HTTP/1.0 grammar but no deployed origin emits them, and accepting them would drag a full date parser into a module whose whole point is deciding which of two shapes a value has. If you need them, parse before calling in.

The awkward edge you will hit: `parseIfRange` returns a tagged union, so `result.date` only exists when `result.kind === 'http-date'` and `result.opaque` only exists when `result.kind === 'entity-tag'`. There is no single object with both fields set to `undefined`; branch on `kind` first.

## API

- `parseIfRange(value)` → `{ kind: 'entity-tag', value, weak, opaque }` | `{ kind: 'http-date', value, date }` | `{ kind: 'invalid', value, reason }`
- `formatHttpDate(date)` → IMF-fixdate string; throws `TypeError` on an invalid `Date`.
- `isEntityTag(value)` → boolean
- `isHttpDate(value)` → boolean
