import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseDate, shiftDays, shiftMonths, dayCount, periodError, inputDate, displayDate, formatDateInput, moscowToday} from '../src/dates.ts';

test('strict dates reject rollovers and malformed input', () => {
  for (const value of ['', '2026-02-29', '2026-02-31', '2026-13-01', '2026-9-01', 'not-a-date']) assert.equal(parseDate(value), null);
  assert.ok(parseDate('2024-02-29'));
});
test('inclusive 366-day boundary and invalid intervals match report limits', () => {
  const today = '2026-09-23';
  assert.equal(periodError('2026-08-24', today, today), '');
  assert.equal(dayCount('2026-08-24', today), 31);
  assert.equal(periodError('2024-01-01','2024-12-31',today),'');
  assert.match(periodError('2024-01-01','2025-01-01',today), /366/);
  assert.match(periodError('2026-09-20', '2026-09-19', today), /раньше/);
  assert.match(periodError(today, '2026-09-24', today), /Будущие/);
  assert.match(periodError('1999-12-31', '2000-01-01', today), /2000/);
  assert.equal(dayCount(today, today), 1);
});
test('calendar navigation clamps month-end and crosses leap years correctly', () => {
  assert.equal(shiftMonths('2026-03-31', -1), '2026-02-28');
  assert.equal(shiftMonths('2024-02-29', 12), '2025-02-28');
  assert.equal(shiftMonths('2026-01-31', -1), '2025-12-31');
  assert.equal(shiftDays('2024-03-01', -1), '2024-02-29');
  assert.equal(shiftDays('2026-01-01', -1), '2025-12-31');
});
test('manual date format and display round trip', () => {
  assert.equal(formatDateInput('01092026'), '01.09.2026');
  assert.equal(formatDateInput('01.09.2026'), '01.09.2026');
  assert.equal(formatDateInput('010'), '01.0');
  assert.equal(inputDate('01.09.2026'), '2026-09-01');
  assert.equal(displayDate(inputDate('01.09.2026')), '01.09.2026');
  assert.equal(inputDate('1.9.2026'), '');
  assert.equal(displayDate('2026-02-31'), '');
});
test('Moscow day is independent from browser or machine timezone', t => {
  t.mock.timers.enable({apis: ['Date'], now: Date.parse('2026-09-22T21:30:00Z')});
  assert.equal(moscowToday(), '2026-09-23');
});
