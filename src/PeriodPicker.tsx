import {useId, useLayoutEffect, useRef, useState} from 'react';
import type {KeyboardEvent} from 'react';
import {dayCount, displayDate, formatDateInput, inputDate, MIN_DATE, moscowToday, parseDate, periodError, shiftDays, shiftMonths} from './dates';
import './period-picker.css';
import {CloseIcon} from './CloseIcon';
import {PERIOD_MODES, periodRange} from './period-ranges';
import type {PeriodMode} from './period-ranges';
import {exportRangeError} from './export-client';

type PickerMode = PeriodMode | 'all-time';

const weekdays = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const shortWeekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthLabel = (value: string) => new Intl.DateTimeFormat('ru-RU', {month: 'long', year: 'numeric', timeZone: 'UTC'}).format(parseDate(value)!);
const fullDate = (value: string) => new Intl.DateTimeFormat('ru-RU', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'}).format(parseDate(value)!);

function CalendarIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/></svg>;
}

export function PeriodPicker({from, to, onApply, variant = 'report', allTime = false, disabled = false}: {
  from: string; to: string; onApply: (from: string, to: string, allTime?: boolean) => void;
  variant?: 'report' | 'export'; allTime?: boolean; disabled?: boolean;
}) {
  const exportMode = variant === 'export';
  const minDate = exportMode ? '1970-01-01' : MIN_DATE;
  const minYear = Number(minDate.slice(0, 4));
  const modes: {value: PickerMode; label: string}[] = exportMode
    ? [...PERIOD_MODES, {value: 'all-time', label: 'За всё время'}] : PERIOD_MODES;
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusPending = useRef(false);
  const [open, setOpen] = useState(false);
  const [position,setPosition]=useState({left:0,top:0,width:352,maxHeight:560});
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [hovered,setHovered]=useState<string|null>(null);
  const [focused, setFocused] = useState(moscowToday);
  const [month, setMonth] = useState(() => moscowToday().slice(0, 7) + '-01');
  const today = moscowToday();
  const currentYear=Number(today.slice(0,4));
  const appliedMode=useRef<PickerMode>(allTime?'all-time':from===today&&to===today?'today':'custom');
  const [mode,setMode]=useState<PickerMode>(appliedMode.current);
  const [periodYear,setPeriodYear]=useState(currentYear);
  const [yearPage,setYearPage]=useState(Math.max(minYear,currentYear-11));
  const start = inputDate(startText), end = inputDate(endText);
  const validate = (a: string, b: string) => exportMode ? exportRangeError({from: a, to: b}, today) : periodError(a, b, today);
  const error = mode === 'all-time' ? '' : validate(start, end);
  const clamp = (value: string) => value < minDate ? minDate : value > today ? today : value;

  useLayoutEffect(() => {
    if (open) dialog.current?.showPopover();
    else if(dialog.current?.matches(':popover-open')) dialog.current.hidePopover();
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    if (focusPending.current) {
      dialog.current?.querySelector<HTMLButtonElement>(mode==='custom'?`[data-day="${focused}"]`:'[role="tab"][aria-selected="true"]')?.focus();
      focusPending.current = false;
    }
  }, [open, focused, month, mode]);

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const anchor=trigger.current!.getBoundingClientRect();
      const width=Math.min(352,document.documentElement.clientWidth-24);
      const height=dialog.current!.scrollHeight;
      const below=window.innerHeight-anchor.bottom-12;
      const above=anchor.top-12;
      const upwards=below<Math.min(height,320)&&above>below;
      const maxHeight=Math.max(120,Math.min(window.innerHeight-24,upwards?above:below));
      setPosition({left:Math.max(12,Math.min(anchor.left,document.documentElement.clientWidth-width-12)),top:Math.max(12,upwards?anchor.top-Math.min(height,maxHeight)-6:anchor.bottom+6),width,maxHeight});
    }
    place();
    window.addEventListener('resize',place);
    window.addEventListener('scroll',place,true);
    return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[open,month,error,mode,periodYear,yearPage]);

  function close() {setOpen(false);trigger.current?.focus();}

  function show() {
    setHovered(null);
    const initial = parseDate(from) ? clamp(from) : today;
    setMode(allTime ? 'all-time' : appliedMode.current === 'all-time' ? 'custom' : appliedMode.current);
    setPeriodYear(Number(initial.slice(0,4)));
    setYearPage(Math.max(minYear,Number(initial.slice(0,4))-11));
    setStartText(displayDate(from));
    setEndText(displayDate(to));
    setChoosingEnd(false);
    setFocused(initial);
    setMonth(initial.slice(0, 7) + '-01');
    focusPending.current = true;
    setOpen(true);
  }

  function move(value: string, focus = true) {
    setHovered(null);
    const next = clamp(value);
    focusPending.current = focus;
    setFocused(next);
    setMonth(next.slice(0, 7) + '-01');
  }

  function choose(value: string) {
    if (choosingEnd && parseDate(start)) {
      setStartText(displayDate(value < start ? value : start));
      setEndText(displayDate(value < start ? start : value));
      setChoosingEnd(false);
    } else {
      setStartText(displayDate(value));
      setEndText(displayDate(value));
      setChoosingEnd(true);
    }
    move(value);
  }

  function calendarKey(event: KeyboardEvent<HTMLButtonElement>, value: string) {
    const weekday = (parseDate(value)!.getUTCDay() + 6) % 7;
    const shifts: Record<string, number> = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday};
    if (event.key in shifts) {
      event.preventDefault();
      move(shiftDays(value, shifts[event.key]));
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      move(shiftMonths(value, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1)));
    }
  }

  function panelKey(event: KeyboardEvent<HTMLDivElement>) {
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    else if(event.key==='Enter'&&event.target instanceof HTMLInputElement){event.preventDefault();apply();}
  }

  function preset(a: string, b: string) {
    setStartText(displayDate(a)); setEndText(displayDate(b)); setChoosingEnd(false); move(a, false);
  }

  function apply() {
    if (error) return;
    appliedMode.current=mode;
    onApply(mode === 'all-time' ? '' : start, mode === 'all-time' ? today : end, mode === 'all-time');
    close();
  }

  function selectMode(next:PickerMode){
    setMode(next);
    if(next==='today'||next==='seven'){
      const range=periodRange(next,today);preset(range.from,range.to);
    }
  }
  function modeKey(event:KeyboardEvent<HTMLButtonElement>,index:number){
    const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3};
    if(!(event.key in offsets)&&event.key!=='Home'&&event.key!=='End')return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?modes.length-1:(index+offsets[event.key]+modes.length)%modes.length;
    selectMode(modes[next].value);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  function pickPeriod(kind:'month'|'quarter'|'year',year:number,index=1){
    const range=periodRange(kind,today,year,index);preset(range.from,range.to);
  }
  const periodOptions=mode==='month'?Array.from({length:12},(_,i)=>({
    label:new Intl.DateTimeFormat('ru-RU',{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(periodYear,i,1))).replace('.',''),
    index:i+1,year:periodYear,range:periodRange('month',today,periodYear,i+1),
  })):mode==='quarter'?['I','II','III','IV'].map((label,i)=>({label:`${label} квартал`,index:i+1,year:periodYear,range:periodRange('quarter',today,periodYear,i+1)})):
    Array.from({length:12},(_,i)=>({label:String(yearPage+i),index:1,year:yearPage+i,range:periodRange('year',today,yearPage+i)}));
  const offset = (parseDate(month)!.getUTCDay() + 6) % 7;
  const firstDay = shiftDays(month, -offset);
  const daysInMonth = parseDate(shiftDays(shiftMonths(month, 1), -1))!.getUTCDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const days = Array.from({length: weeks * 7}, (_, i) => shiftDays(firstDay, i));
  const previewEnd=choosingEnd?(hovered??focused):end;
  const rangeStart=choosingEnd&&previewEnd<start?previewEnd:start;
  const rangeEnd=choosingEnd&&previewEnd<start?start:previewEnd;
  const previewError=validate(rangeStart,rangeEnd);
  const summary = mode === 'all-time' ? `С начала доступной истории — ${displayDate(today)}`
    : !previewError ? `${displayDate(rangeStart)}${rangeStart !== rangeEnd ? ` — ${displayDate(rangeEnd)}` : ''} · Дней: ${dayCount(rangeStart, rangeEnd)}` : previewError;

  return <div className="period-filter" onBlur={event=>{if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}}>
    <span className="filter-label" id={`${id}-label`}>{exportMode ? 'Период выгрузки' : 'Период'}</span>
    <button type="button" className="period-trigger" ref={trigger} disabled={disabled} aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-dialog`} popoverTarget={`${id}-dialog`} onClick={event=>{event.preventDefault();if(open)close();else show();}}>
      <CalendarIcon/><span id={`${id}-value`}>{allTime ? 'За всё время' : displayDate(from) || 'Выбрать даты'}{!allTime && to !== from && displayDate(to) ? ` — ${displayDate(to)}` : ''}</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
    </button>
    <div id={`${id}-dialog`} ref={dialog} popover="auto" role="dialog" className="period-dialog" style={position} aria-labelledby={`${id}-title`} aria-describedby={`${id}-hint`} onKeyDown={panelKey} onToggle={event=>setOpen(event.currentTarget.matches(':popover-open'))}>
      <div className="period-heading"><div><h2 id={`${id}-title`}>Выберите период</h2><p id={`${id}-hint`}>{exportMode ? 'Любой период' : 'До 366 дней'} · московское время</p></div><button type="button" className="close" aria-label="Закрыть выбор периода" onClick={close}><CloseIcon/></button></div>
      <div className="period-body">
        <div className="period-modes" role="tablist" aria-label="Тип периода">{modes.map((item,index)=><button type="button" key={item.value} id={`${id}-tab-${item.value}`} className={item.value === 'all-time' ? 'period-all-time' : undefined} role="tab" tabIndex={mode===item.value?0:-1} aria-selected={mode===item.value} aria-controls={`${id}-panel`} onClick={()=>selectMode(item.value)} onKeyDown={event=>modeKey(event,index)}>{item.label}</button>)}</div>
        <div id={`${id}-panel`} role="tabpanel" tabIndex={mode==='today'||mode==='seven'?0:undefined} aria-labelledby={`${id}-tab-${mode}`}>
        {(mode==='today'||mode==='seven')&&<div className="period-quick-summary"><CalendarIcon/><strong>{mode==='today'?'Сегодня':'Последние 7 календарных дней'}</strong><span>{displayDate(start)}{start!==end?` — ${displayDate(end)}`:''}</span></div>}
        {mode==='all-time'&&<div className="period-quick-summary"><CalendarIcon/><strong>За всё время</strong><span>С начала доступной истории до {displayDate(today)}</span></div>}
        {(mode==='month'||mode==='quarter'||mode==='year')&&<div className="period-choice-panel">
          <div className="calendar-nav"><button type="button" aria-label={mode==='year'?'Предыдущие годы':'Предыдущий год'} disabled={(mode==='year'?yearPage:periodYear)<=minYear} onClick={()=>mode==='year'?setYearPage(value=>Math.max(minYear,value-12)):setPeriodYear(value=>Math.max(minYear,value-1))}>‹</button><h3 aria-live="polite">{mode==='year'?`${yearPage} — ${Math.min(yearPage+11,currentYear)}`:periodYear}</h3><button type="button" aria-label={mode==='year'?'Следующие годы':'Следующий год'} disabled={mode==='year'?yearPage+11>=currentYear:periodYear>=currentYear} onClick={()=>mode==='year'?setYearPage(value=>value+12):setPeriodYear(value=>value+1)}>›</button></div>
          <div className={`period-options ${mode==='quarter'?'quarters':''}`}>{periodOptions.map(option=><button type="button" key={option.label} disabled={option.range.from>today} aria-label={`${option.label}${mode==='year'?'':` ${periodYear}`}`} aria-pressed={start===option.range.from&&end===option.range.to} onClick={()=>pickPeriod(mode,option.year,option.index)}>{option.label}{mode==='quarter'&&<small>{option.range.from>today?'Ещё не начался':`${displayDate(option.range.from)} — ${displayDate(option.range.to)}`}</small>}</button>)}</div>
        </div>}
        {mode==='custom'&&<div className="period-calendar">

          <div className="period-fields">
            <label>Начало<input type="text" inputMode="numeric" autoComplete="off" placeholder="ДД.ММ.ГГГГ" maxLength={10} value={startText} aria-invalid={!!error} aria-describedby={`${id}-format ${id}-summary`} onChange={e => {setStartText(formatDateInput(e.target.value)); setChoosingEnd(false);const value=inputDate(formatDateInput(e.target.value));if(parseDate(value))move(value,false);}}/></label>
            <span aria-hidden="true">—</span>
            <label>Окончание<input type="text" inputMode="numeric" autoComplete="off" placeholder="ДД.ММ.ГГГГ" maxLength={10} value={endText} aria-invalid={!!error} aria-describedby={`${id}-format ${id}-summary`} onChange={e => {setEndText(formatDateInput(e.target.value)); setChoosingEnd(false);const value=inputDate(formatDateInput(e.target.value));if(parseDate(value))move(value,false);}}/></label>
          </div>
          <span id={`${id}-format`} className="sr-only">Формат даты: ДД.ММ.ГГГГ, например 01.09.2026.</span>
          <div className="calendar-nav"><button type="button" aria-label="Предыдущий месяц" disabled={month<=minDate} onClick={()=>move(shiftMonths(focused,-1))}>‹</button><h3 id={`${id}-month`} aria-live="polite" aria-atomic="true">{monthLabel(month)}</h3><button type="button" aria-label="Следующий месяц" disabled={month.slice(0,7)>=today.slice(0,7)} onClick={()=>move(shiftMonths(focused,1))}>›</button></div>
          <table className="calendar-grid" onMouseLeave={()=>setHovered(null)} role="grid" aria-multiselectable="true" aria-labelledby={`${id}-month`} aria-describedby={`${id}-keyboard`}>
            <thead><tr>{weekdays.map((day, i) => <th scope="col" abbr={day} key={day}>{shortWeekdays[i]}</th>)}</tr></thead>
            <tbody>{Array.from({length: weeks}, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map(day => {
              const inMonth = day.slice(0, 7) === month.slice(0, 7);
              const inRange = !!parseDate(rangeStart) && !!parseDate(rangeEnd) && day >= rangeStart && day <= rangeEnd;
              const endpoint = day === start || (!choosingEnd && day === end);
              return <td key={day} aria-selected={inRange} className={`${inRange ? 'in-range' : ''} ${day === rangeStart ? 'range-start' : ''} ${day === rangeEnd ? 'range-end' : ''}`}><button type="button" data-day={day} disabled={day < minDate || day > today} tabIndex={day === focused ? 0 : -1} aria-label={`${fullDate(day)}${day === start ? ', начало периода' : ''}${day === end ? ', окончание периода' : ''}`} aria-current={day === today ? 'date' : undefined} className={`${!inMonth ? 'other-month' : ''} ${endpoint ? 'range-endpoint' : ''}`} onMouseEnter={()=>{if(choosingEnd&&day>=minDate&&day<=today)setHovered(day);}} onFocus={() => setFocused(day)} onClick={() => choose(day)} onKeyDown={e => calendarKey(e, day)}>{Number(day.slice(-2))}</button></td>;
            })}</tr>)}</tbody>
          </table>
          <p className="calendar-instruction" aria-live="polite">{choosingEnd ? 'Теперь выберите окончание. Для одного дня нажмите ту же дату.' : 'Выберите начало и окончание периода.'}</p>
          <p id={`${id}-keyboard`} className="calendar-keyboard">Стрелки — дни · PgUp / PgDn — месяцы · Esc — закрыть</p>
        </div>}
        </div>
      </div>
      <div className="period-footer"><p id={`${id}-summary`} role="status" className={error ? 'period-error' : ''}>{summary}</p><div><button type="button" className="period-cancel" onClick={close}>Отмена</button><button type="button" className="period-apply" disabled={!!error} onClick={apply}>Применить</button></div></div>
    </div>
  </div>;
}
