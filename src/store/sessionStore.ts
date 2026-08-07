import { create } from 'zustand';

export interface SessionUser {
  id: string;
  username: string;
  email?: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
}

interface SessionState extends SessionUser {
  userId: string;
  isSeller: boolean;
  sellerId: string;
  authenticated: boolean;
  hydrated: boolean;
}

interface SessionActions {
  setUser: (user: SessionUser) => void;
  clearUser: () => void;
  becomeSeller: () => void;
}

type SessionStore = SessionState & SessionActions;

const GUEST_USER: SessionUser = {
  id: '',
  username: '',
  displayName: null,
  avatarUrl: null,
  email: null,
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...GUEST_USER,
  userId: '',
  isSeller: false,
  sellerId: '',
  authenticated: false,
  hydrated: false,

  setUser: (user) => set({ ...user, userId: user.id, authenticated: true, hydrated: true }),
  clearUser: () => set({ ...GUEST_USER, userId: '', isSeller: false, sellerId: '', authenticated: false, hydrated: true }),
  becomeSeller: () => set({ isSeller: true }),
}));
