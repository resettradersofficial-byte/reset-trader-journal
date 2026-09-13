const CACHE = 'reset-trader-v5-notifications-20260913';
const APP_SHELL = ['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => { if(event.request.method!=='GET') return; event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{const copy=response.clone();if(new URL(event.request.url).origin===self.location.origin)caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}).catch(()=>caches.match('./index.html')))); });

// Firebase Cloud Messaging background delivery.
try {
  importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');
  firebase.initializeApp({apiKey:'AIzaSyBScbIboHnObhrFesQaNy1PQL7OIUCaulg',authDomain:'reset-traders-app.firebaseapp.com',projectId:'reset-traders-app',storageBucket:'reset-traders-app.firebasestorage.app',messagingSenderId:'578199029729',appId:'1:578199029729:web:a7bd1272a0f847cd06f4a0',measurementId:'G-W45H2671EJ'});
  const messaging=firebase.messaging();
  messaging.onBackgroundMessage(payload=>{
    const notification=payload.notification||{};
    const title=notification.title||'RESET TRADER';
    const options={body:notification.body||'Your RESET TRADER process is due.',icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:payload.data?.alertId||'reset-trader-alert',data:{link:payload.data?.link||'./#today',alertId:payload.data?.alertId||''}};
    self.registration.showNotification(title,options);
  });
}catch(e){ /* FCM is optional until push is configured. */ }

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const link=event.notification?.data?.link||'./#today';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const client of list){if('focus' in client){client.navigate(link);return client.focus();}}if(clients.openWindow)return clients.openWindow(link);}));
});
