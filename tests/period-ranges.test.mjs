import {test} from 'node:test';
import assert from 'node:assert/strict';
import {periodRange} from '../src/period-ranges.ts';
test('today and seven days use inclusive Moscow dates',()=>{
 assert.deepEqual(periodRange('today','2026-09-24'),{from:'2026-09-24',to:'2026-09-24'});
 assert.deepEqual(periodRange('seven','2026-01-03'),{from:'2025-12-28',to:'2026-01-03'});
});
test('months, quarters and year clip to today without future dates',()=>{
 assert.deepEqual(periodRange('month','2026-09-24',2026,9),{from:'2026-09-01',to:'2026-09-24'});
 assert.deepEqual(periodRange('quarter','2026-09-24',2026,3),{from:'2026-07-01',to:'2026-09-24'});
 assert.deepEqual(periodRange('quarter','2026-09-24',2026,2),{from:'2026-04-01',to:'2026-06-30'});
 assert.deepEqual(periodRange('year','2026-09-24',2026),{from:'2026-01-01',to:'2026-09-24'});
});
test('leap month and full leap year remain selectable',()=>{
 assert.deepEqual(periodRange('month','2026-09-24',2024,2),{from:'2024-02-01',to:'2024-02-29'});
 assert.deepEqual(periodRange('year','2026-09-24',2024),{from:'2024-01-01',to:'2024-12-31'});
});
