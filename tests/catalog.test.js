import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,upgradeDemo,slots,book,SERVICE_CATALOG} from '../src/model.js';

const now=new Date('2026-11-16T08:00:00Z');
const date='2026-11-17';
const expected=[
 ['cut','Herrenhaarschnitt',30,19],
 ['dry','Damen-Trockenhaarschnitt',45,30],
 ['child3','Kinder bis 3 Jahre',30,10],
 ['child','Kinder bis 16 Jahre',30,15],
 ['brow','Augenbrauen zupfen',15,6],
 ['lash','Wimpern färben',30,10]
];

test('exactly six services with shared 15-minute trial grid',()=>{
 const actual=SERVICE_CATALOG.map(({id,name,duration,price})=>[id,name,duration,price]);
 assert.deepEqual(actual,expected);
 assert.ok(actual.every(([, ,duration])=>duration%15===0));
 assert.deepEqual(initialState().services,SERVICE_CATALOG);
});

test('existing demo updates catalogue without dropping appointments',()=>{
 const x=initialState();
 x.services=x.services.slice(0,4).map(v=>v.id==='dry'?{...v,duration:60}:v);
 x.appointments.push({id:'previous',staffId:'s0',day:date,start:540,end:570,status:'confirmed'});
 const y=upgradeDemo(x);
 assert.deepEqual(y.services,SERVICE_CATALOG);
 assert.deepEqual(y.appointments,x.appointments);
 assert.equal(y.staff.length,5);
 assert.ok(y.staff.every(person=>expected.every(([id])=>person.services.includes(id))));
});

test('manual phone booking with a treatment blocks the complete duration',()=>{
 const state=initialState(),at=slots(state,{day:date,staffId:'s0',serviceId:'dry',now})[0];
 assert.ok(at);
 const result=book(state,{day:date,staffId:'s0',start:at.start,serviceId:'dry',durationMinutes:45,name:'Demo',source:'manual'},now,()=> 'phone-demo');
 const entry=result.appointments[0];
 assert.equal(entry.serviceId,'dry');
 assert.equal(entry.end-entry.start,45);
 const open=slots(result,{day:date,staffId:'s0',serviceId:'cut',now});
 assert.ok(open.every(s=>s.start>=entry.end||s.end<=entry.start));
});
