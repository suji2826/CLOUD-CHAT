/* Firebase Cloud Messaging service worker (background notifications).
   The Firebase web config is passed in via the registration URL query string,
   so no keys are hard-coded in this file. */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const p = new URL(self.location).searchParams;

firebase.initializeApp({
  apiKey: p.get("apiKey"),
  authDomain: p.get("authDomain"),
  projectId: p.get("projectId"),
  storageBucket: p.get("storageBucket"),
  messagingSenderId: p.get("messagingSenderId"),
  appId: p.get("appId"),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || "New message", {
    body: n.body || "",
    icon: "/icon.svg",
    data: payload.data || {},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
});
