import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {MouseEvent as ReactMouseEvent,PointerEvent as ReactPointerEvent} from 'react';
import './style.css';
import {PeriodPicker} from './PeriodPicker';
import {ExportDialog} from './ExportDialog';
import {moscowToday, periodError} from './dates';
import {availableSources, retainAvailable} from './source-filters';
import type {SourceOption} from './source-filters';
import {readReportUrl, resolveUrlSources, writeReportUrl} from './report-url';
import {CloseIcon} from './CloseIcon';
import {MatchingDialog} from './MatchingDialog';
import {EventAssignmentEditor} from './EventAssignmentEditor';
import type {WialonIssue} from './EventAssignmentEditor';
import {RecipientComparisons} from './RecipientComparison';
import type {RecipientComparison} from './RecipientComparison';
import {documentStatus, enteredDocuments} from './document-status';

type Detail={document:string;document_type:string;document_date:string|null;recipient:string;liters:string;posted:boolean|null};
type WialonDetail=WialonIssue;
type Row={recipient_comparisons?:RecipientComparison[];wialon_details:WialonDetail[];id:string;date:string;farm:string;farms:string[];truck_id:string;truck:string;source_kind:'truck'|'warehouse';count:number|null;meter_liters:string|null;onec_liters:string|null;difference:string|null;unposted_count:number;unposted_liters:string;documents:string[];details:Detail[];supplier_names:string[];mapped:boolean;ambiguous_farm:boolean};
type Report={rows:Row[];errors:string[];from:string;to:string;loaded_at:string;sources:{onec:boolean;wialon:boolean};farms:string[];trucks:SourceOption[]};
const formatter=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
const liters=(value:string|number|null)=>value===null?'—':formatter.format(Number(value));
const humanDate=(value:string)=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value+'T12:00:00'));
function Icon({type}:{type:'truck'|'download'|'chevron'}){return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{type==='truck'?<><path d="M3 6h11v11H3zM14 10h4l3 4v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>:type==='download'?<><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></>:<path d="m8 10 4 4 4-4"/>}</svg>}

function MultiSelect({label,options,selected,setSelected,allLabel}:{label:string;options:{id:string;name:string}[];selected:string[];setSelected:(v:string[])=>void;allLabel:string}){
  const [search,setSearch]=useState('');const root=useRef<HTMLDetailsElement>(null);
  useEffect(()=>{const close=(e:PointerEvent)=>{if(root.current&&!root.current.contains(e.target as Node))root.current.open=false;};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
  return <div className="filter"><span className="filter-label">{label}</span><details className="select" ref={root} onKeyDown={e=>{if(e.key==='Escape'&&root.current){root.current.open=false;root.current.querySelector('summary')?.focus();}}}>
    <summary aria-label={label}><span>{selected.length===0?allLabel:selected.length===1?(options.find(o=>o.id===selected[0])?.name??'Выбран 1'): `Выбрано: ${selected.length}`}</span><Icon type="chevron"/></summary>
    <div className="select-menu"><input type="search" aria-label={`Поиск: ${label}`} placeholder="Найти в списке" value={search} onChange={e=>setSearch(e.target.value)}/><button type="button" className="select-all" onClick={()=>setSelected([])}>Выбрать все</button><div className="select-options">
      {options.filter(o=>o.name.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).map(o=><label key={o.id}><input type="checkbox" checked={selected.includes(o.id)} onChange={e=>setSelected(e.target.checked?[...selected,o.id]:selected.filter(id=>id!==o.id))}/><span>{o.name}</span></label>)}
      {!options.length&&<p>Нет доступных источников для выбранных условий</p>}</div></div></details></div>;
}

function isBackdrop(event: ReactMouseEvent<HTMLDialogElement>|ReactPointerEvent<HTMLDialogElement>){
  if(event.target!==event.currentTarget)return false;
  const box=event.currentTarget.getBoundingClientRect();
  return event.clientX<box.left||event.clientX>=box.right||event.clientY<box.top||event.clientY>=box.bottom;
}

function App(){
  const backdropStart=useRef<HTMLDialogElement|null>(null);
  const backdropEvents=(close:()=>void)=>({
    onPointerDown:(event:ReactPointerEvent<HTMLDialogElement>)=>{backdropStart.current=event.button===0&&isBackdrop(event)?event.currentTarget:null;},
    onPointerCancel:()=>{backdropStart.current=null;},
    onClick:(event:ReactMouseEvent<HTMLDialogElement>)=>{const started=backdropStart.current===event.currentTarget;backdropStart.current=null;if(started&&isBackdrop(event))close();},
  });
  const params=new URLSearchParams(location.search);const [from,setFrom]=useState(params.get('from')||moscowToday());const [to,setTo]=useState(params.get('to')||params.get('from')||moscowToday());
  const initialFilters=useRef(readReportUrl(location.search));
  const [farms,setFarms]=useState<string[]>(initialFilters.current.farms);const [trucks,setTrucks]=useState<string[]>(initialFilters.current.sources);
  const [mode,setMode]=useState<'truck'|'warehouse'|'all'>(initialFilters.current.mode);
  const [mappingOpen,setMappingOpen]=useState(false);
  const [exporting,setExporting]=useState(false);const [exportOpen,setExportOpen]=useState(false);
  const [report,setReport]=useState<Report|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [selected,setSelected]=useState<Row|null>(null);
  const [assignIndex,setAssignIndex]=useState<number|null>(null);
  const [detailSource,setDetailSource]=useState<'onec'|'wialon'|'comparison'>('comparison');
  const showDetails=(row:Row)=>{setAssignIndex(null);setDetailSource('comparison');setSelected(row);};
  const active=useRef<AbortController|null>(null);const sequence=useRef(0);const dialog=useRef<HTMLDialogElement>(null);
  async function load(queryFrom=from,queryTo=to,propagate=false){
    const validation=periodError(queryFrom,queryTo);if(validation){setError(validation);return;}
    active.current?.abort();const controller=new AbortController();active.current=controller;const id=++sequence.current;
    setLoading(true);setError('');setReport(null);
    try{const response=await fetch(`/api/fuel-trucks/v1/report?${new URLSearchParams({from:queryFrom,to:queryTo})}`,{signal:controller.signal,cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.message||'Не удалось загрузить отчёт');if(id===sequence.current){setReport(data);setSelected(previous=>previous?data.rows.find((row:Row)=>row.id===previous.id)??null:null);setTrucks(previous=>resolveUrlSources(previous,data.trucks));}}
    catch(e){if(propagate)throw new Error('Назначение сохранено, но отчёт не обновился. Закройте окно и обновите страницу.');if(id===sequence.current&&!(e instanceof DOMException&&e.name==='AbortError'))setError(e instanceof Error?e.message:'Ошибка соединения');}
    finally{if(id===sequence.current)setLoading(false);}
  }
  useEffect(()=>{void load();return()=>active.current?.abort();},[]);
  useLayoutEffect(()=>{if(selected){if(!dialog.current?.open)dialog.current?.showModal();}else{dialog.current?.close();}},[selected]);
  useEffect(()=>{if(!report)return;const query=writeReportUrl(location.search,from,to,mode,farms,trucks,report.trucks);history.replaceState(null,'',`${location.pathname}?${query}${location.hash}`);},[from,to,mode,farms,trucks,report]);
  const modeRows=useMemo(()=>report?.rows.filter(r=>mode==='all'||r.source_kind===mode)??[],[report,mode]);
  const modeFarms=report?.farms??[];
  const modeSources=useMemo(()=>availableSources(report?.trucks??[],mode,farms),[report,mode,farms]);
  const changeFarms=(next:string[])=>{setFarms(next);setTrucks(previous=>retainAvailable(previous,availableSources(report?.trucks??[],mode,next)));};
  const rows=useMemo(()=>modeRows.filter(r=>(!farms.length||r.farms.some(f=>farms.includes(f)))&&(!trucks.length||trucks.includes(r.truck_id))),[modeRows,farms,trucks]);
  const sum=(key:'meter_liters'|'onec_liters'|'difference')=>{const values=rows.map(r=>r[key]).filter(v=>v!==null);return values.length?values.reduce((a,v)=>a+Number(v),0):null;};

  return <><header className="topbar"><nav className="header-navigation" aria-label="Основная навигация"><a className="brand" href="/fuel-trucks/"><span className="brand-symbol"><Icon type="truck"/></span>DBAnalit<span className="brand-divider">/</span><span className="section-name">Бензовозы</span></a><a className="home-link" href="/hub">Главная</a></nav><span className="top-caption">Контроль топлива</span></header>
  <main id="main-content" tabIndex={-1}><h1 className="sr-only">Бензовозы — выдача топлива</h1>
  <p className="sr-only" role="status">{loading?'Загрузка отчёта':report?`Отчёт загружен. Строк: ${rows.length}`:''}</p>
  <form className="filters" aria-label="Фильтры отчёта" onSubmit={e=>e.preventDefault()}>
    <PeriodPicker from={from} to={to} onApply={(a,b)=>{setFrom(a);setTo(b);void load(a,b);}}/>
    <MultiSelect label="Хозяйство" allLabel="Все хозяйства" options={modeFarms.map(f=>({id:f,name:f}))} selected={farms} setSelected={changeFarms}/>
    <MultiSelect label="Источник выдачи" allLabel={mode==='truck'?'Все бензовозы':mode==='warehouse'?'Все склады / АЗС':'Все источники'} options={modeSources} selected={trucks} setSelected={setTrucks}/>
    <button className="refresh" type="button" onClick={()=>setExportOpen(true)} aria-busy={exporting} title="Выгрузить выбранный период, год или всё время">{exporting?<svg className="export-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" opacity=".3"/><path d="M12 4a8 8 0 0 1 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>:<Icon type="download"/>}{exporting?'Excel готовится…':'Выгрузить Excel'}</button>
  </form>
  <div className="source-modes" role="group" aria-label="Тип источника выдачи">
    {([['all','Все'],['truck','Бензовозы'],['warehouse','Склады / АЗС']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={mode===value} onClick={()=>{setMode(value);setTrucks([]);}}>{label}</button>)}
    <span>{mode==='warehouse'?'Выдача со складов по данным 1С':mode==='all'?'Бензовозы и стационарные источники выдачи':'Сверка выдачи бензовозов с Wialon'}</span>
    <button type="button" className="mapping-button" onClick={()=>setMappingOpen(true)}>Сопоставление</button>
  </div>
  {error&&<div className="error" role="alert"><strong>Не удалось загрузить данные</strong><p>{error}</p><button onClick={()=>void load()}>Повторить</button></div>}
  {!!report?.errors.length&&<div className="warning" role="alert"><strong>Отчёт загружен частично</strong><p>{report.errors.join(' ')}</p><span>Недоступные значения отмечены прочерком. Разница для них не рассчитывается.</span></div>}
  <section className="report" aria-label="Отчёт о выдаче дизельного топлива" aria-busy={loading}><div className="table-toolbar"><div><h2>Выдача топлива</h2><span className="row-count">{loading?'…':rows.length} строк</span>{report&&<span className="period-caption">{humanDate(report.from)}{report.from!==report.to?` — ${humanDate(report.to)}`:''}</span>}</div><span className="unit-label">Объём, л</span></div>
    <div className="table-scroll" tabIndex={0} aria-label="Таблица выдачи топлива, прокрутка по горизонтали"><table className="fuel-table"><colgroup><col className="col-date"/><col className="col-farm"/><col className="col-source"/><col className="col-count"/><col/><col/><col/></colgroup><thead><tr><th>Дата</th><th>Хозяйство</th><th>Источник выдачи</th><th className="number" title="Количество записей выдачи дизеля из 1С, включая непроведённые документы и проведённые путевые листы без бухгалтерских движений. Нажмите на строку для просмотра документов и выдач Wialon.">Кол-во заправок<br/>по данным 1С</th><th className="number">Выдано по данным<br/>счётчика</th><th className="number">Выдано по данным<br/>1С</th><th className="number difference-head">Разница<span>1С − счётчик</span></th></tr></thead>
    <tbody>{loading?Array.from({length:8},(_,i)=><tr className="skeleton-row" key={i}>{Array.from({length:7},(_,j)=><td key={j}><span className="skeleton"/></td>)}</tr>):rows.map(row=>{const entered=enteredDocuments(row.details);return <tr key={row.id} className={`report-row ${entered.count?'unposted':''}`} onClick={event=>{if(window.getSelection()?.toString())return;event.currentTarget.querySelector<HTMLButtonElement>('.row-open')?.focus();showDetails(row);}}>
      <td className="date-cell">{humanDate(row.date)}</td><td className="farm-cell">{row.farm}{row.ambiguous_farm&&<small>Несколько хозяйств — общий объём</small>}</td><td className="truck-cell"><button type="button" className="row-open" title={row.supplier_names.join('\n')} aria-haspopup="dialog" aria-label={`Детали выдачи ${row.truck} за ${humanDate(row.date)}, ${row.farm}`} onClick={event=>{event.stopPropagation();showDetails(row);}}>{row.truck}</button>{row.source_kind==='warehouse'&&<small>Склад / АЗС · {row.mapped?'1С + Wialon':'данные 1С'}</small>}{entered.count>0&&<span className="unposted-badge" title={`Документов без подтверждённого БУ: ${entered.count} · ${liters(entered.liters)} л`}>Занесены без БУ · {entered.count}</span>}</td>
      <td className="number">{row.count??'—'}</td>
      <td className={`number ${row.meter_liters===null?'missing':''}`}>{liters(row.meter_liters)}</td><td className="number">{liters(row.onec_liters)}</td><td className={`number difference ${row.difference!==null&&Number(row.difference)<0?'negative':''}`}>{row.difference!==null&&Number(row.difference)>0?'+':''}{liters(row.difference)}</td></tr>;})}</tbody>
    {!loading&&rows.length>0&&<tfoot><tr><th colSpan={3}>Сумма доступных данных</th><td className="number">{rows.some(r=>r.count!==null)?rows.reduce((n,r)=>n+(r.count??0),0):'—'}</td><td className="number">{liters(sum('meter_liters'))}</td><td className="number">{liters(sum('onec_liters'))}</td><td className="number" title="Сумма разниц только по строкам, где есть оба источника">{liters(sum('difference'))}</td></tr></tfoot>}</table></div>
    {!loading&&!rows.length&&<div className="empty" role="status"><Icon type="truck"/><h3>{error?'Данные недоступны':'Нет данных для выбранных условий'}</h3><p>{error?'Повторите загрузку, когда соединение восстановится.':'Выберите другой период или сбросьте фильтры.'}</p>{!!(farms.length||trucks.length)&&<button onClick={()=>{setFarms([]);setTrucks([]);}}>Сбросить фильтры</button>}</div>}
    </section>

  </main>
  <dialog ref={dialog} {...backdropEvents(()=>setSelected(null))} aria-label="Детали выдачи топлива" onCancel={event=>{event.preventDefault();setSelected(null);}} onClose={()=>{if(!dialog.current?.open)setSelected(null);}}><div className="dialog-heading"><div><p className="eyebrow">ДЕТАЛИ ВЫДАЧИ ТОПЛИВА</p><h2>{selected?.truck}</h2><p>{selected&&humanDate(selected.date)} · {selected?.farm}</p></div><button className="close" aria-label="Закрыть детализацию" onClick={()=>setSelected(null)}><CloseIcon/></button></div><div className="source-modes" role="group" aria-label="Источник детализации"><button type="button" aria-pressed={detailSource==='comparison'} onClick={()=>setDetailSource('comparison')}>Сверка получателей</button><button type="button" aria-pressed={detailSource==='onec'} onClick={()=>setDetailSource('onec')}>Документы 1С · {selected?.details.length??0}</button><button type="button" aria-pressed={detailSource==='wialon'} onClick={()=>setDetailSource('wialon')}>Выдачи Wialon · {selected?.wialon_details?.length??0}</button></div>
  {detailSource==='comparison'?<><RecipientComparisons rows={selected?.recipient_comparisons} events={selected?.wialon_details} onAssign={setAssignIndex}/>{assignIndex!==null&&selected?.wialon_details[assignIndex]&&<EventAssignmentEditor key={`${selected.id}:${assignIndex}`} event={selected.wialon_details[assignIndex]} sourceId={Number(selected.truck_id.slice(2))} onClose={()=>setAssignIndex(null)} onChanged={()=>load(from,to,true)}/>}</>:detailSource==='onec'?<>{!selected?.details.length&&<p className="document-note">Документов выдачи 1С за этот день нет.</p>}<div className="detail-scroll"><table><thead><tr><th>Документ</th><th>Номер</th><th>Дата документа</th><th>Получатель</th><th className="number">Выдано, л</th><th>Статус</th></tr></thead><tbody>{selected?.details.map((d,i)=>{const status=documentStatus(d);return <tr key={i} className={status==='entered'?'unposted':''}><td>{d.document_type}</td><td className="document-number">{d.document}</td><td className="date-cell">{d.document_date?humanDate(d.document_date):'—'}</td><td>{d.recipient}</td><td className="number">{liters(d.liters)}</td><td><span className={status==='unknown'?'unknown-status':status==='posted'?'posted-status':'pending-status'}>{status==='posted'&&<span aria-hidden="true">✓ </span>}{status==='unknown'?'Статус недоступен':status==='posted'?'Проведён':'Занесён'}</span></td></tr>;})}</tbody></table></div><p className="document-note">Галочка означает проведение в БУ. «Занесён» — документ есть, проведение в БУ не подтверждено. Все выдачи включены в итог строки.</p></>:<>{!selected?.wialon_details?.length&&<p className="document-note">Нет доступных событий Wialon за этот день.</p>}<div className="detail-scroll"><table><thead><tr><th>Начало, МСК</th><th>Конец, МСК</th><th>Карточка получателя Wialon</th><th className="number">Выдано, л</th></tr></thead><tbody>{selected?.wialon_details?.map((d,i)=><tr key={i}><td>{new Date(d.started_at).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow'})}</td><td>{new Date(d.ended_at).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow'})}</td><td>{d.recipient}</td><td className="number">{liters(d.liters)}</td></tr>)}</tbody></table></div><p className="document-note">Показаны все события, включая выдачи без карточки получателя. Они уже учтены в объёме счётчика. Карточка Wialon не является подтверждённым сопоставлением с получателем 1С.</p></>}
  </dialog>
  <ExportDialog open={exportOpen} from={from} to={to} filters={{mode,farms,source_ids:trucks}} sources={report?.trucks??[]} onClose={()=>setExportOpen(false)} onBusyChange={setExporting}/>
  <MatchingDialog open={mappingOpen} onClose={()=>setMappingOpen(false)} onChanged={()=>void load()}/>
  </>;
}
createRoot(document.getElementById('root')!).render(<App/>);
