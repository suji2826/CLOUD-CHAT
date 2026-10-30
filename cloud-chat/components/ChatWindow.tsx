"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { User } from "firebase/auth";
import { db, storage } from "@/lib/firebase";
import type { Attachment, Message, Room } from "@/lib/types";
import { dayLabel, prettySize, timeLabel } from "@/lib/format";
import Avatar from "./Avatar";

const MAX_BYTES = 10 * 1024 * 1024;

type Row =
  | { type: "day"; label: string; key: string }
  | { type: "msg"; m: Message; first: boolean; key: string };

export default function ChatWindow({
  user,
  room,
  onBack,
}: {
  user: User;
  room: Room;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Real-time message stream
  useEffect(() => {
    setMessages([]);
    const q = query(collection(db, `rooms/${room.id}/messages`), orderBy("createdAt"));
    return onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: "estimate" }) as Omit<Message, "id">) })));
      },
      (err) => {
        console.error(err);
        setError("Couldn't load messages. Check your Firestore rules.");
      }
    );
  }, [room.id]);

  // Mark incoming messages as read
  useEffect(() => {
    messages.forEach((m) => {
      if (m.senderId !== user.uid && !(m.readBy || []).includes(user.uid)) {
        updateDoc(doc(db, `rooms/${room.id}/messages/${m.id}`), { readBy: arrayUnion(user.uid) }).catch(() => {});
      }
    });
  }, [messages, room.id, user.uid]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, room.id]);

  function pickFiles(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    const ok = picked.filter((f) => f.size <= MAX_BYTES);
    if (ok.length < picked.length) setError("Files over 10 MB were skipped.");
    else setError("");
    setFiles((prev) => [...prev, ...ok].slice(0, 5));
    e.target.value = "";
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && files.length === 0) || sending) return;
    setSending(true);
    setError("");
    try {
      // Reserve the message id first so uploads can live at rooms/{roomId}/{msgId}/filename
      const msgRef = doc(collection(db, `rooms/${room.id}/messages`));
      const attachments: Attachment[] = [];
      for (const f of files) {
        const safe = f.name.replace(/[^\w.\-]+/g, "_");
        const r = ref(storage, `rooms/${room.id}/${msgRef.id}/${safe}`);
        await uploadBytes(r, f, { contentType: f.type || "application/octet-stream" });
        attachments.push({ name: f.name, url: await getDownloadURL(r), type: f.type, size: f.size });
      }
      await setDoc(msgRef, {
        text: body,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        readBy: [user.uid],
        ...(attachments.length ? { attachments } : {}),
      });
      await updateDoc(doc(db, "rooms", room.id), {
        lastMessage: body || `📎 ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}`,
        lastMessageAt: serverTimestamp(),
      });
      setText("");
      setFiles([]);
    } catch (err) {
      console.error(err);
      setError("Message failed to send. Check your connection and Storage/Firestore rules.");
    } finally {
      setSending(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const others = room.members.filter((m) => m !== user.uid);
  const memberNames = room.members.map((m) => room.memberInfo?.[m]?.name || "Member").join(", ");

  const rows = useMemo(() => {
    const out: Row[] = [];
    let last = "";
    messages.forEach((m, i) => {
      const label = dayLabel(m.createdAt);
      if (label !== last) {
        out.push({ type: "day", label, key: `d-${label}-${i}` });
        last = label;
      }
      const prev = messages[i - 1];
      out.push({ type: "msg", m, first: !prev || prev.senderId !== m.senderId || dayLabel(prev.createdAt) !== label, key: m.id });
    });
    return out;
  }, [messages]);

  return (
    <section className="chat">
      <header className="chat-head">
        <button className="icon-btn back" onClick={onBack} aria-label="Back to chats">←</button>
        <Avatar name={room.name} size={42} />
        <div className="chat-title">
          <strong>{room.name}</strong>
          <span>{room.members.length} member{room.members.length > 1 ? "s" : ""} · {memberNames}</span>
        </div>
      </header>

      <div className="messages">
        {rows.length === 0 && (
          <div className="empty-chat">
            <div className="bubble-art">💬</div>
            <h3>Say hello</h3>
            <p>Messages sync instantly across all your devices.</p>
          </div>
        )}
        {rows.map((row) =>
          row.type === "day" ? (
            <div className="day" key={row.key}><span>{row.label}</span></div>
          ) : (
            <Bubble key={row.key} m={row.m} first={row.first} mine={row.m.senderId === user.uid} room={room} othersCount={others.length} />
          )
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="error bar" role="alert">{error}</div>}

      {files.length > 0 && (
        <div className="pending-files">
          {files.map((f, i) => (
            <span className="chip" key={i}>
              📎 {f.name} <em>{prettySize(f.size)}</em>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove file">×</button>
            </span>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={send}>
        <input ref={fileInput} type="file" multiple hidden onChange={pickFiles} />
        <button type="button" className="icon-btn" onClick={() => fileInput.current?.click()} aria-label="Attach files" title="Attach files">📎</button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type a message…  (Enter to send, Shift+Enter for new line)"
          rows={1}
        />
        <button className="send" disabled={sending || (!text.trim() && files.length === 0)} aria-label="Send">
          {sending ? "…" : "➤"}
        </button>
      </form>
    </section>
  );
}

function Bubble({
  m,
  first,
  mine,
  room,
  othersCount,
}: {
  m: Message;
  first: boolean;
  mine: boolean;
  room: Room;
  othersCount: number;
}) {
  const sender = room.memberInfo?.[m.senderId];
  const seen = mine && othersCount > 0 && (m.readBy || []).length > 1;
  return (
    <div className={`msg ${mine ? "mine" : "theirs"} ${first ? "first" : ""}`}>
      {!mine && (
        <div className="msg-avatar">{first ? <Avatar name={sender?.name} photoURL={sender?.photoURL} size={32} /> : null}</div>
      )}
      <div className="bubble">
        {!mine && first && room.members.length > 2 && <div className="sender">{sender?.name || "Member"}</div>}
        {m.attachments?.map((a, i) =>
          a.type.startsWith("image/") ? (
            <a key={i} href={a.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="att-img" src={a.url} alt={a.name} loading="lazy" />
            </a>
          ) : (
            <a key={i} className="att-file" href={a.url} target="_blank" rel="noreferrer">
              <span>📄</span>
              <div>
                <strong>{a.name}</strong>
                <em>{prettySize(a.size)}</em>
              </div>
            </a>
          )
        )}
        {m.text && <div className="text">{m.text}</div>}
        <div className="meta">
          {timeLabel(m.createdAt)}
          {mine && <span className={`ticks ${seen ? "seen" : ""}`}>{seen ? "✓✓" : "✓"}</span>}
        </div>
      </div>
    </div>
  );
}
