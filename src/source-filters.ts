export type SourceOption = {id: string; name: string; farm: string | null; kind: 'truck' | 'warehouse'};
export type SourceMode = 'truck' | 'warehouse' | 'all';

export function availableSources(sources: SourceOption[], mode: SourceMode, farms: string[]): SourceOption[] {
  return sources.filter(source => (mode === 'all' || source.kind === mode)
    && (!farms.length || (source.farm !== null && farms.includes(source.farm))))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function retainAvailable(selected: string[], sources: SourceOption[]): string[] {
  const ids = new Set(sources.map(source => source.id));
  return selected.filter(id => ids.has(id));
}
