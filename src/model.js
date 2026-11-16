// Local pilot only: all intervals are minutes of a Berlin calendar day.
export const today=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function addDays(d,n){const x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);}
export const time=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
export const parseTime=s=>{const [h,m]=String(s).split(':').map(Number);return h>=0&&h<24&&m>=0&&m<60?h*60+m:NaN;};
export function initialState(){const services=[{id:'cut',name:'Herrenhaarschnitt',duration:30,price:19},{id:'dry',name:'Damen-Trockenhaarschnitt',duration:45,price:30},{id:'child',name:'Kinderhaarschnitt',duration:30,price:15},{id:'brow',name:'Augenbrauen zupfen',duration:15,price:6}];return {version:1,services,staff:['A','B','C'].map((x,i)=>({id:'s'+i,name:'Team '+x,specialty:'Schnitt & Styling',photo:'',days:i===1?[1,2,3,4,5]:[1,2,3,4,5,6],start:540+i*30,end:1080,breakStart:780,breakEnd:825,services:services.map(s=>s.id)})),appointments:[],absences:[]};}
export function availableSlots({shifts,blocks=[],durationMinutes,stepMinutes=15,notBefore=0,notAfter=1440}){
 if(!Number.isInteger(durationMinutes)||durationMinutes<=0||!Number.isInteger(stepMinutes)||stepMinutes<=0)throw Error('Ungültige Dauer');
 const out=[];for(const w of shifts){for(let start=w.start+Math.ceil(Math.max(0,notBefore-w.start)/stepMinutes)*stepMinutes;start+durationMinutes<=Math.min(w.end,notAfter);start+=stepMinutes){const end=start+durationMinutes;if(!blocks.some(b=>start<b.end&&b.start<end))out.push({start,end});}}
 return out;
}
// All booking paths share the same interval validation.
export function validDay(day){return typeof day==='string'&&/^\d{4}-\d\d-\d\d$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;}
export function freeSlots(state,{day,staffId,durationMinutes=15,serviceId=null,excludeId=null,now=new Date()}){
 const s=state.staff.find(x=>x.id===staffId);
 if(!validDay(day)||day<today(now)||day>addDays(today(now),90)||!s||!s.days.includes(new Date(day+'T00:00:00Z').getUTCDay())||!Number.isInteger(durationMinutes)||durationMinutes<15||durationMinutes>480||durationMinutes%15!==0)return [];
 if(serviceId&&(!state.services.some(v=>v.id===serviceId)||!s.services.includes(serviceId)))return [];
 const blocks=[...state.appointments.filter(a=>a.status==='confirmed'&&a.day===day&&a.staffId===staffId&&a.id!==excludeId),...state.absences.filter(a=>a.day===day&&a.staffId===staffId&&a.id!==excludeId)];
 if(s.breakEnd>s.breakStart)blocks.push({start:s.breakStart,end:s.breakEnd});
 let earliest=0;if(day===today(now)){const [h,m]=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number);earliest=h*60+m+1;}
 return availableSlots({shifts:[{start:s.start,end:s.end}],blocks,durationMinutes,notBefore:earliest});
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
 const name=String(input.name||'').trim().slice(0,80);if(!name)throw Error('Bitte einen Testnamen eingeben.');
 const a={id:old?.id||newId(),day:input.day,staffId:input.staffId,serviceId,start:slot.start,end:slot.end,name,status:'confirmed',source};
 return {...state,appointments:[...state.appointments.filter(x=>x.id!==a.id),a]};
}
export function blockTime(state,input,now=new Date(),newId=()=>globalThis.crypto.randomUUID()){
 const {day,staffId}=input,start=Number(input.start),end=start+Number(input.durationMinutes);
 const old=input.id?state.absences.find(a=>a.id===input.id):null;if(input.id&&!old)throw Error('Sperre nicht gefunden.');
 if(!validDay(day)||day<today(now)||day>addDays(today(now),90)||!state.staff.some(x=>x.id===staffId)||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>1440||end<=start||end-start>1440)throw Error('Ungültiger Zeitraum.');
 const blocked=[...state.appointments.filter(a=>a.status==='confirmed'),...state.absences].some(a=>a.id!==old?.id&&a.day===day&&a.staffId===staffId&&start<a.end&&a.start<end);
 if(blocked)throw Error('Der Zeitraum überschneidet sich mit einem Termin oder einer Sperre.');
 const a={id:old?.id||newId(),day,staffId,start,end,reason:String(input.reason||'Nicht verfügbar').trim().slice(0,80)||'Nicht verfügbar'};
 return {...state,absences:[...state.absences.filter(x=>x.id!==a.id),a]};
}
export function cancel(state,id){return {...state,appointments:state.appointments.map(a=>a.id===id?{...a,status:'cancelled'}:a)};}
