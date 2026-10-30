"use client";

import { useState, type FormEvent } from "react";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import type { MemberInfo, UserProfile } from "@/lib/types";

export default function NewRoomModal({
  user,
  onClose,
  onCreated,
}: {
  user: User;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}) {
  const [name, setName] = useState("");
  const [emails, setEmails] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const list = Array.from(
        new Set(
          emails
            .split(/[,\s;]+/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
            .filter((s) => s !== (user.email || "").toLowerCase())
        )
      );
      const found: UserProfile[] = [];
      const missing: string[] = [];
      for (const em of list) {
        const snap = await getDocs(query(collection(db, "users"), where("email", "==", em)));
        if (snap.empty) missing.push(em);
        else found.push(snap.docs[0].data() as UserProfile);
      }
      if (missing.length) {
        setError(`No account found for: ${missing.join(", ")}. They need to sign up first.`);
        setBusy(false);
        return;
      }

      const memberInfo: Record<string, MemberInfo> = {
        [user.uid]: { name: user.displayName || user.email || "Me", photoURL: user.photoURL || null },
      };
      found.forEach((u) => (memberInfo[u.uid] = { name: u.displayName, photoURL: u.photoURL || null }));
      const members = Object.keys(memberInfo);

      const roomName =
        name.trim() ||
        (found.length ? found.map((u) => u.displayName).join(", ") : "My notes");

      const ref = await addDoc(collection(db, "rooms"), {
        name: roomName,
        members,
        memberInfo,
        createdAt: serverTimestamp(),
        lastMessage: "",
        lastMessageAt: serverTimestamp(),
      });
      onCreated(ref.id);
    } catch (err) {
      console.error(err);
      setError("Couldn't create the room. Check your Firestore rules and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={create}>
        <h2>New chat</h2>
        <label>
          Room name <span className="muted">(optional)</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend plans" maxLength={60} />
        </label>
        <label>
          Add people by email
          <textarea
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="friend@example.com, teammate@example.com"
            rows={3}
          />
        </label>
        <p className="hint">Leave empty to create a private notes room just for you.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary small" disabled={busy}>{busy ? "Creating…" : "Create"}</button>
        </div>
      </form>
    </div>
  );
}
