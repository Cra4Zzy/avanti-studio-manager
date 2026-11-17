// Local pilot only: all intervals are minutes of a Berlin calendar day.
export const today=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function addDays(d,n){const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);}
export const time=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
export const parseTime=s=>{const [h,m]=String(s).split(':').map(Number);return h>=0&&h<24&&m>=0&&m<60?h*60+m:NaN;};
export function initialState(){const services=[{id:'cut',name:'Herrenhaarschnitt',duration:30,price:19},{id:'dry',name:'Damen-Trockenhaarschnitt',duration:45,price:30},{id:'child',name:'Kinderhaarschnitt',duration:30,price:15},{id:'brow',name:'Augenbrauen zupfen',duration:15,price:6}];return {version:1,services,staff:['Daniela','Sofia','Melina','Vanessa','Jennifer'].map((name,i)=>({id:'s'+i,name,specialty:['Salonleitung','Schnitt & Styling','Farbe & Styling','Schnitt & Pflege','Styling & Beauty'][i],photo:'',demoPortrait:i,days:i===1?[1,2,3,4,5]:[1,2,3,4,5,6],start:540+(i<3?i*30:0),end:1080,breakStart:780,breakEnd:825,services:services.map(s=>s.id)})),appointments:[],absences:[]};}
export function availableSlots({shifts,blocks=[],durationMinutes,stepMinutes=15,notBefore=0,notAfter=1440}){
 if(!Number.isInteger(durationMinutes)||durationMinutes<=0||!Number.isInteger(stepMinutes)||stepMinutes<=0)throw Error('Ungültige Dauer');
 const out=[];for(const w of shifts){for(let start=w.start+Math.ceil(Math.max(0,notBefore-w.start)/stepMinutes)*stepMinutes;start+durationMinutes<=Math.min(w.end,notAfter);start+=stepMinutes){const end=start+durationMinutes;if(!blocks.some(b=>start<b.end&&b.start<end))out.push({start,end});}}
 return out;
}
// Recurring weekday schedules with backwards-compatible defaults.
export function weekdayShift(member,dow){
 if(!member)return null;
 if(member.weeklySchedule)return member.weeklySchedule[dow]||null;
 return member.days.includes(dow)?{start:member.start,end:member.end,breakStart:member.breakStart,breakEnd:member.breakEnd}:null;
}
export function dayShift(member,date){return validDay(date)?weekdayShift(member,new Date(date+'T00:00:00Z').getUTCDay()):null;}
export function setWeeklySchedule(state,id,schedule,now=new Date()){
 const member=activeStaff(state).find(s=>s.id===id);if(!member)throw Error('Profil nicht gefunden.');
 const plan={};for(let d=0;d<7;d++){const v=schedule[d];if(!v)continue;
 const {start,end,breakStart,breakEnd}=v;
 if(![start,end,breakStart,breakEnd].every(n=>Number.isInteger(n)&&n%15===0)||start<0||end>1440||start>=end||breakStart<start||breakEnd> end||breakEnd<breakStart)throw Error('Arbeitszeit oder Pause ungültig. Bitte 15-Minuten-Schritte verwenden.');
 plan[d]={start,end,breakStart,breakEnd};}
 const date=today(now),minute=berlinMinute(now);
 const conflicts=a=>{if(a.staffId!==id||a.day<date||a.day===date&&a.end<=minute)return false;const v=plan[new Date(a.day+'T00:00:00Z').getUTCDay()];return !v||a.start<v.start||a.end>v.end||(v.breakEnd>v.breakStart&&a.start<v.breakEnd&&v.breakStart<a.end);};
 if(state.appointments.some(a=>a.status==='confirmed'&&conflicts(a))||state.absences.some(a=>a.quickSlot===true&&conflicts(a)))throw Error('Die neuen Arbeitszeiten überschneiden sich mit bestehenden Terminen oder Telefon-/Salonslots. Bitte zuerst im Kalender klären.');
 return {...state,staff:state.staff.map(s=>s.id===id?{...s,weeklySchedule:plan}:s)};
}
// All booking paths share the same interval validation.
export function validDay(day){return typeof day==='string'&&/^\d{4}-\d\d-\d\d$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;}
export function freeSlots(state,{day,staffId,durationMinutes=15,serviceId=null,excludeId=null,now=new Date()}){
 const s=state.staff.find(x=>x.id===staffId),shift=dayShift(s,day);
 if(!validDay(day)||day<today(now)||day>addDays(today(now),90)||!s||s.archived===true||!shift||salonClosure(state,day)||!Number.isInteger(durationMinutes)||durationMinutes<15||durationMinutes>480||durationMinutes%15!==0)return [];
 if(serviceId&&(!state.services.some(v=>v.id===serviceId)||!s.services.includes(serviceId)))return [];
 const blocks=[...state.appointments.filter(a=>a.status==='confirmed'&&a.day===day&&a.staffId===staffId&&a.id!==excludeId),...state.absences.filter(a=>a.day===day&&a.staffId===staffId&&a.id!==excludeId)];
 if(shift.breakEnd>shift.breakStart)blocks.push({start:shift.breakStart,end:shift.breakEnd});
 let earliest=0;if(day===today(now)){const [h,m]=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number);earliest=h*60+m+1;}
 return availableSlots({shifts:[{start:shift.start,end:shift.end}],blocks,durationMinutes,notBefore:earliest});
}
export function slots(state,input){
 const service=state.services.find(x=>x.id===input.serviceId);if(!service)return [];
 return freeSlots(state,{...input,durationMinutes:service.duration});
}
export function book(state,input,now=new Date(),newId=()=>globalThis.crypto.randomUUID()){
 const old=input.id?state.appointments.find(a=>a.id===input.id&&a.status==='confirmed'):null;
 if(input.id&&!old)throw Error('Termin nicht gefunden.');
 const source=old?.source||(input.source==='manual'?'manual':'online');
 const serviceId=input.serviceId||null;
 if(source==='online'&&!serviceId)throw Error('Bitte eine Behandlung auswählen.');
 const duration=Number(input.durationMinutes??(old&&old.serviceId===serviceId?old.end-old.start:state.services.find(v=>v.id===serviceId)?.duration));
 const allowed=source==='manual'||old?freeSlots(state,{...input,serviceId,durationMinutes:duration,excludeId:old?.id,now}):slots(state,{...input,serviceId,now});
 const slot=allowed.find(x=>x.start===Number(input.start));if(!slot)throw Error('Dieser Zeitraum ist nicht mehr verfügbar. Bitte eine andere Zeit oder Dauer wählen.');
 const name=String(input.name??old?.name??'').trim().slice(0,80)||(source==='manual'?'Telefontermin':'');if(!name)throw Error('Bitte einen Testnamen eingeben.');
 const phone=String(input.phone??old?.phone??'').trim();if(phone.length>40||phone&&!/^[+0-9()\s./-]+$/.test(phone))throw Error('Bitte eine gültige Telefonnummer eingeben.');
 const a={id:old?.id||newId(),day:input.day,staffId:input.staffId,serviceId,start:slot.start,end:slot.end,name,phone,email:normalizeEmail(input.email??old?.email??''),status:'confirmed',source};
 return {...state,appointments:[...state.appointments.filter(x=>x.id!==a.id),a]};
}
export function blockTime(state,input,now=new Date(),newId=()=>globalThis.crypto.randomUUID()){
 const {day,staffId}=input,start=Number(input.start),end=start+Number(input.durationMinutes);
 const old=input.id?state.absences.find(a=>a.id===input.id):null;if(input.id&&!old)throw Error('Sperre nicht gefunden.');
 if(!validDay(day)||day<today(now)||day>addDays(today(now),90)||!state.staff.some(x=>x.id===staffId&&x.archived!==true)||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>1440||end<=start||end-start>1440)throw Error('Ungültiger Zeitraum.');
 const blocked=[...state.appointments.filter(a=>a.status==='confirmed'),...state.absences].some(a=>a.id!==old?.id&&a.day===day&&a.staffId===staffId&&start<a.end&&a.start<end);
 if(blocked)throw Error('Der Zeitraum überschneidet sich mit einem Termin oder einer Sperre.');
 const a={id:old?.id||newId(),day,staffId,start,end,reason:String(input.reason||'Nicht verfügbar').trim().slice(0,80)||'Nicht verfügbar'};
 return {...state,absences:[...state.absences.filter(x=>x.id!==a.id),a]};
}
export function cancel(state,id){return {...state,appointments:state.appointments.map(a=>a.id===id?{...a,status:'cancelled'}:a)};}

// Upgrade the old local demo without losing bookings, edits or uploaded photos.
export function upgradeDemo(state){
 const defaults=initialState(),legacy=['Team A','Team B','Team C'];
 if(!state||state.version!==1||!Array.isArray(state.staff))return defaults;
 const existing=state.staff.map(member=>{const d=defaults.staff.find(x=>x.id===member.id);if(!d)return member;return {...member,name:legacy.includes(member.name)&&member.name===legacy[Number(member.id.slice(1))]?d.name:member.name,specialty:legacy.includes(member.name)&&member.specialty==='Schnitt & Styling'?d.specialty:member.specialty,demoPortrait:d.demoPortrait};});
 for(const d of defaults.staff)if(!existing.some(x=>x.id===d.id))existing.push({...d,services:state.services.map(v=>v.id)});
 return {...state,staff:existing.map(member=>({...member,services:state.services.map(v=>v.id)}))};
}

 // Validate every day before returning a new state; never partially save a range.
export function blockRange(state,{day,lastDay=day,staffId,start,end,reason,id=null},now=new Date(),newId=()=>globalThis.crypto.randomUUID()){
 if(!validDay(day)||!validDay(lastDay)||lastDay<day||day<today(now)||lastDay>addDays(today(now),90)||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>1440||end<=start)throw Error('Bitte einen gültigen Zeitraum innerhalb der nächsten 90 Tage wählen.');
 if(id&&lastDay!==day)throw Error('Bestehende einzelne Sperren können nur für einen Tag geändert werden.');
 let next=state;
 for(let d=day;d<=lastDay;d=addDays(d,1)){
  try{next=blockTime(next,{day:d,staffId,start,durationMinutes:end-start,reason,id},now,newId);}
  catch(err){throw Error(d.split('-').reverse().join('.')+': '+err.message);}
 }
 return next;
}

/* Only explicitly created quick slots may be released with a single click. */
export function toggleQuickSlot(state,{day,staffId,start},now=new Date(),newId=()=>globalThis.crypto.randomUUID()){
 if(!Number.isInteger(start)||start%15||!validDay(day)||day<today(now)||day>addDays(today(now),90)||!state.staff.some(s=>s.id===staffId&&s.archived!==true))throw Error('Dieser Zeitslot ist nicht verfügbar.');
 if(state.absences.some(a=>a.day===day&&a.staffId===staffId&&a.wholeDay===true))throw Error('Bitte zuerst die Tagessperre aufheben.');
 const own=state.absences.find(a=>a.quickSlot===true&&a.day===day&&a.staffId===staffId&&a.start===start&&a.end===start+15);
 if(own)return {...state,absences:state.absences.filter(a=>a.id!==own.id)};
 if(!freeSlots(state,{day,staffId,now,durationMinutes:15}).some(a=>a.start===start))throw Error('Dieser Zeitslot ist bereits belegt oder liegt außerhalb der Arbeitszeit.');
 const next=blockTime(state,{day,staffId,start,durationMinutes:15,reason:'Telefon / Salon'},now,newId);
 return {...next,absences:next.absences.map((a,i)=>i===next.absences.length-1?{...a,quickSlot:true}:a)};
}
export function quickDay(state,{day,staffId},now=new Date()){
 const s=state.staff.find(x=>x.id===staffId);if(!s||!validDay(day))return [];
 const shift=dayShift(s,day),working=Boolean(shift);
 const free=new Set(freeSlots(state,{day,staffId,now,durationMinutes:15}).map(a=>a.start));
 const appointments=state.appointments.filter(a=>a.day===day&&a.staffId===staffId&&a.status==='confirmed');
 const blocks=state.absences.filter(a=>a.day===day&&a.staffId===staffId);
 const min=Math.min(shift?.start??s.start,...appointments.map(a=>a.start)),max=Math.max(shift?.end??s.end,...appointments.map(a=>a.end));
 const result=[];for(let start=Math.floor(min/15)*15;start<max;start+=15){
  const end=start+15,overlaps=a=>start<a.end&&a.start<end;
  const appointment=appointments.find(overlaps),block=blocks.find(a=>a.vacationId)||blocks.find(a=>a.wholeDay===true)||blocks.find(overlaps);
  let status='unavailable';
  if(appointment)status='booked';
  else if(salonClosure(state,day))status='closed';
  else if(block?.vacationId)status='vacation';
  else if(block?.wholeDay===true)status='wholeDay';
  else if(block)status=block.quickSlot===true&&block.start===start&&block.end===end&&day>=today(now)&&day<=addDays(today(now),90)?'quick':'absence';
  else if(free.has(start))status='free';
  else if(!working||start<shift.start||end>shift.end)status='off';
  else if(shift.breakEnd>shift.breakStart&&start<shift.breakEnd&&shift.breakStart<end)status='pause';
  else if(day<today(now)||day===today(now)&&start<=berlinMinute(now))status='past';
  result.push({start,end,status,appointmentId:appointment?.id,blockId:block?.id,label:appointment?.name||salonClosure(state,day)?.name||block?.reason||'',source:appointment?.source});
 }return result;
}

function berlinMinute(now){const [h,m]=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number);return h*60+m;}
export function nextWorkday(state,staffId,now=new Date()){
 const s=state.staff.find(x=>x.id===staffId),d=today(now);
 if(!s)return d;
 for(let i=0;i<=90;i++){const date=addDays(d,i),shift=dayShift(s,date);if(shift&&!salonClosure(state,date)&&(i>0||berlinMinute(now)<shift.end))return date;}
 return d;
}
export function toggleWholeDay(state,{day,staffId},now=new Date(),newId=()=>globalThis.crypto.randomUUID()){
 if(!validDay(day)||day<today(now)||day>addDays(today(now),90)||!state.staff.some(s=>s.id===staffId&&s.archived!==true))throw Error('Bitte einen gültigen Tag auswählen.');
 if(state.absences.some(a=>a.day===day&&a.staffId===staffId&&a.vacationId))throw Error('Bitte den Urlaub über Urlaub / mehrere Tage verwalten.');
 const own=state.absences.find(a=>a.day===day&&a.staffId===staffId&&a.wholeDay===true);
 if(own)return {...state,absences:state.absences.filter(a=>a.id!==own.id)};
 return {...state,absences:[...state.absences,{id:newId(),day,staffId,start:0,end:1440,reason:'Tag gesperrt',wholeDay:true}]};
}

/* Staff administration: keep historical references and prevent removing future appointment capacity silently. */
export const activeStaff=state=>state.staff.filter(s=>s.archived!==true);
export function addStaff(state,input,newId=()=>globalThis.crypto.randomUUID()){
 const name=String(input.name||'').trim(),specialty=String(input.specialty||'').trim(),id=newId();
 if(!name||name.length>40||specialty.length>80||state.staff.some(s=>s.id===id))throw Error('Ungültiges Mitarbeiterprofil.');
 const member={id,name,specialty,photo:input.photo||'',days:[1,2,3,4,5,6],start:540,end:1080,breakStart:780,breakEnd:825,services:state.services.map(v=>v.id),archived:false};
 return {...state,staff:[...state.staff,member]};
}
export function setStaffArchived(state,id,archived,now=new Date()){
 const member=state.staff.find(s=>s.id===id);if(!member)throw Error('Profil nicht gefunden.');
 if(archived){
  const date=today(now),minute=berlinMinute(now),upcoming=a=>a.staffId===id&&(a.day>date||a.day===date&&a.end>minute);
  if(state.appointments.some(a=>a.status==='confirmed'&&upcoming(a)))throw Error('Bitte zuerst die noch offenen Kundentermine verschieben oder stornieren.');
  if(state.absences.some(a=>a.quickSlot===true&&upcoming(a)))throw Error('Bitte zuerst die offenen Telefon-/Salonslots im Kalender klären und freigeben.');
 }
 return {...state,staff:state.staff.map(s=>s.id===id?{...s,archived:Boolean(archived)}:s)};
}

export function vacationRanges(state,staffId){
 const groups=new Map();for(const a of state.absences){if(!a.vacationId||a.staffId!==staffId)continue;const v=groups.get(a.vacationId);if(v){if(a.day<v.start)v.start=a.day;if(a.day>v.end)v.end=a.day;}else groups.set(a.vacationId,{id:a.vacationId,start:a.day,end:a.day});}return [...groups.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
export function vacationConflicts(state,{staffId,start,end},now=new Date()){
 const upcoming=a=>a.staffId===staffId&&a.day>=start&&a.day<=end&&(a.day>today(now)||a.day===today(now)&&a.end>berlinMinute(now));
 return [...state.appointments.filter(a=>a.status==='confirmed'&&upcoming(a)),...state.absences.filter(a=>a.quickSlot===true&&upcoming(a))].sort((a,b)=>a.day.localeCompare(b.day)||a.start-b.start);
}
export function addVacation(state,{staffId,start,end,acknowledge=false},now=new Date(),newId=()=>globalThis.crypto.randomUUID()){
 if(!activeStaff(state).some(s=>s.id===staffId)||!validDay(start)||!validDay(end)||start<today(now)||end<start||end>addDays(today(now),365))throw Error('Bitte einen gültigen Zeitraum innerhalb der nächsten 365 Tage auswählen.');
 if(vacationRanges(state,staffId).some(v=>start<=v.end&&v.start<=end))throw Error('In diesem Zeitraum liegt bereits Urlaub. Bitte zuerst den bestehenden Zeitraum verwalten.');
 if(vacationConflicts(state,{staffId,start,end},now).length&&!acknowledge)throw Error('Bestehende Termine oder Telefon-/Salonslots müssen berücksichtigt werden.');
 const vacationId=newId(),blocks=[];for(let d=start;d<=end;d=addDays(d,1))blocks.push({id:vacationId+':'+d,vacationId,staffId,day:d,start:0,end:1440,reason:'Urlaub',wholeDay:true});
 return {...state,absences:[...state.absences,...blocks]};
}
export function removeVacation(state,{staffId,id},now=new Date()){
 if(!activeStaff(state).some(s=>s.id===staffId)||!vacationRanges(state,staffId).some(v=>v.id===id))throw Error('Urlaub nicht gefunden.');
 return {...state,absences:state.absences.filter(a=>a.staffId!==staffId||a.vacationId!==id||a.day<today(now))};
}

/* Appointment actions preserve the identity, source, duration and contact data. */
export function moveAppointment(state,id,{day,staffId,start},now=new Date()){
 const old=state.appointments.find(a=>a.id===id&&a.status==='confirmed');if(!old)throw Error('Termin nicht mehr vorhanden.');
 return book(state,{...old,day,staffId,start,durationMinutes:old.end-old.start},now);
}
export function restoreAppointment(state,id,now=new Date()){
 const old=state.appointments.find(a=>a.id===id&&a.status==='cancelled');if(!old)throw Error('Abgesagter Termin nicht gefunden.');
 const valid=freeSlots(state,{day:old.day,staffId:old.staffId,durationMinutes:old.end-old.start,serviceId:old.serviceId,now}).some(t=>t.start===old.start);
 if(!valid)throw Error('Der ursprüngliche Zeitraum ist nicht mehr verfügbar.');
 return {...state,appointments:state.appointments.map(a=>a.id===id?{...a,status:'confirmed'}:a)};
}
export function updateAppointmentContact(state,id,input){
 const old=state.appointments.find(a=>a.id===id&&a.status==='confirmed');if(!old)throw Error('Termin nicht mehr vorhanden.');
 const name=String(input.name??old.name??'').trim().slice(0,80)||(old.source==='manual'?'Telefontermin':'');if(!name)throw Error('Bitte einen Testnamen eingeben.');
 const phone=String(input.phone??old.phone??'').trim();if(phone.length>40||phone&&!/^[+0-9()\s./-]+$/.test(phone))throw Error('Bitte eine gültige Telefonnummer eingeben.');
 return {...state,appointments:state.appointments.map(a=>a.id===id?{...a,name,phone,email:normalizeEmail(input.email??old.email??'')}:a)};
}

export function normalizeEmail(value,required=false){
 const email=String(value??'').trim();
 if(!email&&!required)return '';
 if(email.length>254||! /^[^\s@<>]+@[^\s@<>.]+(?:\.[^\s@<>.]+)+$/.test(email)||/[\u0000-\u001f\u007f]/.test(email))throw Error('Bitte eine gültige E-Mail-Adresse eingeben.');
 return email;
}
const mailEscape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Provider-neutral message. Production: trigger only after server-confirmed booking.
export function bookingConfirmation(state,id){
 const a=state.appointments.find(x=>x.id===id&&x.status==='confirmed');if(!a)throw Error('Termin nicht bestätigt.');
 const to=normalizeEmail(a.email,true),person=state.staff.find(s=>s.id===a.staffId),service=state.services.find(s=>s.id===a.serviceId);if(!person)throw Error('Mitarbeiterprofil nicht gefunden.');
 const date=new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(a.day+'T00:00:00Z'));
 const details=[['Datum',date],['Uhrzeit',time(a.start)+'–'+time(a.end)+' Uhr'],['Behandlung',service?.name||'Telefontermin'],['Stylistin',person.name],['Dauer',(a.end-a.start)+' Minuten'],['Salon','In den Sandäckern 2 · Wallhausen']];
 const subject='Dein Termin bei Haarstudio Avanti ist bestätigt',intro='Hallo '+a.name+', vielen Dank für deine Buchung. Wir freuen uns auf deinen Besuch!',end='Falls du deinen Termin ändern oder absagen möchtest, melde dich bitte beim Salon.';
 const text=intro+'\n\n'+details.map(([k,v])=>k+': '+v).join('\n')+'\n\n'+end+'\nhttps://haarstudio-avanti.de/\n\nDein Avanti-Team';
 const html='<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f5f2ed;color:#29231f;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;background:#fffefa;border:1px solid #ded6c8;border-radius:16px"><tr><td style="padding:26px;background:#262a25;color:#fff;border-radius:16px 16px 0 0"><div style="font:italic 40px Georgia,serif">Avanti</div><div style="font-size:11px;letter-spacing:2px">HAARSTUDIO</div></td></tr><tr><td style="padding:30px 24px"><p style="font-size:12px;font-weight:bold;color:#496450;letter-spacing:1px">TERMIN BESTÄTIGT</p><h1 style="font:normal 30px Georgia,serif;margin:12px 0 20px">Wir freuen uns auf dich.</h1><p style="line-height:1.6">'+mailEscape(intro)+'</p><table role="presentation" width="100%" cellspacing="0" cellpadding="6" style="background:#f1f0ec;border-radius:10px;margin:22px 0;padding:10px">'+details.map(([k,v])=>'<tr><td style="font-size:13px;color:#51594d">'+mailEscape(k)+'</td><td style="font-size:14px;font-weight:bold">'+mailEscape(v)+'</td></tr>').join('')+'</table><p style="line-height:1.6">'+mailEscape(end)+'</p><p><a href="https://haarstudio-avanti.de/" style="color:#496450;font-weight:bold">Zur Salonwebsite</a></p><p>Dein Avanti-Team</p></td></tr></table></td></tr></table></body></html>';
 return {to,subject,text,html};
}

const holidayCache=new Map();
export function bwHolidays(year){
 if(holidayCache.has(year))return holidayCache.get(year);
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;
 const easter=year+'-'+String(Math.floor(n/31)).padStart(2,'0')+'-'+String(n%31+1).padStart(2,'0');
 const fixed=[['01-01','Neujahr'],['01-06','Heilige Drei Könige'],['05-01','Tag der Arbeit'],['10-03','Tag der Deutschen Einheit'],['11-01','Allerheiligen'],['12-25','1. Weihnachtsfeiertag'],['12-26','2. Weihnachtsfeiertag']].map(([date,name])=>({date:year+'-'+date,name}));
 const movable=[[-2,'Karfreitag'],[1,'Ostermontag'],[39,'Christi Himmelfahrt'],[50,'Pfingstmontag'],[60,'Fronleichnam']].map(([offset,name])=>({date:addDays(easter,offset),name}));
 const result=[...fixed,...movable].sort((a,b)=>a.date.localeCompare(b.date));holidayCache.set(year,result);return result;
}
export function salonClosure(state,date){
 if(!validDay(date))return null;
 const custom=(state.closures||[]).find(x=>x.start<=date&&date<=x.end);if(custom)return {name:custom.name,kind:'custom'};
 const holiday=bwHolidays(Number(date.slice(0,4))).find(x=>x.date===date);
 return holiday&&!(state.openHolidays||[]).includes(date)?{name:holiday.name,kind:'holiday'}:null;
}
export function closureConflicts(state,start,end,now=new Date()){
 const upcoming=a=>a.day>=start&&a.day<=end&&(a.day>today(now)||a.day===today(now)&&a.end>berlinMinute(now));
 return [...state.appointments.filter(a=>a.status==='confirmed'&&upcoming(a)),...state.absences.filter(a=>a.quickSlot&&upcoming(a))];
}
export function addClosure(state,{start,end,name,acknowledge=false},now=new Date(),newId=()=>globalThis.crypto.randomUUID()){
 if(!validDay(start)||!validDay(end)||start<today(now)||end<start||end>addDays(today(now),365))throw Error('Bitte einen gültigen Zeitraum innerhalb der nächsten 365 Tage wählen.');
 if((state.closures||[]).some(x=>start<=x.end&&x.start<=end))throw Error('Es gibt bereits einen Schließzeitraum, der sich überschneidet.');
 if(closureConflicts(state,start,end,now).length&&!acknowledge)throw Error('Bitte bestehende Termine zuerst berücksichtigen.');
 return {...state,closures:[...(state.closures||[]),{id:newId(),start,end,name:String(name||'Betriebsurlaub').trim().slice(0,80)||'Betriebsurlaub'}]};
}
export function removeClosure(state,id,now=new Date()){
 const item=(state.closures||[]).find(x=>x.id===id);if(!item)throw Error('Schließzeitraum nicht gefunden.');
 return {...state,closures:state.closures.flatMap(x=>x.id!==id?[x]:x.start<today(now)?[{...x,end: x.end<today(now)?x.end:addDays(today(now),-1)}]:[])};
}
export function setHolidayOpen(state,date,open,acknowledge=false,now=new Date()){
 if(!validDay(date)||date<today(now)||date>addDays(today(now),365)||!bwHolidays(Number(date.slice(0,4))).some(x=>x.date===date))throw Error('Ungültiger Feiertag.');
 if(!open&&closureConflicts(state,date,date,now).length&&!acknowledge)throw Error('Bitte bestehende Termine zuerst berücksichtigen.');
 return {...state,openHolidays:[...new Set([...(state.openHolidays||[]).filter(x=>x!==date),...(open?[date]:[])])]};
}
