// Avanti controlled pilot booking API. Service-role credentials never leave the server.
const BASE=Deno.env.get("SUPABASE_URL")||"";
const SECRET=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const ORIGINS=new Set(["https://studio.haarstudio-avanti.de","https://cra4zzy.github.io","https://haarstudio-avanti.de","https://www.haarstudio-avanti.de","http://localhost:8080","http://127.0.0.1:8080"]);
const configuredOrigin=Deno.env.get("AVANTI_STUDIO_ORIGIN");
if(configuredOrigin && /^https:\/\/[a-z0-9.-]+\.haarstudio-avanti\.de$/.test(configuredOrigin))ORIGINS.add(configuredOrigin);
const ZONE="Europe/Berlin";
const cors=(origin)=>({"Access-Control-Allow-Origin":origin&&ORIGINS.has(origin)?origin:"https://cra4zzy.github.io","Vary":"Origin","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS"});
const err=(code,message,origin)=>new Response(JSON.stringify({error:message}),{status:code,headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const ok=(data,origin)=>new Response(JSON.stringify(data),{headers:{...cors(origin),"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
const datePart=(dt)=>new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).format(dt);
function berlinParts(dt){const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(dt).map(v=>[v.type,v.value]));return {day:parts.year+"-"+parts.month+"-"+parts.day,minute:Number(parts.hour)*60+Number(parts.minute)};}
function dateOk(day){if(!/^\d{4}-\d{2}-\d{2}$/.test(day||""))return false;const d=new Date(day+"T00:00:00Z");return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===day;}
const addDays=(d,n)=>{const v=new Date(d+"T00:00:00Z");v.setUTCDate(v.getUTCDate()+n);return v.toISOString().slice(0,10)};
async function db(path,{method="GET",body}={}){if(!SECRET||!BASE)throw Error("server_not_configured");
 const response=await fetch(BASE+"/"+path,{method,headers:{"apikey":SECRET,"Authorization":"Bearer "+SECRET,"Content-Type":"application/json","Accept":"application/json","Prefer":"return=representation"},body:body===undefined?undefined:JSON.stringify(body),redirect:"error",cache:"no-store"});
 const payload=await response.text();let data;try{data=payload?JSON.parse(payload):null}catch{data=null}
 if(!response.ok){const e=new Error(data?.message||data?.error||"database_error");e.status=response.status;e.code=data?.code;throw e}return data;
}
async function authStaff(req){const authorization=req.headers.get("authorization")||"";
 if(!authorization.startsWith("Bearer ")||authorization.length>2500)throw Object.assign(Error("login_required"),{status:401});
 const response=await fetch(BASE+"/auth/v1/user",{headers:{apikey:SECRET,Authorization:authorization},cache:"no-store"});
 if(!response.ok)throw Object.assign(Error("session_invalid"),{status:401});
 const person=await response.json();
 if(!person?.id)throw Object.assign(Error("session_invalid"),{status:401});
 const rows=await db("rest/v1/salon_members?select=role,salon_id&active=eq.true&user_id=eq."+encodeURIComponent(person.id));
 const salons=await db("rest/v1/salons?select=id&slug=eq.avanti");
 const membership=rows.find(x=>x.salon_id===salons[0]?.id);
 if(!membership||!["owner","manager","staff"].includes(membership.role))throw Object.assign(Error("forbidden"),{status:403});
 return {userId:person.id,role:membership.role,email:person.email||"",salonId:membership.salon_id};
}
async function catalog(){
 const salons=await db("rest/v1/salons?select=id,name,slug&slug=eq.avanti");
 const salon=salons[0];if(!salon)throw Error("salon_missing");
 const base="&salon_id=eq."+encodeURIComponent(salon.id);
 const [staff,services,shifts,assignments]=await Promise.all([
  db("rest/v1/staff?select=id,code,display_name,specialty,active&order=code.asc"+base),
  db("rest/v1/services?select=id,code,name,duration_minutes,price_cents,active&order=code.asc"+base),
  db("rest/v1/weekly_shifts?select=staff_id,weekday,start_minute,end_minute&order=start_minute.asc"+base),
  db("rest/v1/staff_services?select=staff_id,service_id"+base)
 ]);
 return {salon,staff:staff.filter(x=>x.active&&x.code),services:services.filter(x=>x.active&&x.code),shifts,assignments};
}
async function events(salonId,day,privateMode=false){
 const low=addDays(day,-1)+"T00:00:00Z",high=addDays(day,2)+"T00:00:00Z";
 const col=privateMode?"id,staff_id,service_id,kind,status,starts_at,ends_at,customer_name,customer_email,customer_phone,service_name_snapshot,source,note":"staff_id,kind,starts_at,ends_at";
 return await db("rest/v1/calendar_entries?select="+col+"&salon_id=eq."+encodeURIComponent(salonId)+"&status=eq.confirmed&starts_at=lt."+encodeURIComponent(high)+"&ends_at=gt."+encodeURIComponent(low));
}
function coveredInterval(entry,day){const a=berlinParts(new Date(entry.starts_at)),b=berlinParts(new Date(entry.ends_at));if(a.day>day||b.day<day)return null;
 let start=a.day===day?a.minute:0,end=b.day===day?b.minute:1440;
 if(start>=end)return null;return {start,end};}
function availability(info,day,serviceCode,staffCode,entries){
 const service=info.services.find(x=>x.code===serviceCode);
 if(!service)return {slots:[],error:"service_unavailable"};
 const candidates=info.staff.filter(x=>(staffCode==="any"||x.code===staffCode)&&info.assignments.some(a=>a.staff_id===x.id&&a.service_id===service.id));
 const current=berlinParts(new Date()),dow=new Date(day+"T00:00:00Z").getUTCDay();
 const possibilities=[];
 for(const member of candidates){
  const occupied=entries.filter(e=>e.staff_id===member.id).map(e=>coveredInterval(e,day)).filter(Boolean);
  const shifts=info.shifts.filter(w=>w.staff_id===member.id&&w.weekday===dow);
  const starts=new Set();
  for(const shift of shifts)for(let t=Math.ceil(shift.start_minute/15)*15;t+service.duration_minutes<=shift.end_minute;t+=15){
   if(day===current.day&&t<=current.minute)continue;
   if(occupied.some(b=>t<b.end&&t+service.duration_minutes>b.start))continue;
   starts.add(t);
  }
  for(const t of starts)possibilities.push({start:t,staffCode:member.code,staffName:member.display_name});
 }
 possibilities.sort((a,b)=>a.start-b.start||a.staffCode.localeCompare(b.staffCode));
 // In "any" mode return one safe candidate per start time; RPC revalidates capacity.
 return {slots:staffCode==="any"?possibilities.filter((s,i)=>i===0||s.start!==possibilities[i-1].start):possibilities};
}
async function digest(source){const bytes=new TextEncoder().encode(source);const hash=await crypto.subtle.digest("SHA-256",bytes);return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,"0")).join("");}
function knownError(e){const s=String(e?.message||"");if(s.includes("exclusion")||s.includes("calendar_entries_salon_id_staff_id")||e?.code==="23P01")return [409,"slot_taken"];
 const expected=["invalid_booking","invalid_day","invalid_customer_name","invalid_customer_email","invalid_customer_phone","email_required","service_unavailable","staff_unavailable","service_required","outside_working_hours","invalid_duration","invalid_block","invalid_profile","invalid_photo","staff_has_appointments","invalid_shifts","existing_appointments","salon_closed","closure_overlap","entry_missing","time_in_past","rate_limited","rate_key_required"];
 const x=expected.find(v=>s.includes(v));if(x)return [x==="rate_limited"?429:422,x];return [e?.status===401?401:e?.status===403?403:500,e?.status===401?"login_required":e?.status===403?"forbidden":"request_failed"];
}
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin");
 if(origin&&!ORIGINS.has(origin))return err(403,"origin_not_allowed",origin);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
 if(!BASE||!SECRET)return err(503,"server_not_configured",origin);
 try{
 const url=new URL(req.url),action=url.searchParams.get("action")||"status";
 if(req.method==="GET"&&action==="status")return ok({status:"pilot",publicBookingEnabled:Deno.env.get("AVANTI_PUBLIC_BOOKING_ENABLED")==="true"},origin);
 if(req.method==="GET"&&action==="catalog"){const info=await catalog();return ok({staff:info.staff.map(s=>({code:s.code,name:s.display_name,specialty:s.specialty})),services:info.services.map(s=>({code:s.code,name:s.name,duration:s.duration_minutes,price:s.price_cents/100}))},origin)}
 if(req.method==="GET"&&action==="availability"){
  const date=url.searchParams.get("day")||"",service=url.searchParams.get("service")||"",staff=url.searchParams.get("staff")||"any";
  const today=berlinParts(new Date()).day;if(!dateOk(date)||date<today||date>addDays(today,90))return err(422,"invalid_day",origin);
  if(!/^[a-z0-9]{1,20}$/.test(service)||!(/^[a-z0-9]{1,20}$/.test(staff)||staff==="any"))return err(422,"invalid_query",origin);
  const info=await catalog();const closure=await db("rest/v1/rpc/avanti_day_closure",{method:"POST",body:{p_salon:info.salon.id,p_day:date}});if(closure.closed)return ok({day:date,service,staff,slots:[],publicBookingEnabled:false},origin);const occupied=await events(info.salon.id,date,false);
  return ok({day:date,service,staff,...availability(info,date,service,staff,occupied),publicBookingEnabled:Deno.env.get("AVANTI_PUBLIC_BOOKING_ENABLED")==="true"},origin);
 }
 if(req.method==="GET"&&action==="team"){
  const user=await authStaff(req);
  const profiles=await db("rest/v1/staff?select=id,code,display_name,specialty,active&order=display_name.asc&salon_id=eq."+encodeURIComponent(user.salonId));
  const allowed=profiles.filter(s=>s.code&& (s.active||["owner","manager"].includes(user.role)));
  const ids=allowed.map(s=>s.id);
  const portraits=ids.length?await db("rest/v1/avanti_staff_portraits?select=staff_id,photo&staff_id=in.("+ids.join(",")+")"):[];
  return ok({team:allowed.map(s=>({id:s.id,code:s.code,name:s.display_name,specialty:s.specialty,active:s.active,photo:portraits.find(p=>p.staff_id===s.id)?.photo||null}))},origin);
 }
 if(req.method==="GET"&&action==="closures"){
  const user=await authStaff(req);
  if(!["owner","manager"].includes(user.role))return err(403,"forbidden",origin);
  return ok(await db("rest/v1/rpc/avanti_closure_settings",{method:"POST",body:{p_salon:user.salonId}}),origin);
 }
 if(req.method==="GET"&&action==="studio"){
  const user=await authStaff(req);const day=url.searchParams.get("day")||berlinParts(new Date()).day;
  if(!dateOk(day)||day<"2020-01-01"||day>addDays(berlinParts(new Date()).day,365))return err(422,"invalid_day",origin);
  const info=await catalog();const [entries,closure]=await Promise.all([events(user.salonId,day,true),db("rest/v1/rpc/avanti_day_closure",{method:"POST",body:{p_salon:user.salonId,p_day:day}})]);
  return ok({closure,user:{email:user.email,role:user.role},staff:info.staff.map(s=>({id:s.id,code:s.code,name:s.display_name,specialty:s.specialty})),services:info.services.map(s=>({id:s.id,code:s.code,name:s.name,duration:s.duration_minutes,price:s.price_cents/100})),shifts:info.shifts,assignments:info.assignments,entries:entries.filter(e=>coveredInterval(e,day)).map(e=>({...e,local:coveredInterval(e,day)}))},origin);
 }
 if(req.method!=="POST")return err(405,"method_not_allowed",origin);
 const raw=await req.text();if(raw.length>(["staff-create","staff-save"].includes(action)?110000:12000))return err(413,"payload_too_large",origin);
 let data;try{data=JSON.parse(raw)}catch{return err(400,"invalid_json",origin)}
 if(action==="book"){
  if(Deno.env.get("AVANTI_PUBLIC_BOOKING_ENABLED")!=="true")return err(409,"public_booking_disabled",origin);
  if(typeof data?.website!=="string"||data.website.length>0)return err(422,"invalid_booking",origin); // hidden honeypot
  const ip=(req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")||"").split(",")[0].trim().slice(0,100);
  const hash=await digest("avanti-public-v1|"+ip+"|"+(req.headers.get("user-agent")||"").slice(0,150));
  const inserted=await db("rest/v1/rpc/avanti_create_booking",{method:"POST",body:{
   p_staff_code:data.staffCode,p_service_code:data.serviceCode,p_day:data.day,p_start_minute:data.start,
   p_customer_name:data.name,p_customer_email:data.email,p_customer_phone:data.phone||null,
   p_source:"online",p_duration_minutes:null,p_rate_digest:hash
  }});
  return ok({confirmed:true,bookingId:inserted},origin);
 }
 const user=await authStaff(req);
 if(["closure-add","closure-remove","holiday-toggle"].includes(action)){
  if(!["owner","manager"].includes(user.role))return err(403,"forbidden",origin);
  return ok(await db("rest/v1/rpc/avanti_manage_closures",{method:"POST",body:{p_salon:user.salonId,p_action:action,p_data:data}}),origin);
 }
 if(["staff-create","staff-save","staff-archive","staff-restore"].includes(action)){
  if(!["owner","manager"].includes(user.role))return err(403,"forbidden",origin);
  const result=await db("rest/v1/rpc/avanti_manage_staff",{method:"POST",body:{p_salon:user.salonId,p_action:action,p_data:data}});
  return ok(result,origin);
 }
 if(["edit-profile","edit-shifts","absence-range","edit-entry"].includes(action)){
  if(["edit-profile","edit-shifts"].includes(action)&&!["owner","manager"].includes(user.role))return err(403,"forbidden",origin);
  const result=await db("rest/v1/rpc/avanti_manage_studio",{method:"POST",body:{p_salon:user.salonId,p_action:action,p_data:data}});
  return ok(result,origin);
 }
 if(action==="staff-book"){
  const row=await db("rest/v1/rpc/avanti_create_booking",{method:"POST",body:{
   p_staff_code:data.staffCode,p_service_code:data.serviceCode||null,p_day:data.day,p_start_minute:data.start,
   p_customer_name:(data.name||"Telefontermin"),p_customer_email:data.email||null,p_customer_phone:data.phone||null,
   p_source:"manual",p_duration_minutes:data.duration||null,p_rate_digest:null
  }});return ok({confirmed:true,bookingId:row},origin);
 }
 if(action==="block"){
  const row=await db("rest/v1/rpc/avanti_create_block",{method:"POST",body:{p_staff_code:data.staffCode,p_day:data.day,p_start_minute:data.start,p_end_minute:data.end,p_note:data.note||""}});
  return ok({confirmed:true,blockId:row},origin);
 }
 if(action==="cancel"||action==="unblock"){
  if(!/^[0-9a-f-]{36}$/.test(String(data.id||"")))return err(422,"invalid_id",origin);
  const kind=action==="cancel"?"appointment":"absence";
  const rows=await db("rest/v1/calendar_entries?id=eq."+encodeURIComponent(data.id)+"&salon_id=eq."+encodeURIComponent(user.salonId)+"&kind=eq."+kind+"&status=eq.confirmed",{method:"PATCH",body:{status:"cancelled"}});
  if(!rows?.length)return err(404,"entry_missing",origin);return ok({confirmed:true},origin);
 }
 return err(404,"unknown_action",origin);
 }catch(e){const [code,message]=knownError(e);console.error("Avanti API",message);return err(code,message,origin)}
});
