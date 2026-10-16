export type PeriodMode = 'today'|'seven'|'month'|'quarter'|'year'|'custom';
export const PERIOD_MODES: {value:PeriodMode;label:string}[] = [
  {value:'today',label:'Сегодня'},{value:'seven',label:'7 дней'},
  {value:'month',label:'Месяц'},{value:'quarter',label:'Квартал'},
  {value:'year',label:'Год'},{value:'custom',label:'Свой период'},
];

export function periodRange(mode:Exclude<PeriodMode,'custom'>, today:string, year=Number(today.slice(0,4)), index=1) {
  if(mode==='today')return {from:today,to:today};
  if(mode==='seven'){
    const from=new Date(`${today}T12:00:00Z`);from.setUTCDate(from.getUTCDate()-6);
    return {from:from.toISOString().slice(0,10),to:today};
  }
  const month=mode==='month'?index:mode==='quarter'?(index-1)*3+1:1;
  const from=`${year}-${String(month).padStart(2,'0')}-01`;
  const end=new Date(Date.UTC(year,month-1+(mode==='month'?1:mode==='quarter'?3:12),0,12)).toISOString().slice(0,10);
  return {from,to:end>today?today:end};
}
