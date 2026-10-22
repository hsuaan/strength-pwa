const CACHE="strength-pwa-1.6.0";
const CORE=[
  "./manifest.webmanifest",
  "./schedule_patch.js",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];
const PATCH_TAG='<script src="./schedule_patch.js?v=1.6"></script>';

async function injectPatch(response){
  if(!response || !response.ok) return response;
  const type=response.headers.get("content-type")||"";
  if(!type.includes("text/html")) return response;

  let html=await response.text();

  // 移除舊的排程 patch 標籤，再放入最新版。
  html=html.replace(/<script src="\.\/schedule_patch\.js[^"]*"><\/script>\s*/g,"");
  html=html.replace("</body>",`${PATCH_TAG}\n</body>`);

  const headers=new Headers(response.headers);
  headers.delete("content-length");
  headers.set("cache-control","no-cache");

  return new Response(html,{
    status:response.status,
    statusText:response.statusText,
    headers
  });
}

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(CORE);
    const raw=await fetch("./index.html",{cache:"no-store"});
    const patched=await injectPatch(raw);
    await cache.put("./index.html",patched.clone());
    await cache.put("./",patched.clone());
  })());
  self.skipWaiting();
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);

  if(url.origin===location.origin){
    const isHtml=event.request.mode==="navigate" ||
      url.pathname.endsWith("/") ||
      url.pathname.endsWith("/index.html");

    if(isHtml){
      event.respondWith((async()=>{
        try{
          const req=new Request(event.request,{cache:"no-store"});
          const raw=await fetch(req);
          const patched=await injectPatch(raw);
          const cache=await caches.open(CACHE);
          await cache.put("./index.html",patched.clone());
          return patched;
        }catch(e){
          return (await caches.match(event.request)) ||
                 (await caches.match("./index.html"));
        }
      })());
      return;
    }

    event.respondWith(
      fetch(event.request).then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      }).catch(()=>caches.match(event.request))
    );
    return;
  }

  if(url.hostname==="cdn.jsdelivr.net"){
    event.respondWith(
      caches.match(event.request).then(cached=>
        cached || fetch(event.request).then(response=>{
          caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));
          return response;
        })
      )
    );
  }
});