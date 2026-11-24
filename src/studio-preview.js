/* Isolated design preview. No network calls, no real accounts or persistent data. */
(() => {
const today=()=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Berlin",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const staff=["Daniela","Sofia","Melina","Vanessa","Jennifer"].map((name,i)=>({id:"demo-"+i,code:"demo-"+i,name,specialty:"Stylistin"}));
const services=[{code:"demo-cut",name:"Herrenhaarschnitt",duration:30},{code:"demo-dry",name:"Damenhaarschnitt",duration:45},{code:"demo-color",name:"Ansatzfarbe",duration:90}];
const days=new Map();let seq=0;
function entries(d){if(!days.has(d))days.set(d,[{id:d+"-example-1",staff_id:staff[0].id,kind:"appointment",customer_name:"Testtermin A",service_name_snapshot:"Damenhaarschnitt",local:{start:600,end:645}},{id:d+"-example-2",staff_id:staff[1].id,kind:"absence",note:"Test-Sperre",local:{start:660,end:720}},{id:d+"-example-3",staff_id:staff[2].id,kind:"appointment",customer_name:"Testtermin B",service_name_snapshot:"Ansatzfarbe",local:{start:840,end:930}}]);return days.get(d)}
const result=(body,ok=true)=>Promise.resolve({ok,json:async()=>body});
window.fetch=(url,opt={})=>{
 const u=new URL(url,location.href),action=u.searchParams.get("action"),b=opt.body?JSON.parse(opt.body):{},d=u.searchParams.get("day")||b.day||today();
 if(u.pathname.endsWith("/auth/v1/token"))return result({access_token:"preview-only",refresh_token:"preview-only",expires_in:3000});
 if(action==="studio")return result({user:{email:"Vorschau",role:"Demo"},staff,services,shifts:staff.flatMap(m=>Array.from({length:7},(_,weekday)=>[{staff_id:m.id,weekday,start_minute:540,end_minute:780},{staff_id:m.id,weekday,start_minute:825,end_minute:1080}]).flat()),entries:entries(d)});
 if(action==="staff-book"||action==="block"){const list=entries(d),m=staff.find(m=>m.code===b.staffCode),end=action==="block"?b.end:b.start+b.duration;if(!m||list.some(e=>e.staff_id===m.id&&b.start<e.local.end&&end>e.local.start))return result({error:"slot_taken"},false);list.push({id:"preview-"+(++seq),staff_id:m.id,kind:action==="block"?"absence":"appointment",customer_name:b.name||"Testtermin",note:b.note,service_name_snapshot:services.find(s=>s.code===b.serviceCode)?.name,local:{start:b.start,end}});return result({ok:true})}
 if(action==="cancel"||action==="unblock"){for(const list of days.values()){const i=list.findIndex(e=>e.id===b.id);if(i>=0){list.splice(i,1);break}}return result({ok:true})}
 return result({error:"Nur Vorschau"},false);
};
addEventListener("DOMContentLoaded",()=>{const f=document.querySelector("#login-form");if(f){f.elements.email.value="demo@example.invalid";f.elements.password.value="preview";f.requestSubmit();}
 const root=document.querySelector("#root");let moved=false;const observer=new MutationObserver(()=>{const pill=root.querySelector(".sync-pill");if(pill&&!pill.dataset.preview){pill.dataset.preview="true";pill.innerHTML="<i></i>Designvorschau · nur Beispieldaten";}if(!moved&&root.querySelector("[data-step='1']")){moved=true;setTimeout(()=>root.querySelector("[data-step='1']")?.click(),80);}});observer.observe(root,{childList:true,subtree:true});
});
})();