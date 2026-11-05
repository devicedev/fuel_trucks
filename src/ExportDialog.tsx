import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {CloseIcon} from './CloseIcon';
import {PeriodPicker} from './PeriodPicker';
import {displayDate, moscowToday} from './dates';
import {ExportApiError, exportApi, exportRangeError, isExportRunning, startExport} from './export-client';
import type {ExportFilters, ExportJob, ExportRange} from './export-client';
import type {SourceOption} from './source-filters';
import './export.css';

const STORAGE_KEY = 'fuel-trucks-export-job';
function rememberedJob(): string | null {
  try {const value = sessionStorage.getItem(STORAGE_KEY); return value && /^[a-f0-9]{32}$/.test(value) ? value : null;}
  catch {return null;}
}
function remember(id: string | null) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  }
  catch {/* Export also works when browser storage is unavailable. */}
}

export function ExportDialog({open, from, to, filters, sources, onClose, onBusyChange}: {
  open: boolean; from: string; to: string; filters: ExportFilters; sources: SourceOption[];
  onClose: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selectedRange, setSelectedRange] = useState<ExportRange | null>(null);
  const [jobId, setJobId] = useState<string | null>(rememberedJob);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [starting, setStarting] = useState(false), [error, setError] = useState('');
  const [scope, setScope] = useState('Фильтры, выбранные при запуске');
  const outside = useRef(false);
  const today = moscowToday();
  const range = selectedRange || {from, to};
  const validation = exportRangeError(range, today);
  const busy = starting || isExportRunning(job) || !!jobId && !job;
  const modeLabel = filters.mode === 'truck' ? 'Бензовозы' : filters.mode === 'warehouse' ? 'Склады / АЗС' : 'Все источники выдачи';
  const summary = [modeLabel, filters.farms.join(', ') || 'Все хозяйства', filters.source_ids.length
    ? sources.length ? filters.source_ids.map(id => sources.find(source => source.id === id)?.name || 'Выбранный источник').join(', ')
      : `Выбрано источников: ${filters.source_ids.length}`
    : 'Все источники'].join(' · ');

  useLayoutEffect(() => {
    if (open) {if (!dialog.current?.open) dialog.current?.showModal();}
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {onBusyChange(busy);}, [busy, onBusyChange]);

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await exportApi('/' + jobId, {signal: controller.signal});
        if (controller.signal.aborted) return;
        setJob(next); setError('');
        if (isExportRunning(next)) timer = setTimeout(() => void poll(), 2000);
        else if (next.state !== 'ready') remember(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ExportApiError && [404, 410].includes(err.status)) {
          remember(null); setJobId(null); setJob(null);
          setError(err.message);
        } else {
          setError('Связь с сервером прервалась. Продолжаем проверять готовность файла.');
          timer = setTimeout(() => void poll(), 5000);
        }
      }
    }
    void poll();
    return () => {controller.abort(); clearTimeout(timer);};
  }, [jobId]);

  async function begin() {
    if (busy || validation) return;
    setStarting(true); setError(''); setScope(summary);
    try {
      const next = await startExport(range, filters);
      remember(next.id); setJob(next); setJobId(next.id);
    } catch (err) {setError(err instanceof Error ? err.message : 'Не удалось начать выгрузку.');}
    finally {setStarting(false);}
  }
  async function cancel() {
    if (!jobId) return;
    try {setJob(await exportApi('/' + jobId, {method: 'DELETE'}));}
    catch (err) {setError(err instanceof Error ? err.message : 'Не удалось отменить выгрузку.');}
  }
  function reset() {remember(null); setJobId(null); setJob(null); setError(''); setSelectedRange(null);}
  const percent = job?.state === 'ready' ? 100 : job?.months_total
    ? Math.min(99, Math.round(job.months_done / job.months_total * 100)) : undefined;
  function backdrop(event: {target: EventTarget; currentTarget: HTMLDialogElement; clientX: number; clientY: number}) {
    const box = event.currentTarget.getBoundingClientRect();
    return event.target === event.currentTarget && (event.clientX < box.left || event.clientX >= box.right
      || event.clientY < box.top || event.clientY >= box.bottom);
  }
  return <dialog className="export-dialog" ref={dialog} aria-label="Выгрузить Excel"
    onCancel={event => {event.preventDefault(); onClose();}}
    onPointerDown={event => {outside.current = event.button === 0 && backdrop(event);}}
    onPointerCancel={() => {outside.current = false;}}
    onClick={event => {if (outside.current && backdrop(event)) onClose(); outside.current = false;}}>
    <div className="dialog-heading"><div><p className="eyebrow">ВЫГРУЗКА ДАННЫХ</p><h2>Выгрузить Excel</h2>
      <p>За выбранный период, год или всё время</p></div>
      <button type="button" className="close" aria-label="Закрыть выгрузку" onClick={onClose}><CloseIcon/></button></div>
    <div className="export-body">
      {!job && !jobId && <form id="fuel-export-form" onSubmit={event => {event.preventDefault(); void begin();}}>
        <PeriodPicker from={range.from || from} to={range.to} allTime={!!range.all_time} variant="export" disabled={starting}
          onApply={(start, end, allTime) => {
            setSelectedRange(allTime ? {all_time: true, to: end} : {from: start, to: end}); setError('');
          }}/>
        {range.all_time && <p className="export-period">С начала доступной истории — {displayDate(range.to)}</p>}
        <div className="export-scope"><span>Хозяйства и источники</span><p>{summary}</p></div>
        <p className="export-help">Большая выгрузка может занять несколько минут. Окно можно закрыть — подготовка продолжится.</p>
        {validation && <p className="export-error" role="alert">{validation}</p>}
      </form>}
      {(job || jobId) && <section className="export-progress" aria-label="Состояние выгрузки" aria-busy={busy}>
        <div className="export-progress-heading"><strong role="status">{job?.message || 'Проверяем состояние выгрузки'}</strong>
          {percent !== undefined && <span>{percent}%</span>}</div>
        {job?.state !== 'failed' && job?.state !== 'cancelled' && <progress max={100} value={percent} aria-label="Готовность Excel"/>}
        {job?.from && <p>{displayDate(job.from)} — {displayDate(job.to)}</p>}
        <p className="export-scope-text">{scope}</p>
        {!!job?.months_total && <p>Периодов обработано: {job.months_done} из {job.months_total} · Строк в Excel: {job.rows.toLocaleString('ru-RU')}</p>}
        {job?.state === 'failed' && <p className="export-error" role="alert">{job.message}</p>}
        {job?.state === 'ready' && <p>Нажмите «Скачать Excel», чтобы сохранить файл. Он доступен в течение суток.</p>}
        {busy && <p className="export-help">Подготовка продолжится, если закрыть это окно или обновить страницу.</p>}
      </section>}
      {error && <p className="export-error" role="alert">{error}</p>}
    </div>
    <div className="export-actions">
      {busy && job && <button className="export-secondary" type="button" disabled={job.state === 'cancelling'} onClick={() => void cancel()}>Отменить выгрузку</button>}
      {!busy && job && <button className="export-secondary" type="button" onClick={reset}>Новая выгрузка</button>}
      {!job && !jobId && <button className="refresh" type="submit" form="fuel-export-form" disabled={starting || !!validation}>{starting ? 'Запускаем…' : 'Сформировать Excel'}</button>}
      {job?.state === 'ready' && <a className="refresh export-download" href={job.download_url} target="_blank" rel="noopener">Скачать Excel</a>}
      {(busy || !!job) && <button className="export-secondary" type="button" onClick={onClose}>Закрыть</button>}
    </div>
  </dialog>;
}
