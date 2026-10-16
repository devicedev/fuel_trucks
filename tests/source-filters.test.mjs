import {test} from 'node:test';
import assert from 'node:assert/strict';
import {availableSources, retainAvailable} from '../src/source-filters.ts';

const sources = [
  {id: 'w:25983', name: 'Р432СТ', farm: 'ОП Пензенское', kind: 'truck'},
  {id: 'w:26021', name: 'Р136ЕТ', farm: 'ОП Наровчатское', kind: 'truck'},
  {id: 'c:1', name: 'Склад ГСМ с.Потодеево', farm: 'ОП Наровчатское', kind: 'warehouse'},
];
test('Penzenskoye contains only its confirmed tanker; no invented warehouse', () => {
  assert.deepEqual(availableSources(sources, 'all', ['ОП Пензенское']).map(s => s.id), ['w:25983']);
  assert.deepEqual(availableSources(sources, 'warehouse', ['ОП Пензенское']), []);
});
test('warehouse mode retains farm boundary; multiple farms take union', () => {
  assert.deepEqual(availableSources(sources, 'warehouse', ['ОП Наровчатское']).map(s => s.id), ['c:1']);
  assert.equal(availableSources(sources, 'all', ['ОП Наровчатское', 'ОП Пензенское']).length, 3);
  assert.equal(availableSources(sources, 'all', []).length, 3);
});
test('switching farm removes selected sources from another farm', () => {
  const allowed = availableSources(sources, 'all', ['ОП Пензенское']);
  assert.deepEqual(retainAvailable(['w:26021', 'w:25983', 'c:1'], allowed), ['w:25983']);
  assert.deepEqual(retainAvailable(['w:25983'], []), []);
});
