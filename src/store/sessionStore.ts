import { create } from "zustand";

interface SessionState {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isSeller: boolean;
  sellerId: string; // the shop this user operates as a seller
}

interface SessionActions {
  becomeSeller: () => void;
}

type SessionStore = SessionState & SessionActions;

// The logged-in demo user. Acts as buyer everywhere, and as seller "Urban Thread"
// once they open their shop dashboard.
export const useSessionStore = create<SessionStore>(set => ({
  userId: "me",
  username: "mon_compte",
  displayName: "Mon Compte",
  avatarUrl: "https://i.pravatar.cc/200?img=5",
  isSeller: true,
  sellerId: "seller-urban",

  becomeSeller: () => set({ isSeller: true }),
}));
