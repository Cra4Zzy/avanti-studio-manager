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
const toast=s=>{const x=document.querySelector("#toast");x.textContent=s;x.classList.add("show");clearTimeout(x._timer);x._timer=setTimeout(()=>x.classList.remove("show"),3800)};
const errorLabel=e=>({"existing_appointments":"Der neue Arbeitsplan würde bestehende Termine ausschließen. Bitte zuerst verschieben.","invalid_shifts":"Arbeitszeiten prüfen: keine Überschneidungen, 15-Minuten-Raster.","invalid_profile":"Bitte Name und Profil prüfen.","invalid_booking":"Bitte Datum, Uhrzeit und Dauer prüfen.","entry_missing":"Der Eintrag ist nicht mehr vorhanden.","forbidden":"Keine Berechtigung für diese Aktion.","staff_unavailable":"Mitarbeiterin nicht verfügbar.","slot_taken":"Der Zeitraum wurde inzwischen belegt. Bitte andere Zeit wählen.","invalid_day":"Datum ungültig.","time_in_past":"Diese Uhrzeit liegt bereits in der Vergangenheit.","outside_working_hours":"Die Behandlung passt nicht in die Arbeitszeit oder Pause.","login_required":"Bitte neu anmelden.","session_invalid":"Sitzung abgelaufen. Bitte neu anmelden.","service_unavailable":"Leistung nicht verfügbar.","rate_limited":"Zu viele Anfragen.","request_failed":"Serveranfrage fehlgeschlagen."}[e.message]||e.message);
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
 sessionGeneration++;token="";refresh="";expires=0;snapshot=null;lastLoadedDay=null;loadError="";filterInitialized=false;staffFilter="all";clearInterval(poll);logout.hidden=true;account.textContent="";
 root.innerHTML='<div class="login-shell"><div class="login-intro"><div><span class="eyebrow">AVANTI / STUDIO MANAGER</span><h1>Dein Salon.<br>Dein Kalender.</h1></div><p>Alle Termine an einem Ort. Eintragen, sperren und freie Zeiten sofort über den gemeinsamen Server abgleichen.</p></div><div class="login-panel"><span class="eyebrow">GESCHÜTZTER MITARBEITERZUGANG</span><h2>Willkommen zurück.</h2><p>Melde dich mit deinem von der Salonleitung freigegebenen Konto an. Es werden keine Testpasswörter angelegt.</p><form id="login-form"><label>E-Mail-Adresse<input name="email" type="email" autocomplete="username" required></label><label>Passwort<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Verbinden & Kalender öffnen</button><div id="login-error" class="status-text" role="alert"></div></form><p class="subtle">Der Salonzugang wird einmalig von der Salonleitung eingerichtet. Keine öffentliche Registrierung.</p></div></div>';
 root.querySelector("#login-form").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector("button"),status=f.querySelector("#login-error");b.disabled=true;status.textContent="";try{await authenticate(f.elements.email.value,f.elements.password.value);await load();poll=setInterval(()=>{if(token&&!dialog.open&&!document.hidden)load(true)},25000)}catch(err){status.textContent=errorLabel(err);token="";refresh="";expires=0}finally{b.disabled=false}});
}
async function load(silent=false){
 if(busy)return;busy=true;const requestedDay=day,generation=sessionGeneration;
 try{await refreshAuth();const x=await request("studio",{body:{day}});
 if(generation!==sessionGeneration||!token)return;
 snapshot=x;lastLoadedDay=requestedDay;loadError="";logout.hidden=false;account.textContent=x.user.email+" · "+x.user.role;render(silent);
 }catch(e){if(generation!==sessionGeneration)return;if(["session_invalid","login_required","forbidden"].includes(e.message)){if(!snapshot)throw e;login();return;}loadError=errorLabel(e);if(lastLoadedDay&&snapshot){day=lastLoadedDay;render(true);}if(!silent)toast(loadError);if(!snapshot)throw e;}
 finally{busy=false}
}
function blocked(staff,t,end){
 const shifts=snapshot.shifts.filter(w=>w.staff_id===staff.id&&w.weekday===new Date(day+"T00:00:00Z").getUTCDay());
 const entry=snapshot.entries.find(e=>e.staff_id===staff.id&&t<e.local.end&&end>e.local.start);
 if(entry)return entry;
 if(!shifts.some(w=>t>=w.start_minute&&end<=w.end_minute))return "off";
 if(day<today()||day===today()&&t<=minute())return "past";
 return "free";
}
function freeFor(staff,t,len){if(t+len>1440)return false;for(let at=t;at<t+len;at+=15)if(blocked(staff,at,at+15)!=="free")return false;return true;}
function render(silent=false){
 if(dialog.open||!snapshot)return; if(silent&&root.querySelector(".workspace-card")&&["INPUT","SELECT"].includes(document.activeElement?.tagName)&&!loadError)return;
 const all=snapshot.staff,previous=root.querySelector(".calendar-scroll"),scrollTop=previous?.scrollTop||0,scrollLeft=previous?.scrollLeft||0;
 if(!filterInitialized){staffFilter=matchMedia("(max-width: 700px)").matches?(all[0]?.code||"all"):"all";filterInitialized=true;}
 if(staffFilter!=="all"&&!all.some(x=>x.code===staffFilter))staffFilter="all";
 const members=staffFilter==="all"?all:all.filter(x=>x.code===staffFilter);
 const ids=new Set(members.map(x=>x.id)),entries=snapshot.entries.filter(e=>e.kind==="appointment"&&ids.has(e.staff_id)),locks=snapshot.entries.filter(e=>e.kind==="absence"&&ids.has(e.staff_id));
 const shifts=snapshot.shifts.filter(w=>ids.has(w.staff_id)&&w.weekday===new Date(day+"T00:00:00Z").getUTCDay());
 const first=Math.min(480,...shifts.map(w=>Math.floor(w.start_minute/15)*15),...snapshot.entries.filter(e=>e.kind==="appointment"&&ids.has(e.staff_id)).map(e=>Math.floor(e.local.start/15)*15)),last=Math.min(1440,Math.max(1140,...shifts.map(w=>Math.ceil(w.end_minute/15)*15),...snapshot.entries.filter(e=>e.kind==="appointment"&&ids.has(e.staff_id)).map(e=>Math.ceil(e.local.end/15)*15)));
 const freeCount=members.reduce((sum,m)=>sum+Array.from({length:(last-first)/15},(_,i)=>first+i*15).filter(t=>blocked(m,t,t+15)==="free").length,0);
 const initials=name=>String(name||"").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
 const weekStart=addDay(day,-((new Date(day+"T00:00:00Z").getUTCDay()+6)%7));
 const week=Array.from({length:7},(_,i)=>addDay(weekStart,i)).map(d=>'<button type="button" class="week-chip" data-date="'+d+'" aria-pressed="'+(d===day)+'" '+(d<today()||d>addDay(today(),365)?'disabled':'')+'><span>'+esc(new Intl.DateTimeFormat("de-DE",{weekday:"short",timeZone:"UTC"}).format(new Date(d+"T00:00:00Z")))+'</span><strong>'+Number(d.slice(-2))+'</strong>'+(d===today()?'<small>Heute</small>':'')+'</button>').join("");
 root.innerHTML='<section class="workspace-hero"><div><span class="eyebrow">AVANTI · STUDIO MANAGER</span><h1>Salonkalender</h1><p>Termine und freie Zeiten auf einen Blick.</p></div><div class="sync-pill '+(loadError?'sync-error':'')+'" role="status"><i></i>'+esc(loadError?'Abgleich fehlgeschlagen · letzter Stand':'Server verbunden · Abgleich alle 25 s')+'</div></section>'+
 '<div class="stats"><div class="stat"><small>Termine</small><strong>'+entries.length+'</strong><span>Am ausgewählten Tag</span></div><div class="stat stat-free"><small>Freie 15-Min.-Slots</small><strong>'+freeCount+'</strong><span>In der aktuellen Auswahl</span></div><div class="stat stat-lock"><small>Zeitsperren</small><strong>'+locks.length+'</strong><span>Aktuell blockiert</span></div></div>'+
 '<section class="workspace-card"><div class="toolbar"><div class="day-controls"><button data-step="-1" aria-label="Vortag" '+(day<=today()?'disabled':'')+'>‹</button><button class="today-button" data-date="'+today()+'">Heute</button><button data-step="1" aria-label="Nächster Tag" '+(day>=addDay(today(),365)?'disabled':'')+'>›</button></div><div class="date-title"><strong>'+esc(label(day))+'</strong><input type="date" id="date" value="'+esc(day)+'" min="'+today()+'" max="'+addDay(today(),365)+'" aria-label="Datum wählen"></div><button class="refresh" id="refresh" aria-label="Kalender aktualisieren">↻ <span>Aktualisieren</span></button></div>'+
 '<div class="week-strip" aria-label="Wochentage">'+week+'</div>'+
 '<div class="filter-line"><div><label for="staff-filter">Mitarbeiterin</label><select id="staff-filter"><option value="all" '+(staffFilter==="all"?'selected':'')+'>Gesamtes Team</option>'+all.map(m=>'<option value="'+esc(m.code)+'" '+(staffFilter===m.code?'selected':'')+'>'+esc(m.name)+'</option>').join("")+'</select></div><div class="legend"><span><i class="l-free"></i>Frei</span><span><i class="l-booked"></i>Termin</span><span><i class="l-block"></i>Gesperrt</span><span><i class="l-off"></i>Außer Dienst / Pause</span></div></div>'+
 '<div class="calendar-help">Freie Zeit antippen, um einen Telefontermin anzulegen oder die Zeit zu sperren.</div>'+
 (members.length?'<div class="calendar-scroll" tabindex="0" aria-label="Tageskalender"><div class="calendar-grid" style="--team-count:'+members.length+'"><div class="cal-corner">Uhrzeit</div>'+members.map(x=>'<div class="cal-head"><span class="person-initial">'+esc(initials(x.name))+'</span><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.specialty||"Mitarbeiterin")+'</small></div></div>').join("")+
 Array.from({length:(last-first)/15},(_,i)=>{const at=first+i*15;return '<div class="cal-time '+(at%60===0?'hour':'')+'">'+clock(at)+'</div>'+members.map(member=>{const v=blocked(member,at,at+15),isEntry=typeof v==="object",status=isEntry?(v.kind==="absence"?"absence":"booked"):v;const lead=isEntry&&at===Math.max(first,Math.floor(v.local.start/15)*15),name=isEntry?(v.kind==="absence"?"Gesperrt":(v.customer_name||"Termin")):(v==="free"?"+ Frei":v==="past"?"Vergangen":"");const detail=lead?(clock(v.local.start)+"–"+clock(v.local.end)+(v.kind==="appointment"&&v.service_name_snapshot?" · "+v.service_name_snapshot:"")):"";const attr=isEntry?'data-entry="'+esc(v.id)+'"':v==="free"?'data-free="'+at+'" data-staff="'+esc(member.code)+'"':'disabled';return '<button type="button" class="cal-cell '+status+(at%60===0?" hour":"")+(isEntry&&!lead?" continuation":"")+'" '+attr+' aria-label="'+esc(member.name+" "+clock(at)+" "+name)+'"><span class="label">'+esc(isEntry&&!lead?"":name)+'</span>'+(detail?'<small>'+esc(detail)+'</small>':"")+'</button>'}).join("")}).join("")+'</div></div>':'<p class="notice">Noch keine Mitarbeiterprofile vorhanden.</p>')+
 '</section><p class="subtle">Gemeinsamer Salonkalender · Änderungen werden zentral gespeichert.</p>';
 function navigate(d){if(busy||d<today()||d>addDay(today(),365))return;day=d;load();}
 root.querySelectorAll("[data-step]").forEach(b=>b.onclick=()=>navigate(addDay(day,Number(b.dataset.step))));
 root.querySelectorAll("[data-date]").forEach(b=>b.onclick=()=>navigate(b.dataset.date));
 root.querySelector("#date").onchange=e=>{if(busy){e.target.value=day;return;}if(isDate(e.target.value))navigate(e.target.value)};
 root.querySelector("#refresh").onclick=()=>load();
 const tools=document.createElement("div");tools.className="studio-tools";
 tools.innerHTML='<button type="button" class="primary" id="quick-book">+ Telefontermin</button><button type="button" id="absence-range">Urlaub / Schließtag</button>'+(['owner','manager'].includes(snapshot.user.role)?'<button type="button" id="team-settings">Team & Arbeitszeiten</button>':'');
 root.querySelector(".workspace-card").before(tools);
 tools.querySelector("#quick-book").onclick=()=>quickBook();
 tools.querySelector("#absence-range").onclick=()=>absenceDialog();
 if(tools.querySelector("#team-settings"))tools.querySelector("#team-settings").onclick=()=>teamDialog();
 root.querySelector("#staff-filter").onchange=e=>{staffFilter=e.target.value;e.target.blur();render(true);root.querySelector("#staff-filter").focus()};
 root.querySelectorAll("[data-free]").forEach(b=>b.onclick=()=>{if(!busy)choice(b.dataset.staff,Number(b.dataset.free))});
 root.querySelectorAll("[data-entry]").forEach(b=>b.onclick=()=>{if(!busy)showEntry(b.dataset.entry)});
 if(silent&&previous){const current=root.querySelector(".calendar-scroll");if(current){current.scrollTop=scrollTop;current.scrollLeft=scrollLeft;}}
}
function header(title,caption){return '<div class="dialog-top"><div><span class="eyebrow">AVANTI / TERMINPLANUNG</span><h2>'+esc(title)+'</h2></div><button class="icon-close" type="button" data-close aria-label="Schließen">×</button></div><div class="dialog-context">'+esc(caption)+'</div>'}
function openDialog(html){dialog.innerHTML='<div class="dialog-body">'+html+'</div>';dialog.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>dialog.close());dialog.showModal();}
function choice(code,start){const person=snapshot.staff.find(s=>s.code===code);if(!person)return;openDialog(header("Freie Zeit auswählen",person.name+" · "+label(day)+" · "+clock(start)+" Uhr")+'<p class="subtle">Wähle, was du mit diesem freien Zeitraum machen möchtest.</p><div class="dialog-choices"><button class="primary" id="book-choice">＋ Telefontermin eintragen</button><button id="block-choice">Zeit sperren</button></div>');
 dialog.querySelector("#book-choice").onclick=()=>bookDialog(person,start);
 dialog.querySelector("#block-choice").onclick=()=>blockDialog(person,start);
}
function bookDialog(person,start){
 const services=snapshot.services.filter(s=>snapshot.assignments?.some(a=>a.staff_id===person.id&&a.service_id===s.id)&&freeFor(person,start,s.duration));const lengths=Array.from({length:32},(_,i)=>(i+1)*15).filter(n=>freeFor(person,start,n));if(!lengths.length)return toast("Zeitfenster nicht mehr frei.");
 dialog.close();
 openDialog(header("Telefontermin",person.name+" · "+label(day)+" · "+clock(start)+" Uhr")+'<form class="entry-form" id="entry-form"><label>Behandlung<select name="serviceCode"><option value="">Andere Dauer / ohne Behandlung</option>'+services.map(s=>'<option value="'+esc(s.code)+'">'+esc(s.name)+' · '+s.duration+' Min.</option>').join("")+'</select></label><div class="form-row"><label>Kundenname<input name="name" maxlength="100" placeholder="Telefontermin" autocomplete="off"></label><label>Telefon (optional)<input name="phone" type="tel" maxlength="40" autocomplete="off"></label></div><label>Dauer<select name="duration">'+lengths.map(n=>'<option value="'+n+'" '+(n===30?"selected":"")+'>'+n+' Minuten</option>').join("")+'</select></label><div id="booking-span" class="dialog-context"></div><div class="subtle">Die gewählte Behandlungsdauer wird vollständig reserviert. Speichern erfolgt im gemeinsamen Salonkalender.</div><p class="dialog-error" role="alert"></p><button class="primary" type="submit">Termin verbindlich speichern</button></form>');
 const form=dialog.querySelector("form"),f=form.elements;function sync(){const s=snapshot.services.find(s=>s.code===f.serviceCode.value);if(s)f.duration.value=String(s.duration);f.duration.disabled=!!s;dialog.querySelector("#booking-span").textContent=clock(start)+" bis "+clock(start+Number(f.duration.value))+" Uhr";}f.serviceCode.onchange=sync;f.duration.onchange=sync;sync();
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;try{await refreshAuth();await request("staff-book",{method:"POST",body:{staffCode:person.code,serviceCode:f.serviceCode.value||null,day,start,name:f.name.value.trim()||"Telefontermin",phone:f.phone.value,duration:Number(f.duration.value)}});dialog.close();toast("Termin zentral gespeichert.");await load()}catch(err){form.querySelector(".dialog-error").textContent=errorLabel(err)}finally{button.disabled=false}};
}
function blockDialog(person,start){
 const lengths=Array.from({length:96},(_,i)=>(i+1)*15).filter(n=>freeFor(person,start,n));if(!lengths.length)return toast("Zeitfenster nicht mehr frei.");
 dialog.close();openDialog(header("Zeit sperren",person.name+" · "+label(day)+" · "+clock(start))+'<form id="block-form" class="entry-form"><label>Dauer<select name="duration">'+lengths.map(n=>'<option value="'+n+'">'+n+' Minuten · bis '+clock(start+n)+'</option>').join("")+'</select></label><label>Grund (optional)<input name="note" maxlength="100" placeholder="Nicht verfügbar"></label><p class="dialog-error" role="alert"></p><button class="primary">Zeit im Salonkalender sperren</button></form>');
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
 try{const body=read(form.elements);await refreshAuth();await request(action,{method:"POST",body});dialog.close();toast(success);if(onDone)onDone(body);await load();}
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