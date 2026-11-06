import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIfRange, formatHttpDate, isHttpDate, isEntityTag } from '../src/index.js';

test('formatHttpDate produces an IMF-fixdate the regex accepts', () => {
  const d = new Date(Date.UTC(2024, 0, 2, 3, 4, 5));
  const s = formatHttpDate(d);
  assert.equal(s, 'Tue, 02 Jan 2024 03:04:05 GMT');
  assert.equal(isHttpDate(s), true);
});

test('formatHttpDate rejects an invalid Date', () => {
  assert.throws(() => formatHttpDate(new Date('not a date')), TypeError);
  assert.throws(() => formatHttpDate('2024-01-02'), TypeError);
});

test('isEntityTag accepts strong and weak tags', () => {
  assert.equal(isEntityTag('"abc"'), true);
  assert.equal(isEntityTag('W/"abc"'), true);
});

test('isEntityTag rejects malformed tags', () => {
  assert.equal(isEntityTag('abc'), false);
  assert.equal(isEntityTag('""'), false);
  assert.equal(isEntityTag('W/""'), false);
  assert.equal(isEntityTag('"abc'), false);
  assert.equal(isEntityTag('"abc"x'), false);
  assert.equal(isEntityTag('"a\u0000b"'), false);
});

test('isHttpDate accepts only IMF-fixdate', () => {
  assert.equal(isHttpDate('Tue, 02 Jan 2024 03:04:05 GMT'), true);
  assert.equal(isHttpDate('Tuesday, 02-Jan-24 03:04:05 GMT'), false);
  assert.equal(isHttpDate('Tue Jan  2 03:04:05 2024'), false);
  assert.equal(isHttpDate('Tue, 02 Jan 2024 03:04:05 UTC'), false);
});

test('parseIfRange classifies an entity-tag', () => {
  const r = parseIfRange('"v1"');
  assert.equal(r.kind, 'entity-tag');
  assert.equal(r.value, '"v1"');
  assert.equal(r.weak, false);
  assert.equal(r.opaque, 'v1');
});

test('parseIfRange classifies a weak entity-tag', () => {
  const r = parseIfRange('W/"v1"');
  assert.equal(r.kind, 'entity-tag');
  assert.equal(r.weak, true);
  assert.equal(r.opaque, 'v1');
});

test('parseIfRange classifies an HTTP-date and exposes a Date', () => {
  const r = parseIfRange('Tue, 02 Jan 2024 03:04:05 GMT');
  assert.equal(r.kind, 'http-date');
  assert.equal(r.value, 'Tue, 02 Jan 2024 03:04:05 GMT');
  assert.equal(r.date.getTime(), Date.UTC(2024, 0, 2, 3, 4, 5));
});

test('parseIfRange trims surrounding whitespace', () => {
  const r = parseIfRange('  "v1"  ');
  assert.equal(r.kind, 'entity-tag');
  assert.equal(r.value, '"v1"');
});

test('parseIfRange rejects empty and non-string input', () => {
  assert.equal(parseIfRange('').kind, 'invalid');
  assert.equal(parseIfRange('   ').kind, 'invalid');
  assert.equal(parseIfRange(42).kind, 'invalid');
});

test('parseIfRange rejects a date with trailing junk', () => {
  const r = parseIfRange('Tue, 02 Jan 2024 03:04:05 GMT extra');
  assert.equal(r.kind, 'invalid');
  assert.equal(r.reason, 'not-tag-or-date');
});

test('parseIfRange rejects a bare word', () => {
  const r = parseIfRange('not-a-tag');
  assert.equal(r.kind, 'invalid');
  assert.equal(r.reason, 'not-tag-or-date');
});
