// Backend login test. Never store access/refresh tokens in the local demo.
const BASE='https://xvxgqyrykkxdfadppoor.supabase.co',KEY='sb_publishable_CSD6Wfed4Wz3Qxd4qsUlLQ_psQpke_k';
const form=document.querySelector('#login-form'),status=document.querySelector('#status'),panel=document.querySelector('#session'),button=form.querySelector('button');
let token=null,timer=null;
function message(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
async function request(path,{method='GET',body,accessToken,signal}={}){
 const headers={apikey:KEY,Accept:'application/json'};if(body!==undefined)headers['Content-Type']='application/json';if(accessToken)headers.Authorization='Bearer '+accessToken;
 const res=await fetch(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal,cache:'no-store',credentials:'omit',redirect:'error'});
 if(!res.ok)throw new Error('request-failed');return res.status===204?null:res.json();
}
async function authorize(email,password){
 const signal=AbortSignal.timeout(15000);
 const s=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password},signal});
 if(!s?.access_token||!s.user?.id)throw new Error('invalid-session');
 try{
  const memberships=await request('/rest/v1/salon_members?select=salon_id,role&active=eq.true&user_id=eq.'+encodeURIComponent(s.user.id),{accessToken:s.access_token,signal});
  if(!Array.isArray(memberships)||!memberships.length)throw new Error('no-membership');
  const salons=await request('/rest/v1/salons?select=id,name,slug&slug=eq.avanti',{accessToken:s.access_token,signal});
  const salon=Array.isArray(salons)?salons.find(x=>memberships.some(m=>m.salon_id===x.id)):null;
  if(!salon)throw new Error('no-membership');
  const membership=memberships.find(m=>m.salon_id===salon.id);if(!['owner','manager','staff'].includes(membership.role))throw new Error('no-membership');
  return {token:s.access_token,expires:Number(s.expires_in)||3600,salon,role:membership.role};
 }catch(e){try{await request('/auth/v1/logout?scope=local',{method:'POST',accessToken:s.access_token,signal:AbortSignal.timeout(5000)});}catch{}throw e;}
}
function reset(){clearTimeout(timer);token=null;form.reset();form.hidden=false;panel.hidden=true;document.querySelector('#salon').textContent='';document.querySelector('#role').textContent='';document.querySelector('#title').textContent='Willkommen zurück.';document.querySelector('#intro').textContent='Melde dich mit deinem freigegebenen Mitarbeiterkonto an.';}
form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;message('Anmeldung wird geprüft …');const email=form.elements.email.value.trim(),password=form.elements.password.value;try{
 const data=await authorize(email,password);token=data.token;form.reset();form.hidden=true;panel.hidden=false;document.querySelector('#salon').textContent=data.salon.name;document.querySelector('#role').textContent=({owner:'Inhaber',manager:'Salonleitung',staff:'Mitarbeiter'})[data.role];document.querySelector('#title').textContent='Zugang bestätigt.';document.querySelector('#intro').textContent='Dein Konto ist dem Avanti-Salon zugeordnet.';message('Anmeldung und Datenbankberechtigung erfolgreich geprüft.');timer=setTimeout(()=>{reset();message('Sitzung abgelaufen. Bitte erneut anmelden.');},Math.max(1000,(data.expires-5)*1000));
 }catch(e){form.elements.password.value='';message(e.message==='no-membership'?'Dieses Konto ist nicht für Avanti freigegeben.':'Anmeldung fehlgeschlagen. Prüfe Zugangsdaten und Internetverbindung.',true);}
 finally{button.disabled=false;}});
document.querySelector('#logout').addEventListener('click',async()=>{const old=token;reset();if(!old)return;try{await request('/auth/v1/logout?scope=local',{method:'POST',accessToken:old,signal:AbortSignal.timeout(5000)});message('Abgemeldet.');}catch{message('Lokal abgemeldet. Server-Abmeldung nicht bestätigt.',true);}});
