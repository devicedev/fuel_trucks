import {test} from 'node:test';
import assert from 'node:assert/strict';
import {documentStatus, enteredDocuments} from '../src/document-status.ts';
const document={document:'1',document_type:'Путевой лист сельхозтехники',document_date:'2026-09-07',posted:true,liters:'100'};
test('only verified BU checkbox produces conducted status',()=>{
  assert.equal(documentStatus(document),'posted');
  assert.equal(documentStatus({...document,document_type:'Путевой лист автомобиля'}),'posted');
  assert.equal(documentStatus({...document,posted:false}),'entered');
  assert.equal(documentStatus({...document,document_type:'Документ выдачи топлива'}),'entered');
});
test('missing status is never called conducted or entered',()=>{
  assert.equal(documentStatus({...document,posted:null}),'unknown');
});
test('badge counts documents while including both fuel lines',()=>{
  const rows=[{...document,posted:false,liters:'559'},{...document,posted:false,liters:'664'},document];
  assert.deepEqual(enteredDocuments(rows),{count:1,liters:1223});
});
test('same number in another document type is a different document',()=>{
  assert.equal(enteredDocuments([{...document,posted:false},{...document,document_type:'Документ выдачи топлива'}]).count,2);
});
