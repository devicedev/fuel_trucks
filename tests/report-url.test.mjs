import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readReportUrl, resolveUrlSources, writeReportUrl} from '../src/report-url.ts';
const catalog = [
  {id:'w:1',name:'Р432СТ',farm:'ОП Пензенское',kind:'truck'},
  {id:'c:2',name:'Склад №5 (Каменка) & ГСМ',farm:'ОП Кузнецкое',kind:'warehouse'},
];
test('farm and multiple truck/warehouse names round trip with stable IDs', () => {
  const query = writeReportUrl('?extra=keep', '2026-09-01','2026-09-10','all',['ОП Пензенское','ОП Кузнецкое'],['w:1','c:2'],catalog);
  const restored = readReportUrl(query);
  assert.deepEqual(restored.farms,['ОП Пензенское','ОП Кузнецкое']);
  assert.deepEqual(restored.sources,['w:1','c:2']);
  assert.deepEqual(new URLSearchParams(query).getAll('source'),catalog.map(s=>s.name));
  assert.equal(new URLSearchParams(query).get('extra'),'keep');
});
test('legacy date-only links default to all; bad modes are ignored', () => {
  assert.deepEqual(readReportUrl('?from=2026-09-01&mode=bad'),{mode:'all',farms:[],sources:[]});
});
test('source IDs survive renaming; name-only links also resolve', () => {
  assert.deepEqual(resolveUrlSources(['w:1',catalog[1].name],catalog),['w:1','c:2']);
  assert.deepEqual(readReportUrl('?source=old&source_id=w%3A1').sources,['w:1']);
});
test('clearing filters removes old parameters and mode is restored', () => {
  const query=writeReportUrl('?farm=old&source=old&source_id=old','2026-09-01','2026-09-10','warehouse',[],[],catalog);
  assert.deepEqual(readReportUrl(query),{mode:'warehouse',farms:[],sources:[]});
});
