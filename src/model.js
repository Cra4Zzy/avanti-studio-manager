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
export function slots(state,{day,staffId,serviceId,excludeId,now=new Date()}){
 const s=state.staff.find(x=>x.id===staffId),v=state.services.find(x=>x.id===serviceId);
 if(!/^\d{4}-\d\d-\d\d$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z'))||day<today(now)||day>addDays(today(now),90)||!s||!v||!s.services.includes(serviceId)||!s.days.includes(new Date(day+'T00:00:00Z').getUTCDay()))return [];
 const blocks=[...state.appointments.filter(a=>a.status==='confirmed'&&a.day===day&&a.staffId===staffId&&a.id!==excludeId),...state.absences.filter(a=>a.day===day&&a.staffId===staffId)];if(s.breakEnd>s.breakStart)blocks.push({start:s.breakStart,end:s.breakEnd});
 let earliest=0;if(day===today(now)){const [h,m]=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now).split(':').map(Number);earliest=h*60+m+1;}
 return availableSlots({shifts:[{start:s.start,end:s.end}],blocks,durationMinutes:v.duration,notBefore:earliest});
}
export function book(state,input,now=new Date(),newId=()=>globalThis.crypto.randomUUID()){
 const slot=slots(state,{...input,excludeId:input.id,now}).find(x=>x.start===Number(input.start));if(!slot)throw Error('Dieser Termin ist nicht verfügbar.');
 const name=String(input.name||'').trim().slice(0,80);if(!name)throw Error('Bitte einen Testnamen eingeben.');
 const old=input.id?state.appointments.find(a=>a.id===input.id&&a.status==='confirmed'):null;if(input.id&&!old)throw Error('Termin nicht gefunden.');
 const a={id:old?.id||newId(),day:input.day,staffId:input.staffId,serviceId:input.serviceId,start:slot.start,end:slot.end,name,status:'confirmed',source:old?.source||input.source||'online'};
 return {...state,appointments:[...state.appointments.filter(x=>x.id!==a.id),a]};
}
export function cancel(state,id){return {...state,appointments:state.appointments.map(a=>a.id===id?{...a,status:'cancelled'}:a)};}
