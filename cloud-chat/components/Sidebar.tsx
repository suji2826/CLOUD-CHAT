"use client";

import type { User } from "firebase/auth";
import type { Room } from "@/lib/types";
import { listTime } from "@/lib/format";
import Avatar from "./Avatar";

export default function Sidebar({
  user,
  rooms,
  activeId,
  onSelect,
  onNew,
  onSignOut,
  onEnablePush,
  pushState,
  open,
}: {
  user: User;
  rooms: Room[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSignOut: () => void;
  onEnablePush: () => void;
  pushState: "idle" | "on" | "busy";
  open: boolean;
}) {
  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="side-head">
        <div className="me">
          <Avatar name={user.displayName || user.email || "Me"} photoURL={user.photoURL} size={40} />
          <div className="me-text">
            <strong>{user.displayName || "Me"}</strong>
            <span>{user.email}</span>
          </div>
        </div>
        <button className="icon-btn" onClick={onNew} title="New chat" aria-label="New chat">＋</button>
      </div>

      <div className="room-list">
        {rooms.length === 0 && (
          <div className="empty-side">
            <p>No conversations yet.</p>
            <button className="primary small" onClick={onNew}>Start a chat</button>
          </div>
        )}
        {rooms.map((r) => (
          <button key={r.id} className={`room ${r.id === activeId ? "active" : ""}`} onClick={() => onSelect(r.id)}>
            <Avatar name={r.name} size={44} />
            <div className="room-body">
              <div className="room-top">
                <strong>{r.name}</strong>
                <span>{listTime(r.lastMessageAt)}</span>
              </div>
              <div className="room-last">{r.lastMessage || "No messages yet"}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="side-foot">
        <button className="ghost" onClick={onEnablePush} disabled={pushState !== "idle"}>
          {pushState === "on" ? "🔔 Notifications on" : pushState === "busy" ? "Enabling…" : "🔔 Enable notifications"}
        </button>
        <button className="ghost" onClick={onSignOut}>Sign out</button>
      </div>
    </aside>
  );
}
