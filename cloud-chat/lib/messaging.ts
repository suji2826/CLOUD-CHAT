import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { arrayUnion, doc, setDoc } from "firebase/firestore";
import app, { db, firebaseConfig } from "./firebase";

/**
 * Ask for notification permission, register the service worker, obtain an FCM
 * token and store it on users/{uid}.fcmTokens so the Cloud Function can push to it.
 * Returns a human-readable status string.
 */
export async function enablePush(uid: string): Promise<{ ok: boolean; message: string }> {
  try {
    if (typeof window === "undefined" || !(await isSupported())) {
      return { ok: false, message: "Push notifications aren't supported in this browser." };
    }
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      return { ok: false, message: "Add NEXT_PUBLIC_FIREBASE_VAPID_KEY to .env.local first." };
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, message: "Notification permission was denied." };
    }
    const params = new URLSearchParams({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    });
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${params.toString()}`
    );
    const token = await getToken(getMessaging(app), {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return { ok: false, message: "Couldn't get a push token." };
    await setDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) }, { merge: true });
    return { ok: true, message: "Push notifications enabled." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to enable push." };
  }
}

/** Foreground messages (tab open) -> callback so the UI can show a toast. */
export async function listenForeground(cb: (title: string, body: string) => void): Promise<() => void> {
  if (typeof window === "undefined" || !(await isSupported())) return () => {};
  return onMessage(getMessaging(app), (payload) => {
    cb(payload.notification?.title ?? "New message", payload.notification?.body ?? "");
  });
}
