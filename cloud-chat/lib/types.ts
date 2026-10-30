import type { Timestamp } from "firebase/firestore";

export interface MemberInfo {
  name: string;
  photoURL?: string | null;
}

export interface Room {
  id: string;
  name: string;
  members: string[];
  memberInfo: Record<string, MemberInfo>;
  createdAt?: Timestamp | null;
  lastMessage?: string;
  lastMessageAt?: Timestamp | null;
}

export interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: Timestamp | null;
  readBy: string[];
  attachments?: Attachment[];
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
}
