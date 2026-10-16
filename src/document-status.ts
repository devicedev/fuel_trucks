type DocumentStatusInput = {document: string; document_type: string; document_date: string | null; posted: boolean | null; liters: string};

export function documentStatus(document: DocumentStatusInput): 'posted' | 'entered' | 'unknown' {
  if (document.posted === null) return 'unknown';
  // Only waybill status is sourced from the verified BU checkbox.
  // Other document types still expose the platform _Posted flag.
  return document.document_type.startsWith('Путевой лист') && document.posted ? 'posted' : 'entered';
}

export function enteredDocuments(documents: DocumentStatusInput[]) {
  const entered = documents.filter(document => documentStatus(document) === 'entered');
  return {
    count: new Set(entered.map(d => JSON.stringify([d.document_type, d.document, d.document_date]))).size,
    liters: entered.reduce((sum, d) => sum + Number(d.liters), 0),
  };
}
