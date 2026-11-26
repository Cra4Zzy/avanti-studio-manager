(function(){
"use strict";
const API="https://xvxgqyrykkxdfadppoor.supabase.co/functions/v1/avanti-booking";
const AUTH="https://xvxgqyrykkxdfadppoor.supabase.co/auth/v1/token?grant_type=password";
const KEY="sb_publishable_CSD6Wfed4Wz3Qxd4qsUlLQ_psQpke_k";
const root=document.querySelector("#root"),dialog=document.querySelector("#action-dialog"),logout=document.querySelector("#logout"),account=document.querySelector("#account");
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const parts=now=>Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(now).map(x=>[x.type,x.value]));
const today=()=>{const p=parts(new Date());return p.year+"-"+p.month+"-"+p.day};
const minute=()=>{const p=parts(new Date());return Number(p.hour)*60+Number(p.minute)};
const addDay=(d,n)=>{const date=new Date(d+"T00:00:00Z");date.setUTCDate(date.getUTCDate()+n);return date.toISOString().slice(0,10)};
const isDate=d=>/^\d{4}-\d\d-\d\d$/.test(d)&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
const clock=t=>String(Math.floor(t/60)).padStart(2,"0")+":"+String(t%60).padStart(2,"0");
const label=d=>new Intl.DateTimeFormat("de-DE",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(d+"T00:00:00Z"));
let token="",refresh="",expires=0,day=today(),snapshot=null,poll=null,busy=false,staffFilter="all",filterInitialized=false,lastLoadedDay=null,loadError="",sessionGeneration=0;

let teamProfiles=[],state={staff:[],appointments:[],absences:[],services:[]},weekData={},mobileStaff="",teamView=false,phoneMode=true,viewMode="day",teamPage=false,dragged=null;
const addDays=addDay,time=clock,fullDate=label,weekStart=d=>addDay(d,-((new Date(d+"T00:00:00Z").getUTCDay()+6)%7));
const activeStaff=s=>s.staff,staff=id=>state.staff.find(s=>s.id===id),treatment=a=>a.serviceName||"Telefontermin";
const initials=s=>'<span class="avatar" aria-hidden="true">'+esc(s.name.split(/\\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase())+'</span>';
const validPortrait=p=>typeof p==="string"&&p.length<=100000&&/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(p);
const avatar=s=>validPortrait(s.photo)?'<span class="avatar staff-photo" aria-hidden="true"><img alt="" src="'+esc(s.photo)+'"></span>':initials(s);
const heading=(n,t,p,a="")=>'<div class="heading"><div><span class="eyebrow">'+n+'</span><h1>'+t+'</h1><p>'+p+'</p></div>'+a+'</div>';
function dayShift(person,d){const shifts=snapshot.shifts.filter(s=>s.staff_id===person.id&&s.weekday===new Date(d+"T00:00:00Z").getUTCDay());return shifts.length?{start:Math.min(...shifts.map(x=>x.start_minute)),end:Math.max(...shifts.map(x=>x.end_minute))}:null;}
function salonClosure(s,d){const closure=weekData[d]?.closure;if(closure?.closed)return {name:closure.name,kind:closure.kind};const rows=s.absences.filter(x=>x.day===d&&x.wholeDay);return s.staff.length&&s.staff.every(p=>rows.some(x=>x.staffId===p.id))?{name:"Salon geschlossen"}:null;}
function quickDay(s,{day:d,staffId},now=new Date()){
 const p=staff(staffId),snap=weekData[d],shift=dayShift(p,d);
 if(!snap)return [];
 const es=snap.entries.filter(e=>e.staff_id===staffId),spans=snapshot.shifts.filter(w=>w.staff_id===staffId&&w.weekday===new Date(d+"T00:00:00Z").getUTCDay());
 const first=Math.min(shift?.start??540,...es.filter(e=>e.kind==="appointment"||e.local.end-e.local.start<1440).map(e=>Math.floor(e.local.start/15)*15));
 const last=Math.max(shift?.end??1080,...es.filter(e=>e.kind==="appointment"||e.local.end-e.local.start<1440).map(e=>Math.ceil(e.local.end/15)*15));
 if(!shift&&!es.length&&!salonClosure(s,d))return [];
 return Array.from({length:Math.max(0,Math.ceil((last-first)/15))},(_,i)=>{const t=first+i*15,e=es.find(e=>t<e.local.end&&t+15>e.local.start);let status;
 if(e){status=e.kind==="appointment"?"booked":e.local.start===0&&e.local.end===1440?(salonClosure(s,d)?"closed":"wholeDay"): "absence";}
 else if(salonClosure(s,d))status="closed";
 else if(!spans.some(w=>t>=w.start_minute&&t+15<=w.end_minute))status=shift&&t>=shift.start&&t<shift.end?"pause":"off";
 else status=d<today()||d===today()&&t<=minute()?"past":"free";
 return {start:t,end:t+15,status,appointmentId:e?.id,blockId:e?.id,source:e?.source,label:e?.kind==="appointment"?e.customer_name:e?.note};});
}
function freeSlots(s,{day:d,staffId,durationMinutes=15}){const items=quickDay(s,{day:d,staffId}),free=new Set(items.filter(x=>x.status==="free").map(x=>x.start));return items.filter(x=>x.status==="free"&&Array.from({length:durationMinutes/15},(_,i)=>x.start+i*15).every(t=>free.has(t))).map(x=>({start:x.start}));}
function syncModel(){
 state.staff=snapshot.staff.map(p=>({...p,photo:teamProfiles.find(t=>t.id===p.id)?.photo||null,days:[...new Set(snapshot.shifts.filter(w=>w.staff_id===p.id).map(w=>w.weekday))]}));
 state.services=snapshot.services;
 state.appointments=[];state.absences=[];
 for(const [date,data] of Object.entries(weekData))for(const e of data.entries){
 const base={id:e.id,day:date,staffId:e.staff_id,start:e.local.start,end:e.local.end,source:e.source};
 if(e.kind==="appointment")state.appointments.push({...base,status:e.status,name:e.customer_name,serviceName:e.service_name_snapshot});
 else state.absences.push({...base,reason:e.note||"Gesperrt",wholeDay:e.local.start===0&&e.local.end===1440});
 }
 if(!state.staff.some(s=>s.id===mobileStaff))mobileStaff=state.staff[0]?.id||"";
 staffFilter=teamView?"all":staff(mobileStaff)?.code||"all";
}

const toast=s=>{const x=document.querySelector("#toast");x.textContent=s;x.classList.add("show");clearTimeout(x._timer);x._timer=setTimeout(()=>x.classList.remove("show"),3800)};
const errorLabel=e=>({"salon_closed":"Der Salon ist an diesem Tag geschlossen.","closure_overlap":"Dieser Zeitraum überschneidet sich mit einer bestehenden Schließzeit.","staff_has_appointments":"Diese Person hat noch zukünftige Termine. Bitte zuerst verschieben oder absagen.","invalid_photo":"Das Profilbild konnte nicht verarbeitet werden.","payload_too_large":"Das Bild ist zu groß. Bitte ein kleineres Foto wählen.","existing_appointments":"Der neue Arbeitsplan würde bestehende Termine ausschließen. Bitte zuerst verschieben.","invalid_shifts":"Arbeitszeiten prüfen: keine Überschneidungen, 15-Minuten-Raster.","invalid_profile":"Bitte Name und Profil prüfen.","invalid_booking":"Bitte Datum, Uhrzeit und Dauer prüfen.","entry_missing":"Der Eintrag ist nicht mehr vorhanden.","forbidden":"Keine Berechtigung für diese Aktion.","staff_unavailable":"Mitarbeiterin nicht verfügbar.","slot_taken":"Der Zeitraum wurde inzwischen belegt. Bitte andere Zeit wählen.","invalid_day":"Datum ungültig.","time_in_past":"Diese Uhrzeit liegt bereits in der Vergangenheit.","outside_working_hours":"Die Behandlung passt nicht in die Arbeitszeit oder Pause.","login_required":"Bitte neu anmelden.","session_invalid":"Sitzung abgelaufen. Bitte neu anmelden.","service_unavailable":"Leistung nicht verfügbar.","rate_limited":"Zu viele Anfragen.","request_failed":"Serveranfrage fehlgeschlagen."}[e.message]||e.message);
async function request(action,{method="GET",body=null,session=token}={}){
 const path=API+"?action="+encodeURIComponent(action)+(method==="GET"&&body?.day?"&day="+encodeURIComponent(body.day):"");
 const res=await fetch(path,{method,headers:{"apikey":KEY,"Authorization":session?"Bearer "+session:"Bearer "+KEY,"Content-Type":"application/json"},body:method==="POST"?JSON.stringify(body):undefined,cache:"no-store"});
 let data;try{data=await res.json()}catch{throw Error("Serverantwort ungültig.")}if(!res.ok)throw Error(data.error||"request_failed");return data;
}
async function authenticate(email,password){
 const r=await fetch(AUTH,{method:"POST",headers:{"apikey":KEY,"Content-Type":"application/json"},body:JSON.stringify({email,password}),cache:"no-store"});
 if(!r.ok)throw Error("E-Mail oder Passwort ungültig.");const x=await r.json();token=x.access_token;refresh=x.refresh_token;expires=Date.now()+Number(x.expires_in||3000)*1000;
 if(!token)throw Error("Anmeldung fehlgeschlagen.");
}
async function refreshAuth(){if(Date.now()<expires-60000)return;if(!refresh)throw Error("session_invalid");
 const generation=sessionGeneration;const r=await fetch("https://xvxgqyrykkxdfadppoor.supabase.co/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:refresh}),cache:"no-store"});
 if(!r.ok)throw Error("session_invalid");const data=await r.json();if(generation!==sessionGeneration)throw Error("session_invalid");token=data.access_token;refresh=data.refresh_token;expires=Date.now()+Number(data.expires_in||3000)*1000;
}
function login(){
 document.body.removeAttribute("data-screen");document.getElementById("legacy-style").media="not all";document.getElementById("studio-nav").hidden=true;document.getElementById("legacy-brand").hidden=true;document.getElementById("login-brand").hidden=false;weekData={};teamProfiles=[];state={staff:[],appointments:[],absences:[],services:[]};teamPage=false;viewMode="day";teamView=false;sessionGeneration++;token="";refresh="";expires=0;snapshot=null;lastLoadedDay=null;loadError="";filterInitialized=false;staffFilter="all";clearInterval(poll);logout.hidden=true;account.textContent="";
 root.innerHTML='<div class="login-shell"><div class="login-intro"><div><span class="eyebrow">AVANTI / STUDIO MANAGER</span><h1>Dein Salon.<br>Dein Kalender.</h1></div><p>Alle Termine an einem Ort. Eintragen, sperren und freie Zeiten sofort über den gemeinsamen Server abgleichen.</p></div><div class="login-panel"><span class="eyebrow">GESCHÜTZTER MITARBEITERZUGANG</span><h2>Willkommen zurück.</h2><p>Melde dich mit deinem von der Salonleitung freigegebenen Konto an. Es werden keine Testpasswörter angelegt.</p><form id="login-form"><label>E-Mail-Adresse<input name="email" type="email" autocomplete="username" required></label><label>Passwort<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Verbinden & Kalender öffnen</button><div id="login-error" class="status-text" role="alert"></div></form><p class="subtle">Der Salonzugang wird einmalig von der Salonleitung eingerichtet. Keine öffentliche Registrierung.</p></div></div>';
 root.querySelector("#login-form").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector("button"),status=f.querySelector("#login-error");b.disabled=true;status.textContent="";try{await authenticate(f.elements.email.value,f.elements.password.value);await load();poll=setInterval(()=>{if(token&&!dialog.open&&!document.hidden)load(true)},25000)}catch(err){status.textContent=errorLabel(err);token="";refresh="";expires=0}finally{b.disabled=false}});
}
async function load(silent=false){
 if(busy)return;busy=true;const requestedDay=day,generation=sessionGeneration;
 try{await refreshAuth();const dates=Array.from({length:7},(_,i)=>addDay(weekStart(requestedDay),i));const [results,teamResult]=await Promise.all([Promise.all(dates.map(d=>request("studio",{body:{day:d}}))),request("team")]);const fresh=Object.fromEntries(dates.map((d,i)=>[d,results[i]]));const x=fresh[requestedDay];
 if(generation!==sessionGeneration||!token)return;
 snapshot=x;weekData=fresh;teamProfiles=teamResult.team;syncModel();lastLoadedDay=requestedDay;loadError="";logout.hidden=false;account.textContent=x.user.email+" · "+x.user.role;render(silent);
 }catch(e){if(generation!==sessionGeneration)return;if(["session_invalid","login_required","forbidden"].includes(e.message)){if(!snapshot)throw e;login();return;}loadError=errorLabel(e);if(lastLoadedDay&&snapshot){day=lastLoadedDay;render(true);}if(!silent)toast(loadError);if(!snapshot)throw e;}
 finally{busy=false}
}
function blocked(staff,t,end){
 const shifts=snapshot.shifts.filter(w=>w.staff_id===staff.id&&w.weekday===new Date(day+"T00:00:00Z").getUTCDay());
 const entry=snapshot.entries.find(e=>e.staff_id===staff.id&&t<e.local.end&&end>e.local.start);
 if(entry)return entry;
 if(snapshot.closure?.closed)return "off";
 if(!shifts.some(w=>t>=w.start_minute&&end<=w.end_minute))return "off";
 if(day<today()||day===today()&&t<=minute())return "past";
 return "free";
}
function freeFor(staff,t,len){if(t+len>1440)return false;for(let at=t;at<t+len;at+=15)if(blocked(staff,at,at+15)!=="free")return false;return true;}
function weekOverview(members){
 const first=weekStart(day),days=Array.from({length:7},(_,i)=>addDays(first,i)),ids=new Set(members.map(s=>s.id));
 const all=state.appointments.filter(a=>a.status==='confirmed'&&ids.has(a.staffId)&&days.includes(a.day));
 const blocked=state.absences.filter(a=>ids.has(a.staffId)&&days.includes(a.day));
 const duration=all.reduce((sum,a)=>sum+a.end-a.start,0);
 const cards=days.map(date=>{
  const entries=[...all.filter(a=>a.day===date).map(a=>({...a,kind:'appointment'})),...blocked.filter(a=>a.day===date).map(a=>({...a,kind:'block'}))].sort((a,b)=>a.start-b.start||a.staffId.localeCompare(b.staffId));
  const working=members.filter(s=>!salonClosure(state,date)&&s.days.includes(new Date(date+'T00:00:00Z').getUTCDay()));
  const count=entries.filter(a=>a.kind==='appointment').length;
  const next=working.flatMap(s=>freeSlots(state,{day:date,staffId:s.id,durationMinutes:30})).sort((a,b)=>a.start-b.start)[0];
  const parts=entries.map(a=>'<button class="week-entry '+(a.kind==='block'?'week-block':a.source==='online'?'week-online':'week-manual')+'" '+(a.kind==='block'?'data-block-edit':'data-edit')+'="'+esc(a.id)+'"><span class="week-time">'+time(a.start)+' – '+time(a.end)+'</span><strong>'+esc(a.kind==='block'?a.reason:a.name)+'</strong><small>'+esc(staff(a.staffId)?.name||'')+(a.kind==='appointment'?' · '+esc(treatment(a)):' · Gesperrt')+'</small></button>').join('');
  return '<article class="week-card '+(date===today()?'week-today':'')+'"><button class="week-date" data-day="'+date+'" aria-label="'+esc(fullDate(date)+' im Tageskalender öffnen')+'"><span>'+esc(new Intl.DateTimeFormat('de-DE',{weekday:'short',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z')))+'</span><strong>'+Number(date.slice(-2))+'</strong>'+(date===today()?'<small>Heute</small>':'')+'</button><div class="week-count">'+count+' '+(count===1?'Termin':'Termine')+' · '+working.length+' im Dienst</div><div class="week-entries">'+(parts||'<p class="week-empty">'+(salonClosure(state,date)?esc(salonClosure(state,date).name):working.length?'Keine Einträge':'Geschlossen / frei')+'</p>')+'</div><button class="week-open" data-day="'+date+'">'+(next?'Frei ab '+time(next.start)+' · ':'')+'Tag öffnen</button></article>';
 }).join('');
 return '<div class="week-summary"><div><small>Termine in dieser Woche</small><strong>'+all.length+'</strong></div><div><small>Gebuchte Zeit</small><strong>'+Math.floor(duration/60)+' h '+(duration%60)+' min</strong></div><div><small>Zeitsperren</small><strong>'+blocked.length+'</strong></div></div><div class="week-grid">'+cards+'</div>';
}
function personalCalendar(){
 const members=activeStaff(state),person=members.find(s=>s.id===mobileStaff)||members[0];if(!person){mobileStaff='';return heading('AVANTI / KALENDER','Noch kein aktives Team.','Lege ein Mitarbeiterprofil an, um Termine zu verwalten.','<a href="#team">Team verwalten</a>');}if(mobileStaff!==person.id){mobileStaff=person.id;staffFilter=person.id;}
 const now=new Date(),current=today(now),first=weekStart(day),dates=Array.from({length:7},(_,i)=>addDays(first,i));
 const shortDate=d=>new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));
 const weekday=d=>new Intl.DateTimeFormat('de-DE',{weekday:'long',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z'));
 const people=members.map(s=>'<button class="personal-person" data-person="'+esc(s.id)+'" aria-pressed="'+(s.id===person.id)+'">'+avatar(s)+'<span><strong>'+esc(s.name)+'</strong><small>'+esc(s.specialty)+'</small></span><i aria-hidden="true"></i></button>').join('');
 const days=dates.map(d=>{
  const shift=dayShift(person,d),work=Boolean(shift),count=quickDay(state,{day:d,staffId:person.id},now).filter(x=>x.status==='free').length;
  return '<button class="personal-day" data-person-date="'+d+'" aria-pressed="'+(day===d)+'"><span>'+esc(weekday(d))+'</span><strong>'+shortDate(d)+'</strong><small>'+(d===current?'Heute · ':'')+(work?time(shift.start)+'–'+time(shift.end):'Frei')+'</small><span class="personal-availability">'+(salonClosure(state,d)?esc(salonClosure(state,d).name):state.absences.some(a=>a.day===d&&a.staffId===person.id&&a.vacationId)?'Urlaub':state.absences.some(a=>a.day===d&&a.staffId===person.id&&a.wholeDay===true)?'Tag gesperrt':work?count+' Slots frei':'Kein Dienst')+'</span></button>';
 }).join('');
 const items=quickDay(state,{day,staffId:person.id},now),counts={free:0,quick:0,booked:0,absence:0};for(const x of items)if(x.status in counts)counts[x.status]++;
 const work=Boolean(dayShift(person,day));
 const whole=state.absences.some(a=>a.day===day&&a.staffId===person.id&&a.wholeDay===true);
 const vacation=state.absences.some(a=>a.day===day&&a.staffId===person.id&&a.vacationId),canWhole=day>=current&&day<=addDays(current,365);
 const labels={free:'Frei',quick:'Gesperrt',booked:'Gebucht',absence:'Abwesend',wholeDay:'Tag gesperrt',vacation:'Urlaub',closed:'Salon geschlossen',off:'Außer Dienst',pause:'Pause',past:'Vergangen',unavailable:'Nicht verfügbar'};
 const hours=[];for(const entry of items){const h=Math.floor(entry.start/60);if(!hours.length||hours.at(-1).h!==h)hours.push({h,entries:[]});hours.at(-1).entries.push(entry);}
 const grid=hours.map(({h,entries})=>'<div class="personal-hour"><div class="personal-hour-label">'+time(h*60)+'<small>UHR</small></div><div class="personal-slot-group">'+entries.map(x=>{
  const active=x.status==='free'||x.status==='quick',attrs=phoneMode&&x.status==='free'?' data-phone-slot="'+x.start+'"':phoneMode&&x.status==='quick'?' disabled':active?' data-toggle-slot="'+x.start+'" aria-pressed="'+(x.status==='quick')+'"':x.status==='booked'?' draggable="true" data-edit="'+esc(x.appointmentId)+'"':['absence','wholeDay','vacation','closed'].includes(x.status)?' data-block-edit="'+esc(x.blockId)+'"':' disabled';
  return '<button class="personal-slot slot-'+x.status+(x.source==='manual'?' slot-phone':'')+'"'+attrs+' aria-label="'+esc(time(x.start)+' bis '+time(x.end)+' · '+labels[x.status]+(x.label?' · '+x.label:'')+(active?' · '+(phoneMode?(x.status==='free'?'Telefontermin anlegen':'Bereits gesperrt'):(x.status==='quick'?'freigeben':'Aktion wählen')):''))+'" title="'+esc(x.label||labels[x.status])+'"><strong>'+time(x.start)+'</strong><small><i aria-hidden="true">'+(x.status==='free'?'+':x.status==='quick'?'✓':x.status==='booked'?'●':'–')+'</i>'+esc(x.status==='booked'?(x.label||(x.source==='manual'?'Telefontermin':'Gebucht')):labels[x.status])+'</small></button>';
 }).join('')+'</div></div>').join('');
 return '<section class="personal-workspace"><aside class="personal-sidebar"><span class="personal-caption">TEAM</span><button class="team-overview-link" data-team-view="all">▦ Gesamtkalender</button><div class="personal-team">'+people+'</div><div class="personal-side-note"><strong>Dein Wochenplan</strong><p>Wähle dein Profil und arbeite direkt in deinem Kalender.</p></div></aside><div class="personal-main"><div class="personal-top"><div><span class="personal-caption">TERMINPLANUNG</span><h1>'+esc(person.name)+'s Kalender</h1><p>'+esc(person.specialty)+'</p></div><div class="personal-weeknav"><button data-week-step="-1" aria-label="Vorherige Woche">‹</button><button data-person-today>Heute</button><button data-week-step="1" aria-label="Nächste Woche">›</button></div></div><section class="personal-week"><div class="personal-section-title"><h2>Deine Woche</h2><span>'+shortDate(first)+' – '+shortDate(addDays(first,6))+' · '+first.slice(0,4)+'</span></div><div class="personal-days">'+days+'</div></section><section class="personal-daily"><div class="personal-section-title personal-daily-title"><div><span class="personal-caption">TAGESPLAN</span><h2>'+esc(fullDate(day))+'</h2></div><div class="personal-day-actions"><div class="day-action-buttons"><button type="button" class="vacation-button" data-vacation="'+esc(person.id)+'">Urlaub / mehrere Tage</button><button class="personal-day-toggle" data-toggle-day aria-pressed="'+whole+'" '+(canWhole?'':'disabled')+'>'+(vacation?'Urlaub gesperrt':whole?'Tag freigeben':'Ganzen Tag sperren')+'</button></div><div class="personal-counters"><span><b>'+counts.free+'</b> frei</span><span><b>'+counts.quick+'</b> gesperrt</span><span><b>'+counts.booked+'</b> gebuchte Slots</span></div></div></div><div class="personal-instruction personal-phone-toolbar"><div class="personal-mode" role="group" aria-label="Kalendermodus"><button type="button" data-phone-mode="phone" aria-pressed="'+phoneMode+'">+ Telefontermin</button><button type="button" data-phone-mode="block" aria-pressed="'+(!phoneMode)+'">Zeit sperren</button></div><span>'+(phoneMode?'Freie Startzeit anklicken, Dauer und optional Kontaktdaten eintragen.':'Freien Slot antippen: Termin oder 15-Minuten-Sperre wählen. Gesperrte Slots erneut antippen zum Freigeben.')+'</span></div><div class="personal-legend"><span><i class="p-free"></i>Frei</span><span><i class="p-phone"></i>Telefontermin</span><span><i class="p-quick"></i>Zeitsperre</span><span><i class="p-booked"></i>Kundentermin</span><span><i class="p-vacation"></i>Urlaub</span><span><i class="p-closed"></i>Salon geschlossen</span><span><i class="p-off"></i>Pause / nicht verfügbar</span></div>'+(work||items.some(x=>['booked','quick','absence','wholeDay','vacation','closed'].includes(x.status))?'<div class="personal-slots">'+grid+'</div>':'<div class="personal-no-work"><strong>An diesem Tag ist '+esc(person.name)+' nicht im Dienst.</strong><p>Wähle einen anderen Wochentag.</p></div>')+'<p class="personal-demo">Live-Salonkalender · Änderungen werden zentral gespeichert.</p></section></div></section>';
}
function teamCalendar(){
 const members=activeStaff(state);if(!members.length)return personalCalendar();
 const now=new Date(),current=today(now),first=weekStart(day);
 const by=members.map(s=>({s,shift:dayShift(s,day),items:new Map(quickDay(state,{day,staffId:s.id},now).map(x=>[x.start,x]))}));
 const ranges=by.flatMap(x=>[...(x.shift?[x.shift.start,x.shift.end]:[]),...Array.from(x.items.values()).filter(v=>v.status==='booked'||v.status==='quick').flatMap(v=>[v.start,v.end])]);
 const min=ranges.length?Math.min(...ranges):540,max=ranges.length?Math.max(...ranges):1080;
 const labels={free:'Frei',quick:'Gesperrt',booked:'Gebucht',absence:'Abwesend',wholeDay:'Tag gesperrt',vacation:'Urlaub',closed:'Salon geschlossen',off:'Außer Dienst',pause:'Pause',past:'Vergangen',unavailable:'Nicht verfügbar'};
 const cols='grid-template-columns:64px repeat('+members.length+',minmax(116px,1fr))';
 const header='<div class="team-grid-time">Uhrzeit</div>'+by.map(({s,shift,items})=>'<button class="team-grid-person" data-person="'+esc(s.id)+'">'+avatar(s)+'<strong>'+esc(s.name)+'</strong><small>'+(salonClosure(state,day)?esc(salonClosure(state,day).name):state.absences.some(a=>a.day===day&&a.staffId===s.id&&a.vacationId)?'Urlaub':shift?time(shift.start)+'–'+time(shift.end):'Frei')+' · '+Array.from(items.values()).filter(v=>v.status==='free').length+' frei</small></button>').join('');
 const rows=Array.from({length:Math.max(0,Math.ceil((max-min)/15))},(_,i)=>min+i*15).map(t=>'<div class="team-grid-time">'+time(t)+'</div>'+by.map(({s,items})=>{const x=items.get(t)||{status:salonClosure(state,day)?'closed':state.absences.some(a=>a.day===day&&a.staffId===s.id&&a.vacationId)?'vacation':'off'},st=x.status,available=st==='free'||st==='quick'&&!phoneMode,attr=available?' data-overview-slot="'+t+'" data-overview-staff="'+esc(s.id)+'"':st==='booked'?' draggable="true" data-edit="'+esc(x.appointmentId)+'"':['absence','wholeDay','vacation','closed'].includes(st)?' data-block-edit="'+esc(x.blockId)+'"':' disabled';
 return '<button class="personal-slot team-grid-slot slot-'+st+(x.source==='manual'?' slot-phone':'')+'"'+attr+' aria-label="'+esc(s.name+' · '+time(t)+' · '+(x.label||labels[st]))+'" title="'+esc(x.label||labels[st])+'"><small>'+esc(st==='booked'?x.label||labels[st]:labels[st])+'</small></button>';}).join('')).join('');
 const days=Array.from({length:7},(_,i)=>addDays(first,i)).map(d=>'<button class="personal-day" data-person-date="'+d+'" aria-pressed="'+(d===day)+'"><span>'+esc(new Intl.DateTimeFormat('de-DE',{weekday:'short',timeZone:'UTC'}).format(new Date(d+'T00:00:00Z')))+'</span><strong>'+d.slice(8)+'.'+d.slice(5,7)+'.</strong><small>'+(d===current?'Heute':'')+'</small></button>').join('');
 return '<section class="team-calendar"><div class="personal-top"><div><span class="personal-caption">TERMINPLANUNG · TEAM</span><h1>Gesamtkalender</h1><p>Alle Mitarbeiter auf einen Blick. Ein Name öffnet den persönlichen Kalender.</p></div><div class="day-action-buttons"><button class="vacation-button" data-vacation="all">Urlaub / mehrere Tage</button><button class="team-overview-link" data-team-view="person">Einzelkalender</button></div></div><section class="personal-week"><div class="personal-section-title"><h2>'+esc(fullDate(day))+'</h2><div class="personal-weeknav"><button data-person-date="'+addDays(day,-1)+'" aria-label="Vorheriger Tag">‹</button><button data-person-today>Heute</button><button data-person-date="'+addDays(day,1)+'" aria-label="Nächster Tag">›</button></div></div><div class="personal-days team-week-days">'+days+'</div></section><section class="personal-daily"><div class="personal-instruction personal-phone-toolbar"><div class="personal-mode" role="group" aria-label="Kalendermodus"><button data-phone-mode="phone" aria-pressed="'+phoneMode+'">+ Telefontermin</button><button data-phone-mode="block" aria-pressed="'+(!phoneMode)+'">Zeit sperren</button></div><span>'+(phoneMode?'Freies Feld wählen und Telefontermin eintragen.':'Freien Slot antippen und Telefontermin oder 15-Minuten-Sperre auswählen.')+'</span></div><div class="personal-legend"><span><i class="p-free"></i>Frei</span><span><i class="p-phone"></i>Telefontermin</span><span><i class="p-quick"></i>Zeitsperre</span><span><i class="p-booked"></i>Online</span><span><i class="p-vacation"></i>Urlaub</span><span><i class="p-closed"></i>Salon geschlossen</span><span><i class="p-off"></i>Außer Dienst / Pause</span></div><div class="team-grid-scroll"><div class="team-grid" style="'+cols+'">'+header+rows+'</div></div><p class="personal-demo">Live-Salonkalender · Änderungen werden zentral gespeichert.</p></section></section>';
}


function navigate(d){if(busy||!isDate(d)||d<addDay(today(),-365)||d>addDay(today(),359))return;day=d;load();}
function openFromDate(d,id){if(!id)return;const x=weekData[d];if(!x)return;day=d;snapshot=x;syncModel();render();showEntry(id);}
function openBlockFromDate(d,id){openFromDate(d,id);}

function originalTeam(){
 const active=teamProfiles.filter(s=>s.active),archived=teamProfiles.filter(s=>!s.active);
 const card=s=>'<article class="panel staff-card"><div class="staff-card-head">'+avatar(s)+'<div><h2>'+esc(s.name)+'</h2><p>'+esc(s.specialty||"Kein Schwerpunkt eingetragen")+'</p></div></div><span class="staff-status '+(s.active?'is-active':'is-archived')+'">'+(s.active?'Aktiv':'Archiviert')+'</span><button class="primary" data-profile="'+esc(s.code)+'">Profil &amp; Foto bearbeiten</button>'+(s.active?'<button class="shift-profile-button" data-shifts="'+esc(s.code)+'">Arbeitszeiten bearbeiten</button><button data-vacation="'+esc(s.id)+'">Urlaub eintragen</button><button class="staff-danger" data-archive="'+esc(s.code)+'">Mitarbeiter entfernen</button>':'<button data-restore="'+esc(s.code)+'">Wieder aktivieren</button>')+'</article>';
 return '<div class="staff-heading">'+heading("AVANTI / TEAM","Mitarbeiterverwaltung",active.length+" aktiv · "+archived.length+" archiviert")+'<button class="primary" id="staff-create">+ Mitarbeiter anlegen</button></div><section class="panel salon-settings"><div><h2>Betriebszeiten &amp; Schließtage</h2><p>Gesetzliche Feiertage automatisch gesperrt. Betriebsurlaub und Ausnahmen zentral verwalten.</p></div><button class="primary" data-team-absence>Feiertage &amp; Schließtage</button></section><h2 class="staff-section-title">Aktives Team</h2><div class="grid">'+(active.map(card).join("")||'<p>Keine aktiven Mitarbeiter. Lege ein neues Profil an.</p>')+'</div>'+(archived.length?'<details class="staff-archive"><summary>Archivierte Mitarbeiter ('+archived.length+')</summary><p>Diese Profile sind nicht buchbar. Ihre Terminhistorie bleibt erhalten.</p><div class="grid">'+archived.map(card).join("")+'</div></details>':'');
}
async function changeStaff(code,restore){
 const p=teamProfiles.find(s=>s.code===code);if(!p||busy)return;
 if(!confirm(restore?p.name+" wieder aktivieren?":p.name+" aus dem aktiven Team entfernen? Die Historie bleibt erhalten."))return;
 try{await refreshAuth();await request(restore?"staff-restore":"staff-archive",{method:"POST",body:{staffCode:code}});toast(restore?"Profil wieder aktiviert.":"Profil archiviert.");await load();}catch(e){toast(errorLabel(e));}
}
async function preparePortrait(file){
 if(!file||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>15000000)throw Error("Bitte ein JPG-, PNG- oder WebP-Bild bis 15 MB auswählen.");
 const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const side=Math.min(img.naturalWidth,img.naturalHeight);if(!side)throw Error("Bild ungültig.");
 const canvas=document.createElement("canvas");canvas.width=canvas.height=256;const ctx=canvas.getContext("2d");ctx.fillStyle="#f5f3ed";ctx.fillRect(0,0,256,256);ctx.drawImage(img,(img.naturalWidth-side)/2,(img.naturalHeight-side)/2,side,side,0,0,256,256);
 for(const quality of [.86,.72,.55,.4]){const data=canvas.toDataURL("image/jpeg",quality);if(validPortrait(data))return data;}throw Error("Profilbild konnte nicht verkleinert werden.");
 }finally{URL.revokeObjectURL(url);}
}
function staffEditor(person=null){
 let photo=person?.photo||null,changed=false,processing=false;
 replaceDialog(person?"Mitarbeiter bearbeiten":"Mitarbeiter anlegen",person?.name||"Neues Teamprofil",'<form class="entry-form staff-editor"><div class="staff-photo-editor"><div id="staff-photo-preview">'+avatar({name:person?.name||"Neu",photo})+'</div><div><label>Profilfoto<input type="file" name="portrait" accept="image/jpeg,image/png,image/webp"></label><button type="button" id="remove-photo">Foto entfernen</button><p class="subtle">JPG, PNG oder WebP · automatisch quadratisch zugeschnitten.</p></div></div><label>Name<input name="name" maxlength="80" value="'+esc(person?.name||"")+'" required></label><label>Schwerpunkt<input name="specialty" maxlength="100" value="'+esc(person?.specialty||"")+'"></label>'+(!person?'<p class="subtle">Neue Mitarbeiter sind zunächst ohne Arbeitszeiten angelegt. Trage anschließend den Wochenplan ein. Die aktiven Leistungen werden zugeordnet.</p>':'')+'<p class="dialog-error" role="alert"></p><button class="primary" type="submit">Profil speichern</button></form>');
 const form=dialog.querySelector("form"),f=form.elements,submit=form.querySelector('[type=submit]'),error=form.querySelector(".dialog-error");
 const preview=()=>{form.querySelector("#staff-photo-preview").innerHTML=avatar({name:f.name.value||"Neu",photo});form.querySelector("#remove-photo").disabled=!photo;};
 f.name.oninput=preview;
 f.portrait.onchange=async()=>{if(!f.portrait.files[0])return;processing=true;submit.disabled=true;error.textContent="";try{photo=await preparePortrait(f.portrait.files[0]);changed=true;preview();}catch(e){error.textContent=e.message;}finally{processing=false;submit.disabled=false;f.portrait.value="";}};
 form.querySelector("#remove-photo").onclick=()=>{if(processing)return;photo=null;changed=true;preview();};preview();
 bindSave(person?"staff-save":"staff-create",f=>{if(processing)throw Error("Bild wird verarbeitet.");return {...(person?{staffCode:person.code}:{}),name:f.name.value,specialty:f.specialty.value,...(changed?{photo}:{})};},person?"Profil gespeichert.":"Mitarbeiter angelegt. Bitte Arbeitszeiten festlegen.");
}
function render(silent=false){
 if(dialog.open||!snapshot)return;
 if(silent&&["INPUT","SELECT"].includes(document.activeElement?.tagName)&&!loadError)return;
 const oldScroll=root.querySelector(".team-grid-scroll")?.scrollLeft||0;
 document.getElementById("legacy-style").media="all";
 document.body.dataset.screen=teamPage?"team":"studio";
 document.getElementById("studio-nav").hidden=false;
 document.getElementById("legacy-brand").hidden=false;
 document.getElementById("login-brand").hidden=true;
 document.querySelectorAll("#studio-nav button").forEach(b=>b.setAttribute("aria-pressed",String((b.dataset.screen==="team")===teamPage)));
 const bar='<div class="workspace-live-tools"><span role="status" class="live-indicator '+(loadError?"live-error":"")+'">'+esc(loadError?"Abgleich fehlgeschlagen – letzter Stand":"Server verbunden")+'</span><div><button id="legacy-refresh">Aktualisieren</button><button id="legacy-quick" class="primary">+ Termin</button>'+(["owner","manager"].includes(snapshot.user.role)?'<button id="legacy-closures" class="closure-shortcut">Feiertage &amp; Schließtage</button>':'')+'<button id="legacy-week" aria-pressed="'+(viewMode==="week")+'">'+(viewMode==="week"?"Tageskalender":"Wochenübersicht")+'</button></div></div>';
 root.innerHTML=bar+(!teamPage&&viewMode==="day"&&snapshot.closure?.closed?'<div class="holiday-banner"><strong>Salon geschlossen</strong><span>'+esc(snapshot.closure.name)+'</span></div>':"")+(teamPage?originalTeam():viewMode==="week"?'<section class="team-calendar"><div class="personal-top"><div><span class="personal-caption">TERMINPLANUNG</span><h1>Wochenübersicht</h1><p>'+esc(fullDate(weekStart(day)))+' – '+esc(fullDate(addDay(weekStart(day),6)))+'</p></div><div class="personal-weeknav"><button data-week-step="-1">‹</button><button data-person-today>Heute</button><button data-week-step="1">›</button></div></div>'+weekOverview(teamView?state.staff:state.staff.filter(s=>s.id===mobileStaff))+'</section>':teamView?teamCalendar():personalCalendar());
 if(!["owner","manager"].includes(snapshot.user.role)){document.querySelector('[data-screen="team"]').hidden=true;}
 else document.querySelector('[data-screen="team"]').hidden=false;
 document.querySelectorAll("#studio-nav button").forEach(b=>b.onclick=()=>{teamPage=b.dataset.screen==="team";render();});
 root.querySelector("#legacy-refresh").onclick=()=>load();
 root.querySelector("#legacy-closures")?.addEventListener("click",()=>closureDialog());
 root.querySelector("#legacy-quick").onclick=()=>{if(!busy)quickBook();};
 root.querySelector("#legacy-week").onclick=()=>{teamPage=false;viewMode=viewMode==="week"?"day":"week";render();};
 root.querySelectorAll("[data-team-view]").forEach(b=>b.onclick=()=>{teamView=b.dataset.teamView==="all";viewMode="day";syncModel();render();});
 root.querySelectorAll("[data-person]").forEach(b=>b.onclick=()=>{mobileStaff=b.dataset.person;teamView=false;viewMode="day";syncModel();render();});
 root.querySelectorAll("[data-person-date],[data-day]").forEach(b=>b.onclick=()=>{viewMode="day";navigate(b.dataset.personDate||b.dataset.day);});
 root.querySelectorAll("[data-week-step]").forEach(b=>b.onclick=()=>navigate(addDay(day,7*Number(b.dataset.weekStep))));
 root.querySelectorAll("[data-person-today]").forEach(b=>b.onclick=()=>navigate(today()));
 root.querySelectorAll("[data-phone-mode]").forEach(b=>b.onclick=()=>{phoneMode=b.dataset.phoneMode==="phone";render();});
 root.querySelectorAll("[data-phone-slot],[data-toggle-slot],[data-overview-slot]").forEach(b=>b.onclick=()=>{if(busy)return;const p=staff(b.dataset.overviewStaff||mobileStaff);const t=Number(b.dataset.phoneSlot??b.dataset.toggleSlot??b.dataset.overviewSlot);if(!p)return;if(phoneMode)bookDialog(p,t);else choice(p.code,t);});
 root.querySelectorAll("[data-edit],[data-block-edit]").forEach(b=>b.onclick=()=>{if(busy)return;const id=b.dataset.edit||b.dataset.blockEdit;const d=b.closest(".week-card")?.querySelector("[data-day]")?.dataset.day||day;openFromDate(d,id);});
 root.querySelectorAll("[data-vacation]").forEach(b=>b.onclick=()=>{if(busy)return;const p=staff(b.dataset.vacation);staffFilter=p?.code||"all";absenceDialog();});
 root.querySelector("[data-team-absence]")?.addEventListener("click",()=>closureDialog());
 root.querySelector("[data-toggle-day]")?.addEventListener("click",()=>{const p=staff(mobileStaff),block=snapshot.entries.find(e=>e.staff_id===p?.id&&e.kind==="absence"&&e.local.start===0&&e.local.end===1440);if(block)showEntry(block.id);else {staffFilter=p?.code||"all";absenceDialog();}});
 root.querySelector("#staff-create")?.addEventListener("click",()=>staffEditor());
 root.querySelectorAll("[data-profile]").forEach(b=>b.onclick=()=>staffEditor(teamProfiles.find(p=>p.code===b.dataset.profile)));
 root.querySelectorAll("[data-archive]").forEach(b=>b.onclick=()=>changeStaff(b.dataset.archive,false));
 root.querySelectorAll("[data-restore]").forEach(b=>b.onclick=()=>changeStaff(b.dataset.restore,true));
 root.querySelectorAll("[data-shifts]").forEach(b=>b.onclick=()=>shiftsDialog(snapshot.staff.find(p=>p.code===b.dataset.shifts)));
 root.querySelectorAll('[draggable="true"][data-edit]').forEach(b=>{b.ondragstart=e=>{dragged=b.dataset.edit;e.dataTransfer.setData("text/plain",dragged);e.dataTransfer.effectAllowed="move";};b.ondragend=()=>dragged=null;});
 root.querySelectorAll("[data-overview-slot],[data-phone-slot],[data-toggle-slot]").forEach(b=>{b.ondragover=e=>{if(dragged){e.preventDefault();e.dataTransfer.dropEffect="move";}};b.ondrop=async e=>{e.preventDefault();if(!dragged||busy)return;const x=snapshot.entries.find(a=>a.id===dragged&&a.kind==="appointment");const p=staff(b.dataset.overviewStaff||mobileStaff),t=Number(b.dataset.overviewSlot??b.dataset.phoneSlot??b.dataset.toggleSlot);dragged=null;if(!x||!p||!Number.isFinite(t)||!confirm("Termin auf "+p.name+" · "+clock(t)+" verschieben?"))return;try{await refreshAuth();await request("edit-entry",{method:"POST",body:{id:x.id,name:x.customer_name,phone:x.customer_phone||"",staffCode:p.code,day,start:t,duration:x.local.end-x.local.start}});toast("Termin verschoben.");await load();}catch(err){toast(errorLabel(err));}};});
 const scroll=root.querySelector(".team-grid-scroll");if(scroll&&silent)scroll.scrollLeft=oldScroll;
}

function header(title,caption){return '<div class="dialog-top"><div><span class="eyebrow">AVANTI / TERMINPLANUNG</span><h2>'+esc(title)+'</h2></div><button class="icon-close" type="button" data-close aria-label="Schließen">×</button></div><div class="dialog-context">'+esc(caption)+'</div>'}
function openDialog(html){dialog.innerHTML='<div class="dialog-body">'+html+'</div>';dialog.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>dialog.close());dialog.showModal();}
function choice(code,start){const person=snapshot.staff.find(s=>s.code===code);if(!person)return;openDialog(header("Freie Zeit auswählen",person.name+" · "+label(day)+" · "+clock(start)+" Uhr")+'<p class="subtle">Wähle, was du mit diesem freien Zeitraum machen möchtest.</p><div class="dialog-choices"><button class="primary" id="book-choice">＋ Telefontermin eintragen</button><button id="block-choice">Zeit sperren</button></div>');
 dialog.querySelector("#book-choice").onclick=()=>bookDialog(person,start);
 dialog.querySelector("#block-choice").onclick=()=>blockDialog(person,start);
}
function bookDialog(person,start){
 const services=snapshot.services.filter(s=>snapshot.assignments?.some(a=>a.staff_id===person.id&&a.service_id===s.id)&&freeFor(person,start,s.duration));const lengths=Array.from({length:32},(_,i)=>(i+1)*15).filter(n=>freeFor(person,start,n));if(!lengths.length)return toast("Zeitfenster nicht mehr frei.");
 if(dialog.open)dialog.close();
 openDialog(header("Telefontermin",person.name+" · "+label(day)+" · "+clock(start)+" Uhr")+'<form class="entry-form" id="entry-form"><label>Behandlung<select name="serviceCode"><option value="">Andere Dauer / ohne Behandlung</option>'+services.map(s=>'<option value="'+esc(s.code)+'">'+esc(s.name)+' · '+s.duration+' Min.</option>').join("")+'</select></label><div class="form-row"><label>Kundenname<input name="name" maxlength="100" placeholder="Telefontermin" autocomplete="off"></label><label>Telefon (optional)<input name="phone" type="tel" maxlength="40" autocomplete="off"></label></div><label>Dauer<select name="duration">'+lengths.map(n=>'<option value="'+n+'" '+(n===30?"selected":"")+'>'+n+' Minuten</option>').join("")+'</select></label><div id="booking-span" class="dialog-context"></div><div class="subtle">Die gewählte Behandlungsdauer wird vollständig reserviert. Speichern erfolgt im gemeinsamen Salonkalender.</div><p class="dialog-error" role="alert"></p><button class="primary" type="submit">Termin verbindlich speichern</button></form>');
 const form=dialog.querySelector("form"),f=form.elements;function sync(){const s=snapshot.services.find(s=>s.code===f.serviceCode.value);if(s)f.duration.value=String(s.duration);f.duration.disabled=!!s;dialog.querySelector("#booking-span").textContent=clock(start)+" bis "+clock(start+Number(f.duration.value))+" Uhr";}f.serviceCode.onchange=sync;f.duration.onchange=sync;sync();
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;try{await refreshAuth();await request("staff-book",{method:"POST",body:{staffCode:person.code,serviceCode:f.serviceCode.value||null,day,start,name:f.name.value.trim()||"Telefontermin",phone:f.phone.value,duration:Number(f.duration.value)}});dialog.close();toast("Termin zentral gespeichert.");await load()}catch(err){form.querySelector(".dialog-error").textContent=errorLabel(err)}finally{button.disabled=false}};
}
function blockDialog(person,start){
 const lengths=Array.from({length:96},(_,i)=>(i+1)*15).filter(n=>freeFor(person,start,n));if(!lengths.length)return toast("Zeitfenster nicht mehr frei.");
 if(dialog.open)dialog.close();openDialog(header("Zeit sperren",person.name+" · "+label(day)+" · "+clock(start))+'<form id="block-form" class="entry-form"><label>Dauer<select name="duration">'+lengths.map(n=>'<option value="'+n+'">'+n+' Minuten · bis '+clock(start+n)+'</option>').join("")+'</select></label><label>Grund (optional)<input name="note" maxlength="100" placeholder="Nicht verfügbar"></label><p class="dialog-error" role="alert"></p><button class="primary">Zeit im Salonkalender sperren</button></form>');
 const form=dialog.querySelector("form");form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector("button");b.disabled=true;try{await refreshAuth();await request("block",{method:"POST",body:{staffCode:person.code,day,start,end:start+Number(form.elements.duration.value),note:form.elements.note.value}});dialog.close();toast("Zeitraum zentral gesperrt.");await load()}catch(err){form.querySelector(".dialog-error").textContent=errorLabel(err)}finally{b.disabled=false}};
}
function showEntry(id){const x=snapshot.entries.find(e=>e.id===id);if(!x)return;const person=snapshot.staff.find(s=>s.id===x.staff_id);const isBlock=x.kind==="absence";
 openDialog(header(isBlock?"Gesperrter Zeitraum":"Termindetails",(person?.name||"Mitarbeiterin")+" · "+label(day)+" · "+clock(x.local.start)+" – "+clock(x.local.end))+'<div class="dialog-context"><strong>'+esc(isBlock?(x.note||"Nicht verfügbar"):(x.customer_name||"Telefontermin"))+'</strong>'+(isBlock?"":'<p>'+esc(x.service_name_snapshot||"Telefontermin")+'</p><p>'+esc(x.customer_phone||"Keine Telefonnummer")+'</p><p>'+esc(x.customer_email||"")+'</p>')+'</div><p class="subtle">Absagen bzw. Freigeben entfernt diesen Eintrag aus den verfügbaren Belegungen. Der Datensatz bleibt für die Historie erhalten.</p><button id="remove-entry" class="danger">'+(isBlock?"Zeitraum freigeben":"Termin absagen")+'</button><p class="dialog-error" role="alert"></p>');
 if(!isBlock){const edit=document.createElement("button");edit.className="primary";edit.textContent="Termin bearbeiten / verschieben";dialog.querySelector("#remove-entry").before(edit);edit.onclick=()=>editEntry(x);}
 dialog.querySelector("#remove-entry").onclick=async e=>{if(!confirm(isBlock?"Zeitraum wirklich freigeben?":"Termin wirklich absagen?"))return;const b=e.currentTarget;b.disabled=true;try{await refreshAuth();await request(isBlock?"unblock":"cancel",{method:"POST",body:{id}});dialog.close();toast(isBlock?"Zeit freigegeben.":"Termin abgesagt.");await load()}catch(err){dialog.querySelector(".dialog-error").textContent=errorLabel(err)}finally{b.disabled=false}};
}

const staffOptions=(selected="",all=false)=>(all?'<option value="all">Gesamter Salon</option>':'')+snapshot.staff.map(s=>'<option value="'+esc(s.code)+'" '+(s.code===selected?'selected':'')+'>'+esc(s.name)+'</option>').join("");
const durationOptions=(selected=30)=>Array.from({length:32},(_,i)=>(i+1)*15).map(n=>'<option value="'+n+'" '+(n===selected?'selected':'')+'>'+n+' Minuten</option>').join("");
function replaceDialog(title,context,body){if(dialog.open)dialog.close();openDialog(header(title,context)+body);}
function bindSave(action,read,success,onDone){
 const form=dialog.querySelector("form");form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('[type=submit]');const error=form.querySelector(".dialog-error");b.disabled=true;error.textContent="";
 try{const body=await read(form.elements);await refreshAuth();await request(action,{method:"POST",body});dialog.close();toast(success);if(onDone)onDone(body);await load();}
 catch(err){error.textContent=errorLabel(err);}finally{b.disabled=false}};
}
function minuteInput(v){if(!/^\d{2}:\d{2}$/.test(v))throw Error("Bitte Uhrzeit eingeben.");const [h,m]=v.split(":").map(Number);if(m%15)throw Error("Bitte eine Uhrzeit im 15-Minuten-Raster wählen.");return h*60+m;}
function quickBook(){
 replaceDialog("Telefontermin","Schnelleingabe · zentraler Kalender",'<form class="entry-form"><label>Mitarbeiterin<select name="staffCode" required>'+staffOptions(staffFilter)+'</select></label><div class="form-row"><label>Datum<input name="day" type="date" min="'+today()+'" max="'+addDay(today(),90)+'" value="'+(day>addDay(today(),90)?today():day)+'" required></label><label>Uhrzeit<input name="start" type="time" step="900" value="09:00" required></label></div><label>Kundenname<input name="name" maxlength="100" placeholder="Telefontermin"></label><label>Telefon (optional)<input name="phone" type="tel" maxlength="40"></label><label>Behandlung<select name="serviceCode"></select></label><label>Dauer<select name="duration">'+durationOptions()+'</select></label><p class="dialog-error" role="alert"></p><button class="primary" type="submit">Termin speichern</button></form>');
 const f=dialog.querySelector("form").elements;
 function services(){const p=snapshot.staff.find(s=>s.code===f.staffCode.value);f.serviceCode.innerHTML='<option value="">Telefontermin / freie Dauer</option>'+snapshot.services.filter(s=>snapshot.assignments?.some(a=>a.staff_id===p?.id&&a.service_id===s.id)).map(s=>'<option value="'+esc(s.code)+'">'+esc(s.name)+'</option>').join("");f.duration.disabled=false;}
 f.staffCode.onchange=services;f.serviceCode.onchange=()=>{const s=snapshot.services.find(s=>s.code===f.serviceCode.value);if(s)f.duration.value=String(s.duration);f.duration.disabled=!!s;};services();
 bindSave("staff-book",f=>({staffCode:f.staffCode.value,day:f.day.value,start:minuteInput(f.start.value),name:f.name.value.trim()||"Telefontermin",phone:f.phone.value,serviceCode:f.serviceCode.value||null,duration:Number(f.duration.value)}),"Termin gespeichert.",body=>day=body.day);
}
function editEntry(x){
 const p=snapshot.staff.find(s=>s.id===x.staff_id);
 const past=new Date(x.starts_at).getTime()<=Date.now();
 replaceDialog("Termin bearbeiten",x.service_name_snapshot||"Telefontermin",'<form class="entry-form"><label>Kundenname<input name="name" value="'+esc(x.customer_name||"Telefontermin")+'" maxlength="100" required></label><label>Telefon<input name="phone" value="'+esc(x.customer_phone||"")+'" maxlength="40" type="tel"></label>'+(past?'<p class="subtle">Vergangene Termine können nur in ihren Kontaktdaten geändert werden.</p>':'<label>Mitarbeiterin<select name="staffCode">'+staffOptions(p?.code)+'</select></label><div class="form-row"><label>Datum<input name="day" type="date" min="'+today()+'" max="'+addDay(today(),365)+'" value="'+day+'" required></label><label>Uhrzeit<input name="start" type="time" step="900" value="'+clock(x.local.start)+'" required></label></div><label>Dauer<select name="duration">'+durationOptions(x.local.end-x.local.start)+'</select></label>')+'<p class="dialog-error" role="alert"></p><button class="primary" type="submit">Änderungen speichern</button></form>');
 bindSave("edit-entry",f=>({id:x.id,name:f.name.value,phone:f.phone.value,...(past?{}:{staffCode:f.staffCode.value,day:f.day.value,start:minuteInput(f.start.value),duration:Number(f.duration.value)})}),"Termin aktualisiert.",body=>{if(body.day)day=body.day;});
}
async function closureDialog(){
 if(!["owner","manager"].includes(snapshot.user.role))return toast("Nur für die Salonleitung.");
 try{await refreshAuth();const data=await request("closures");
 replaceDialog("Feiertage & Schließtage","Baden-Württemberg · gesamter Salon",'<div class="closure-settings"><section class="closure-panel"><h3>Betriebsurlaub / Schließtage</h3><p class="subtle">Gilt für das gesamte Team, auch für neu angelegte Mitarbeiter.</p><form class="entry-form"><div class="form-row"><label>Von<input name="day" type="date" min="'+today()+'" max="'+addDay(today(),365)+'" value="'+today()+'" required></label><label>Bis<input name="until" type="date" min="'+today()+'" max="'+addDay(today(),365)+'" value="'+today()+'" required></label></div><label>Bezeichnung<input name="name" maxlength="100" value="Betriebsurlaub"></label><p class="dialog-error" role="alert"></p><button class="primary" type="submit">Salon schließen</button></form><div class="closure-list">'+(data.closures.map(c=>'<div class="closure-row"><div><strong>'+esc(c.name)+'</strong><small>'+esc(label(c.first_day))+' – '+esc(label(c.last_day))+'</small></div><button type="button" data-release="'+esc(c.id)+'">Aufheben</button></div>').join("")||'<p class="subtle">Keine zusätzlichen Schließzeiten.</p>')+'</div></section><section class="closure-panel"><h3>Gesetzliche Feiertage</h3><p class="subtle">Automatisch berechnet und gesperrt. Freigabe nur, wenn die Öffnung rechtlich zulässig ist. Bestehende Arbeitszeiten und Urlaubszeiten gelten weiterhin.</p><div class="closure-list">'+data.holidays.map(h=>'<div class="closure-row"><div><strong>'+esc(h.name)+'</strong><small>'+esc(label(h.day))+'</small><span class="closure-status '+(h.open?"is-open":"is-closed")+'">'+(h.open?"Freigegeben":"Automatisch geschlossen")+'</span></div><button type="button" data-holiday="'+esc(h.day)+'" data-open="'+(!h.open)+'">'+(h.open?"Sperren":"Freigeben")+'</button></div>').join("")+'</div></section><p class="closure-error dialog-error" role="alert"></p></div>');
 const form=dialog.querySelector("form");form.elements.day.onchange=()=>{form.elements.until.min=form.elements.day.value;if(form.elements.until.value<form.elements.day.value)form.elements.until.value=form.elements.day.value;};
 async function change(action,body,button,error){button.disabled=true;error.textContent="";try{await refreshAuth();await request(action,{method:"POST",body});dialog.close();await load();toast("Schließzeiten aktualisiert.");await closureDialog();}catch(e){error.textContent=errorLabel(e);}finally{button.disabled=false;}}
 form.onsubmit=e=>{e.preventDefault();const f=form.elements;change("closure-add",{day:f.day.value,until:f.until.value,name:f.name.value},form.querySelector('[type=submit]'),form.querySelector(".dialog-error"));};
 dialog.querySelectorAll("[data-release]").forEach(b=>b.onclick=()=>{if(confirm("Diesen Schließzeitraum aufheben? Andere Sperren bleiben bestehen."))change("closure-remove",{id:b.dataset.release},b,dialog.querySelector(".closure-error"));});
 dialog.querySelectorAll("[data-holiday]").forEach(b=>b.onclick=()=>{const open=b.dataset.open==="true";if(open&&!confirm("Feiertag nur freigeben, wenn die Öffnung rechtlich zulässig ist. Fortfahren?"))return;change("holiday-toggle",{day:b.dataset.holiday,open},b,dialog.querySelector(".closure-error"));});
 }catch(e){toast(errorLabel(e));}
}
function absenceDialog(){
 replaceDialog("Urlaub / Schließtag","Ganze Tage zentral blockieren",'<form class="entry-form"><label>Für wen?<select name="staffCode">'+staffOptions(staffFilter,true)+'</select></label><div class="form-row"><label>Von<input name="day" type="date" min="'+today()+'" max="'+addDay(today(),365)+'" value="'+day+'" required></label><label>Bis einschließlich<input name="until" type="date" min="'+today()+'" max="'+addDay(today(),365)+'" value="'+day+'" required></label></div><label>Grund<input name="note" maxlength="100" placeholder="Urlaub / Schließtag"></label><p class="subtle">Bestehende Termine oder Sperren werden nicht überschrieben. Bei Konflikten bitte zuerst die betroffenen Einträge bearbeiten.</p><p class="dialog-error" role="alert"></p><button class="primary" type="submit">Zeitraum sperren</button></form>');
 bindSave("absence-range",f=>({staffCode:f.staffCode.value,day:f.day.value,until:f.until.value,note:f.note.value}),"Abwesenheit gespeichert.",body=>day=body.day);
}
function teamDialog(){
 replaceDialog("Team & Arbeitszeiten","Salonverwaltung",'<div class="team-settings">'+snapshot.staff.map(s=>'<div class="team-row"><div><strong>'+esc(s.name)+'</strong><small>'+esc(s.specialty)+'</small></div><button data-profile="'+esc(s.code)+'">Profil</button><button data-shifts="'+esc(s.code)+'">Arbeitszeiten</button></div>').join("")+'</div>');
 dialog.querySelectorAll("[data-profile]").forEach(b=>b.onclick=()=>profileDialog(snapshot.staff.find(s=>s.code===b.dataset.profile)));
 dialog.querySelectorAll("[data-shifts]").forEach(b=>b.onclick=()=>shiftsDialog(snapshot.staff.find(s=>s.code===b.dataset.shifts)));
}
function profileDialog(person){
 replaceDialog("Mitarbeiterprofil",person.name,'<form class="entry-form"><label>Name<input name="name" maxlength="80" required value="'+esc(person.name)+'"></label><label>Schwerpunkt<input name="specialty" maxlength="100" value="'+esc(person.specialty)+'"></label><p class="dialog-error" role="alert"></p><button class="primary" type="submit">Profil speichern</button></form>');
 bindSave("edit-profile",f=>({staffCode:person.code,name:f.name.value,specialty:f.specialty.value}),"Profil gespeichert.");
}
function shiftsDialog(person){
 const weekdays=[["Montag",1],["Dienstag",2],["Mittwoch",3],["Donnerstag",4],["Freitag",5],["Samstag",6],["Sonntag",0]];
 replaceDialog("Wochenarbeitszeiten",person.name+' · bis zu drei Zeitfenster pro Tag','<form class="entry-form"><p class="subtle">Leere Felder bedeuten frei. Pausen entstehen zwischen den Zeitfenstern. Änderungen gelten für alle Wochen.</p><div class="shift-settings">'+weekdays.map(([name,d])=>{const slots=snapshot.shifts.filter(s=>s.staff_id===person.id&&s.weekday===d).sort((a,b)=>a.start_minute-b.start_minute);return '<fieldset><legend>'+name+'</legend>'+Array.from({length:3},(_,i)=>'<div class="shift-line"><input aria-label="'+name+' Beginn '+(i+1)+'" name="a'+d+'_'+i+'" type="time" step="900" value="'+(slots[i]?clock(slots[i].start_minute):'')+'"><span>bis</span><input aria-label="'+name+' Ende '+(i+1)+'" name="b'+d+'_'+i+'" type="time" step="900" value="'+(slots[i]?clock(slots[i].end_minute):'')+'"></div>').join("")+'</fieldset>'}).join("")+'</div><p class="dialog-error" role="alert"></p><button class="primary" type="submit">Wochenplan speichern</button></form>');
 bindSave("edit-shifts",f=>{const shifts=[];for(const [,d] of weekdays)for(let i=0;i<3;i++){const a=f["a"+d+"_"+i].value,b=f["b"+d+"_"+i].value;if(!a&&!b)continue;if(!a||!b)throw Error("Bitte Beginn und Ende jedes Zeitfensters angeben.");const start=minuteInput(a),end=minuteInput(b);if(start>=end)throw Error("Ende muss nach Beginn liegen.");shifts.push({weekday:d,start_minute:start,end_minute:end});}return {staffCode:person.code,shifts};},"Arbeitszeiten gespeichert.");
}

logout.onclick=async()=>{const old=token;login();toast("Abgemeldet.");if(old)try{await fetch("https://xvxgqyrykkxdfadppoor.supabase.co/auth/v1/logout?scope=local",{method:"POST",headers:{apikey:KEY,Authorization:"Bearer "+old},cache:"no-store"});}catch{}};document.addEventListener("visibilitychange",()=>{if(!document.hidden&&token&&!dialog.open)load(true)});
login();
})();