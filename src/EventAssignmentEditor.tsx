import {useEffect, useState} from 'react';
import {Picker} from './MatchingDialog';

export type WialonIssue = {
  started_at:string; ended_at:string; recipient:string; liters:string;
  event_key?:string; event_fingerprint?:string; can_assign?:boolean;
  manual_recipient_id?:string; event_link_stale?:boolean;
  event_link?:{onec_id:string|null; recipient:string; reason:string; revision:number; updated_by:string; updated_at:string};
};
type Target = {id:string; name:string; registration?:string; farm?:string};
type Identity = {authenticated:boolean; csrf_token:string; user:string|null};

async function api(path:string, options?:RequestInit) {
  const response=await fetch('/api/fuel-trucks/v1/'+path,{cache:'no-store',...options});
  if(response.status===404)throw new Error('Сервер ещё не обновлён для назначения выдач.');
  const data=await response.json();
  if(!response.ok)throw new Error(data.message||'Не удалось выполнить запрос');
  return data;
}

export function EventAssignmentEditor({event,sourceId,onClose,onChanged}:{
  event:WialonIssue;sourceId:number;onClose:()=>void;onChanged:()=>Promise<void>;
}) {
  const [identity,setIdentity]=useState<Identity|null>(null);
  const [targets,setTargets]=useState<Target[]>([]);
  const [target,setTarget]=useState(event.event_link?.onec_id||'');
  const [reason,setReason]=useState(event.event_link?.reason||'');
  const [login,setLogin]=useState('');const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    Promise.all([api('matching-session'),api('recipient-mappings')]).then(([session,catalog])=>{
      if(!cancelled){setIdentity(session);setTargets(catalog.targets);setLoaded(true);}
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Не удалось загрузить получателей');});
    return()=>{cancelled=true;};
  },[]);
  async function signIn(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try {
      const result=await api('matching-login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRF-Token':identity?.csrf_token||''},body:new URLSearchParams({data:JSON.stringify({login,pass:password})})});
      if(!result.status)throw new Error('Не удалось войти. Проверьте логин и пароль.');
      setPassword('');setIdentity(await api('matching-session'));
    } catch(e){setError(e instanceof Error?e.message:'Не удалось войти');}
    finally{setBusy(false);}
  }
  async function save(clear=false) {
    setBusy(true);setError('');
    try {
      await api('event-links',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':identity?.csrf_token||''},body:JSON.stringify({
        source_id:sourceId,started_at:event.started_at,ended_at:event.ended_at,
        event_fingerprint:event.event_fingerprint,onec_id:clear?null:target,
        previous_revision:event.event_link?.revision??null,reason,
      })});
      await onChanged();onClose();
    } catch(e){setError(e instanceof Error?e.message:'Не удалось сохранить назначение');}
    finally{setBusy(false);}
  }
  return <section className="event-assignment matching-editor" aria-label="Назначить получателя выдачи">
    <div><strong>Выдача без карточки · {new Date(event.started_at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} · {Number(event.liters).toLocaleString('ru-RU')} л</strong>
      <button type="button" className="matching-cancel" disabled={busy} onClick={onClose}>Закрыть назначение</button></div>
    <p>Выберите фактического получателя и укажите основание: документ, заправочную ведомость или проверку GPS. Назначение относится только к этой выдаче.</p>
    {event.event_link_stale&&<p role="alert">Исходные сведения изменились. Проверьте выдачу перед повторным назначением.</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {!loaded&&!error&&<p role="status">Загружаем получателей…</p>}
    {identity&&!identity.authenticated&&<form className="matching-login" onSubmit={signIn}>
      <p>Для назначения получателя войдите в DBAnalit.</p>
      <label>Логин<input autoComplete="username" value={login} onChange={e=>setLogin(e.target.value)} required/></label>
      <label>Пароль<input autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      <button type="submit" disabled={busy}>Войти</button>
    </form>}
    {loaded&&<><Picker label="Получатель выдачи 1С" value={target} onChange={setTarget}
      options={targets.map(t=>({id:t.id,name:t.name,description:[t.registration,t.farm].filter(Boolean).join(' · ')}))}/>
      <label className="event-reason">Основание назначения<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={1000} rows={2} placeholder="Например: путевой лист №… и техника рядом с бензовозом по GPS"/></label>
      <div className="event-actions"><button type="button" className="matching-save" disabled={busy||!identity?.authenticated||!target||reason.trim().length<3} onClick={()=>void save()}>Сохранить назначение</button>
      {event.event_link?.onec_id&&<button type="button" disabled={busy||!identity?.authenticated||reason.trim().length<3} onClick={()=>void save(true)}>Снять назначение</button>}
      {busy&&<span role="status">Проверяем выдачу и обновляем отчёт…</span>}</div>
      {event.event_link&&<p>Последнее изменение: {event.event_link.updated_by} · {new Date(event.event_link.updated_at).toLocaleString('ru-RU')}</p>}
    </>}
  </section>;
}
