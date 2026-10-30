"use client";

import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db, isConfigured } from "@/lib/firebase";
import { enablePush, listenForeground } from "@/lib/messaging";
import type { Room } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import AuthScreen from "@/components/AuthScreen";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import NewRoomModal from "@/components/NewRoomModal";

export default function Home() {
  const { user, loading } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [pushState, setPushState] = useState<"idle" | "on" | "busy">("idle");
  const [toast, setToast] = useState<string>("");

  // Subscribe to the rooms this user belongs to
  useEffect(() => {
    if (!user) {
      setRooms([]);
      setActiveId(null);
      return;
    }
    const q = query(collection(db, "rooms"), where("members", "array-contains", user.uid));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data({ serverTimestamps: "estimate" }) as Omit<Room, "id">) }));
        list.sort((a, b) => (b.lastMessageAt?.toMillis() ?? 0) - (a.lastMessageAt?.toMillis() ?? 0));
        setRooms(list);
      },
      (err) => console.error("rooms listener", err)
    );
  }, [user]);

  // Foreground push -> toast; reflect existing permission
  useEffect(() => {
    if (!user) return;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") setPushState("on");
    let unsub: () => void = () => {};
    listenForeground((title, body) => {
      setToast(`${title}${body ? ` — ${body}` : ""}`);
      setTimeout(() => setToast(""), 4000);
    }).then((u) => (unsub = u));
    return () => unsub();
  }, [user]);

  async function handlePush() {
    if (!user) return;
    setPushState("busy");
    const res = await enablePush(user.uid);
    setPushState(res.ok ? "on" : "idle");
    setToast(res.message);
    setTimeout(() => setToast(""), 4000);
  }

  if (!isConfigured) return <SetupNeeded />;
  if (loading) return <div className="splash"><div className="spinner" /></div>;
  if (!user) return <AuthScreen />;

  const active = rooms.find((r) => r.id === activeId) || null;

  return (
    <main className="app">
      <Sidebar
        user={user}
        rooms={rooms}
        activeId={activeId}
        open={!mobileChatOpen}
        onSelect={(id) => {
          setActiveId(id);
          setMobileChatOpen(true);
        }}
        onNew={() => setShowNew(true)}
        onSignOut={() => signOut(auth)}
        onEnablePush={handlePush}
        pushState={pushState}
      />
      <div className={`stage ${mobileChatOpen ? "open" : ""}`}>
        {active ? (
          <ChatWindow key={active.id} user={user} room={active} onBack={() => setMobileChatOpen(false)} />
        ) : (
          <div className="welcome">
            <img src="/icon.svg" alt="" width={84} height={84} />
            <h2>Welcome to CloudChat</h2>
            <p>Select a conversation or start a new one to begin messaging.</p>
            <button className="primary small" onClick={() => setShowNew(true)}>New chat</button>
          </div>
        )}
      </div>

      {showNew && (
        <NewRoomModal
          user={user}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false);
            setActiveId(id);
            setMobileChatOpen(true);
          }}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function SetupNeeded() {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Almost there 🚀</h1>
        <p className="hint">
          Firebase keys are missing. Copy <code>.env.local.example</code> to <code>.env.local</code>, paste your
          Firebase web-app config, then restart <code>npm run dev</code>.
        </p>
        <ol className="hint">
          <li>Firebase Console → create project</li>
          <li>Enable Auth (Email/Password + Google), Firestore and Storage</li>
          <li>Add a Web app and copy the config values</li>
          <li>Deploy rules: <code>firebase deploy --only firestore:rules,storage</code></li>
        </ol>
      </div>
    </div>
  );
}
