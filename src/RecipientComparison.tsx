import './recipient-comparison.css';
export type RecipientComparison={id:string;recipient_id:string|null;recipient:string;status:string;onec_names:string[];wialon_names:string[];onec_liters:string|null;wialon_liters:string|null;difference:string|null;onec_count:number;wialon_count:number;automatic_count?:number;automatic_reasons?:string[];unmatched_reasons?:string[]};
const formatter=new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
const liters=(value:string|null)=>value===null?'—':formatter.format(Number(value));
export function RecipientComparisons({rows}:{rows:RecipientComparison[]|undefined}){
  if(!rows)return <p className="recipient-unavailable">Сопоставление недоступно. Обновите отчёт.</p>;
  if(!rows.length)return <p className="recipient-note">Выдач получателям за этот день нет.</p>;
  const unknown=rows.reduce((count,row)=>count+(row.status==='unmatched'?row.wialon_count:0),0);
  return <><p className="recipient-note">Сопоставление выполняется автоматически по карточке Wialon, документам 1С и GPS. Выдач GV без найденного соответствия 1С: {unknown}.</p>
    <div className="detail-scroll recipient-comparison"><table><thead><tr><th>Получатель 1С</th><th>Карточка Wialon</th><th className="number">1С, л</th><th className="number">Wialon, л</th><th className="number">Разница, л</th><th>Сопоставление</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className={row.difference!==null&&Number(row.difference)!==0?'recipient-mismatch':''}>
      <td className="recipient-name">{row.onec_names.join(' / ')||row.recipient||'—'}{row.onec_count>1&&<small>Выдач 1С: {row.onec_count}</small>}</td>
      <td className="recipient-name">{row.automatic_count===row.wialon_count&&!!row.automatic_count?'Карта не передана':row.wialon_names.join(' / ')||'—'}{row.wialon_count>1&&<small>Выдач Wialon: {row.wialon_count}</small>}</td>
      <td className="number">{liters(row.onec_liters)}</td><td className="number">{liters(row.wialon_liters)}</td><td className="number">{row.difference!==null&&Number(row.difference)>0?'+':''}{liters(row.difference)}</td>
      <td><span title={[...(row.status==='unmatched'?['Выдача есть в GV (Wialon), соответствие с 1С ещё не найдено.']:[]),...(row.automatic_reasons||[]),...(row.unmatched_reasons||[])].join('\n')} className={`recipient-state ${row.status==='matched'?'matched':''}`}>{row.automatic_count?'Авто: 1С и GPS':row.status==='matched'?'Карточка сопоставлена':row.status==='onec_only'?'Только 1С':'Только GV'}</span></td>
    </tr>)}</tbody></table></div>
    <p className="recipient-note">«Только 1С» и «Только GV» — записи, для которых пока не найдено соответствие в другой системе. При неполной сверке разница по технике не рассчитывается.</p></>;
}
