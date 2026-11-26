// Never cache customer data or session responses. Always revalidate the app shell.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{
 const r=event.request;if(r.method!=="GET"||new URL(r.url).origin!==self.location.origin)return;
 if(r.mode==="navigate"||["script","style","manifest"].includes(r.destination))event.respondWith(fetch(r,{cache:"no-store"}));
});