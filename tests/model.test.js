import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,book,cancel,slots,today,addDays,availableSlots,freeSlots,blockTime} from '../src/model.js';
const now=new Date('2026-11-16T08:00:00Z'),day='2026-11-17',s=initialState(),r={day,staffId:'s0',serviceId:'cut',start:540,name:'Test'},make=(state=s,req=r)=>book(state,req,now,()=> 'a');
test('Berlin local day',()=>assert.equal(today(new Date('2026-11-16T23:30:00Z')),'2026-11-17'));
test('year boundary',()=>assert.equal(addDays('2026-12-31',1),'2027-01-01'));
test('working hours and breaks',()=>{const a=slots(s,{...r,now});assert.ok(a.length);assert.ok(a.every(t=>t.start>=540&&t.end<=1080&&(t.end<=780||t.start>=825)));});
test('Sunday off',()=>assert.deepEqual(slots(s,{...r,day:'2026-11-22',now}),[]));
test('qualified staff only',()=>{const x=initialState();x.staff[0].services=[];assert.deepEqual(slots(x,{...r,now}),[]);});
test('overlaps rejected',()=>{const x=make();assert.throws(()=>make(x,{...r,start:555}));assert.doesNotThrow(()=>book(x,{...r,start:570},now,()=> 'b'));});
test('manual and online same capacity',()=>assert.throws(()=>make(make(s,{...r,source:'manual'}))));
test('cancel releases capacity',()=>assert.doesNotThrow(()=>make(cancel(make(),'a'))));
test('move own appointment',()=>{const y=make(make(),{...r,id:'a',start:555});assert.equal(y.appointments.length,1);assert.equal(y.appointments[0].start,555);});
test('absence blocks slots',()=>assert.ok(slots({...s,absences:[{staffId:'s0',day,start:540,end:600}]},{...r,now}).every(t=>t.start>=600)));
test('past rejected',()=>assert.deepEqual(slots(s,{...r,day:'2026-11-15',now}),[]));
test('long treatment cannot bridge break',()=>{const x=initialState();x.services[0].duration=90;assert.ok(slots(x,{...r,now}).every(t=>t.end<=780||t.start>=825));});
test('adjacent intervals allowed',()=>assert.deepEqual(availableSlots({shifts:[{start:0,end:60}],blocks:[{start:30,end:60}],durationMinutes:30}),[{start:0,end:30}]));

test('quick booking without selecting a service blocks online slots',()=>{const x=book(s,{...r,serviceId:null,source:'manual',durationMinutes:45},now,()=> 'q');assert.equal(x.appointments[0].end,585);assert.equal(x.appointments[0].serviceId,null);assert.ok(!slots(x,{...r,now}).some(t=>t.start<585));});
test('short manual service-free reservations work',()=>{const x=book(s,{...r,serviceId:null,source:'manual',durationMinutes:15},now,()=> 'q');assert.equal(x.appointments[0].end,555);});
test('public online requests cannot omit service or shorten duration',()=>{assert.throws(()=>book(s,{...r,serviceId:null,durationMinutes:15},now));assert.equal(book(s,{...r,durationMinutes:15},now,()=> 'q').appointments[0].end,570);});
test('quick block removes capacity and rejects overlaps',()=>{const input={day,staffId:'s0',start:540,durationMinutes:45};const x=blockTime(s,input,now,()=> 'block');assert.ok(!slots(x,{...r,now}).some(t=>t.start<585));assert.throws(()=>blockTime(x,input,now));assert.throws(()=>blockTime(make(),input,now));});
test('block can be moved and removed capacity released',()=>{const input={day,staffId:'s0',start:540,durationMinutes:30};const x=blockTime(s,input,now,()=> 'block');const y=blockTime(x,{...input,id:'block',start:600},now);assert.equal(y.absences.length,1);assert.ok(slots(y,{...r,now}).some(t=>t.start===540));});
test('manual appointment cannot cross pause',()=>assert.throws(()=>book(s,{...r,start:765,source:'manual',durationMinutes:30,serviceId:null},now)));
test('moving appointment retains duration after service price or duration change',()=>{const x=make();const y={...x,services:x.services.map(v=>v.id==='cut'?{...v,duration:60}:v)};const z=book(y,{...r,id:'a',start:600},now);assert.equal(z.appointments[0].end,630);});
test('reject impossible calendar date',()=>assert.equal(freeSlots(s,{...r,day:'2026-11-31',now}).length,0));

test('whole-day block removes every free slot',()=>{const x=blockTime(s,{day,staffId:'s0',start:0,durationMinutes:1440},now,()=> 'day');assert.equal(freeSlots(x,{day,staffId:'s0',now}).length,0);assert.equal(x.absences[0].end,1440);});
