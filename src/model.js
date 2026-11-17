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
 if(!validDay(day)||day<today(now)||day>addDays(today(now),90)||!s||s.archived===true||!shift||!Number.isInteger(durationMinutes)||durationMinutes<15||durationMinutes>480||durationMinutes%15!==0)return [];
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
 const a={id:old?.id||newId(),day:input.day,staffId:input.staffId,serviceId,start:slot.start,end:slot.end,name,phone,status:'confirmed',source};
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
  else if(block?.vacationId)status='vacation';
  else if(block?.wholeDay===true)status='wholeDay';
  else if(block)status=block.quickSlot===true&&block.start===start&&block.end===end&&day>=today(now)&&day<=addDays(today(now),90)?'quick':'absence';
  else if(free.has(start))status='free';
  else if(!working||start<shift.start||end>shift.end)status='off';
  else if(shift.breakEnd>shift.breakStart&&start<shift.breakEnd&&shift.breakStart<end)status='pause';
  else if(day<today(now)||day===today(now)&&start<=berlinMinute(now))status='past';
  result.push({start,end,status,appointmentId:appointment?.id,blockId:block?.id,label:appointment?.name||block?.reason||'',source:appointment?.source});
 }return result;
}

function berlinMinute(now){const [h,m]=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number);return h*60+m;}
export function nextWorkday(state,staffId,now=new Date()){
 const s=state.staff.find(x=>x.id===staffId),d=today(now);
 if(!s)return d;
 for(let i=0;i<8;i++){const date=addDays(d,i),shift=dayShift(s,date);if(shift&&(i>0||berlinMinute(now)<shift.end))return date;}
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
