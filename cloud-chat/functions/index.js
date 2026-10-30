const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * When a new message is created, push a notification to every other room
 * member that has registered an FCM token (stored on users/{uid}.fcmTokens).
 */
exports.notifyOnMessage = onDocumentCreated(
  "rooms/{roomId}/messages/{msgId}",
  async (event) => {
    const msg = event.data && event.data.data();
    if (!msg) return;

    const db = admin.firestore();
    const roomSnap = await db.doc(`rooms/${event.params.roomId}`).get();
    if (!roomSnap.exists) return;
    const room = roomSnap.data();

    const recipients = (room.members || []).filter((uid) => uid !== msg.senderId);
    if (!recipients.length) return;

    const sender = (room.memberInfo && room.memberInfo[msg.senderId]) || {};
    const senderName = sender.name || "Someone";

    const userSnaps = await Promise.all(
      recipients.map((uid) => db.doc(`users/${uid}`).get())
    );
    const tokens = [];
    userSnaps.forEach((s) => {
      const t = s.exists ? s.data().fcmTokens : null;
      if (Array.isArray(t)) tokens.push(...t);
    });
    if (!tokens.length) return;

    const body =
      msg.text && msg.text.trim()
        ? msg.text.slice(0, 120)
        : msg.attachments && msg.attachments.length
        ? "Sent an attachment"
        : "New message";

    const res = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: `${senderName} · ${room.name || "Chat"}`, body },
      data: { roomId: event.params.roomId },
      webpush: { fcmOptions: { link: "/" } },
    });

    // Clean up tokens that are no longer valid.
    const dead = [];
    res.responses.forEach((r, i) => {
      if (
        !r.success &&
        r.error &&
        /registration-token-not-registered|invalid-registration-token/.test(r.error.code)
      ) {
        dead.push(tokens[i]);
      }
    });
    if (dead.length) {
      await Promise.all(
        recipients.map((uid) =>
          db.doc(`users/${uid}`).update({
            fcmTokens: admin.firestore.FieldValue.arrayRemove(...dead),
          })
        )
      );
    }
  }
);
