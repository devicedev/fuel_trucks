export type ExportRange = {from?: string; to: string; all_time?: boolean};
export type ExportFilters = {mode: 'all' | 'truck' | 'warehouse'; farms: string[]; source_ids: string[]};
export type ExportJob = {
  id: string; state: 'queued' | 'discovering' | 'loading' | 'writing' | 'ready' | 'failed' | 'cancelling' | 'cancelled';
  from: string | null; to: string; all_time: boolean; months_done: number; months_total: number | null;
  rows: number; message: string; download_url?: string; filename?: string;
};

export function exportRangeError(range: ExportRange, today: string): string {
  const valid = (value: string | undefined) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(range.to) || !range.all_time && !valid(range.from)) return 'Укажите начало и конец периода.';
  if (range.to > today || range.from && range.from > today) return 'Выберите даты не позже сегодняшнего дня.';
  if (range.from && range.from > range.to) return 'Конец периода должен быть не раньше начала.';
  if (range.to < '1970-01-01' || range.from && range.from < '1970-01-01') return 'Выберите даты начиная с 01.01.1970.';
  return '';
}

export function isExportRunning(job: ExportJob | null): boolean {
  return !!job && ['queued', 'discovering', 'loading', 'writing', 'cancelling'].includes(job.state);
}

export class ExportApiError extends Error {
  status: number;
  constructor(message: string, status: number) {super(message); this.status = status;}
}

export async function exportApi(path = '', options?: RequestInit): Promise<ExportJob> {
  const response = await fetch('/api/fuel-trucks/v1/exports' + path, {cache: 'no-store', ...options});
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.message || (response.status === 404 && !path
      ? 'Сервер пока не поддерживает эту выгрузку. Требуется обновление приложения.'
      : 'Не удалось связаться с сервером выгрузки.');
    throw new ExportApiError(message, response.status);
  }
  if (!data || typeof data.id !== 'string' || !/^[a-f0-9]{32}$/.test(data.id) || typeof data.state !== 'string') {
    throw new Error('Не удалось прочитать состояние выгрузки.');
  }
  return data;
}

export function startExport(range: ExportRange, filters: ExportFilters): Promise<ExportJob> {
  return exportApi('', {method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({...range, ...filters})});
}
