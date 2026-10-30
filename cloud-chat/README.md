# CloudChat — Cloud Chat Application

React (Next.js 14) + Firebase Auth + Firestore + Cloud Storage + Cloud Messaging (FCM).

## Features
- Email/Password and Google sign-in
- Create chat rooms and add people by email
- Real-time messaging (Firestore `onSnapshot`), synced across devices
- Image and file sharing (Cloud Storage at `rooms/{roomId}/{msgId}/filename`, 10 MB limit)
- Read receipts (✓ sent, ✓✓ seen)
- Web push notifications via FCM + a Cloud Function
- Immutable messages (only `readBy` can be updated), member-only access rules
- Responsive UI for desktop and mobile

## Project structure
```
app/                 Next.js app router (layout, page, styles)
components/          AuthScreen, Sidebar, ChatWindow, NewRoomModal, ...
lib/                 firebase.ts, messaging.ts, types, helpers
public/              firebase-messaging-sw.js (FCM service worker), icon.svg
functions/           Cloud Function that sends push notifications
firestore.rules      Firestore security rules
storage.rules        Cloud Storage security rules
firebase.json        Firebase deploy config
```

## Setup (about 10 minutes)

### 1. Firebase project
1. [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
3. **Firestore Database** → Create database (production mode).
4. **Storage** → Get started (requires the Blaze plan on new projects).
5. **Project settings → Your apps → Web (`</>`)** → register an app and copy the config.
6. **Project settings → Cloud Messaging → Web Push certificates** → Generate key pair (this is your VAPID key).

### 2. Environment
```bash
cp .env.local.example .env.local
# paste the values from step 1
```

### 3. Run locally
```bash
npm install
npm run dev
# open http://localhost:3000
```
Create two accounts (use a second browser or incognito window), start a chat by entering the other account's email, and message in real time.

### 4. Deploy security rules
```bash
npm i -g firebase-tools
firebase login
firebase use --add            # pick your project
firebase deploy --only firestore:rules,firestore:indexes,storage
```
> Do this before real use — it locks data to room members.

### 5. Push notifications (optional but included)
```bash
cd functions && npm install && cd ..
firebase deploy --only functions
```
Then click **Enable notifications** in the app sidebar. The `notifyOnMessage` function sends a push to every other room member when a message is created.

### 6. Deploy the web app
- **Vercel:** push to GitHub → import the repo → add the `NEXT_PUBLIC_*` env vars → deploy. Add your Vercel domain to Firebase Auth → Settings → Authorized domains.
- **Firebase Hosting:** `firebase experiments:enable webframeworks && firebase deploy --only hosting`

## Data model
```
users/{uid}                 { uid, displayName, email, photoURL, fcmTokens[] }
rooms/{roomId}              { name, members[], memberInfo{uid:{name,photoURL}}, createdAt, lastMessage, lastMessageAt }
rooms/{roomId}/messages/{id} { text, senderId, createdAt, readBy[], attachments[] }
```

## Troubleshooting
- **"Missing or insufficient permissions"** → deploy the rules in step 4.
- **Google popup blocked / unauthorized domain** → add your domain under Auth → Authorized domains.
- **No push notifications** → check the VAPID key, that Functions are deployed, and that the browser allowed notifications. Push requires HTTPS (localhost is OK).
