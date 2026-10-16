import type {SourceOption, SourceMode} from './source-filters';

export function readReportUrl(search: string) {
  const params = new URLSearchParams(search);
  const value = params.get('mode');
  return {
    mode: (value === 'truck' || value === 'warehouse' ? value : 'all') as SourceMode,
    farms: [...new Set(params.getAll('farm').filter(Boolean))],
    sources: [...new Set((params.has('source_id') ? params.getAll('source_id') : params.getAll('source')).filter(Boolean))],
  };
}

export function resolveUrlSources(selected: string[], catalog: SourceOption[]): string[] {
  return [...new Set(selected.map(value => catalog.find(s => s.id === value)?.id
    ?? catalog.find(s => s.name === value)?.id ?? value))];
}

export function writeReportUrl(search: string, from: string, to: string, mode: SourceMode, farms: string[], selected: string[], catalog: SourceOption[]): string {
  const params = new URLSearchParams(search);
  for (const key of ['from', 'to', 'mode', 'farm', 'source', 'source_id']) params.delete(key);
  params.set('from', from); params.set('to', to);
  if (mode !== 'all') params.set('mode', mode);
  for (const farm of farms) params.append('farm', farm);
  for (const id of selected) {
    params.append('source_id', id);
    const source = catalog.find(s => s.id === id);
    if (source) params.append('source', source.name);
  }
  return params.toString();
}
