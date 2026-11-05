import assert from 'node:assert/strict';
import {test} from 'node:test';
import {exportRangeError, startExport, exportApi, ExportApiError, isExportRunning} from '../src/export-client.ts';

test('all-time asks the server to discover the beginning of history', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = JSON.parse(options.body);
    return Response.json({id: 'a'.repeat(32), state: 'queued'});
  });
  await startExport({all_time: true, to: '2026-11-05'}, {mode: 'all', farms: [], source_ids: []});
  assert.deepEqual(sent, {all_time: true, to: '2026-11-05', mode: 'all', farms: [], source_ids: []});
  assert.equal(exportRangeError(sent, '2026-11-05'), '');
});
test('custom export permits many years without relaxing date validity', () => {
  assert.equal(exportRangeError({from: '1995-01-01', to: '2026-11-05'}, '2026-11-05'), '');
  assert.equal(exportRangeError({from: '2024-01-01', to: '2024-12-31'}, '2026-11-05'), '');
  for (const range of [
    {from: '2026-02-30', to: '2026-03-01'}, {from: '2026-11-06', to: '2026-11-06'},
    {from: '2026-10-31', to: '2026-10-01'}, {from: '1969-01-01', to: '2026-01-01'},
  ]) assert.notEqual(exportRangeError(range, '2026-11-05'), '');
});
test('starting an export sends only dates and current filters, never report rows', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = {url, options, body: JSON.parse(options.body)};
    return Response.json({id: 'a'.repeat(32), state: 'queued'});
  });
  const filters = {mode: 'truck', farms: ['ОП Белынь'], source_ids: ['w:1']};
  await startExport({from: '2020-01-01', to: '2026-11-05'}, filters);
  assert.equal(sent.url, '/api/fuel-trucks/v1/exports');
  assert.equal(sent.options.method, 'POST');
  assert.deepEqual(sent.body, {from: '2020-01-01', to: '2026-11-05', ...filters});
  assert.ok(sent.options.body.length < 200);
  assert.equal('rows' in sent.body, false);
});
test('server errors retain their status so expired jobs can be cleared', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({message: 'Файл истёк'}, {status: 410}));
  await assert.rejects(exportApi('/' + 'a'.repeat(32)), error =>
    error instanceof ExportApiError && error.status === 410 && error.message === 'Файл истёк');
});
test('non-JSON error responses are shown as errors, not downloaded as workbooks', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Error</html>', {status: 500}));
  await assert.rejects(startExport({all_time: true, to: '2026-11-05'}, {mode: 'all', farms: [], source_ids: []}), ExportApiError);
});
test('progress stays busy until the workbook has actually been saved', () => {
  for (const state of ['queued', 'discovering', 'loading', 'writing', 'cancelling']) assert.ok(isExportRunning({state}));
  for (const state of ['ready', 'failed', 'cancelled']) assert.equal(isExportRunning({state}), false);
});
